/**
 * Memory Consolidation Cron
 *
 * Scheduled background job that performs three operations on the structured
 * memory banks:
 *
 *   1. **Dedup** — merge entries within each bank that have >0.95 cosine
 *      similarity, keeping the more recent/detailed version.
 *   2. **Compression** — batch-summarize episodic memories older than 30 days
 *      into condensed entries, then archive the originals.
 *   3. **Promotion** — detect recurring patterns in episodic memory and promote
 *      them to the semantic bank (e.g. "mentioned Docker deployment in 5
 *      different conversations → semantic fact").
 *
 * All operations gracefully degrade when Supabase is not configured.
 * Default schedule: every 6 hours, configurable via drofbot.json:
 *   { "memory": { "consolidation": { "enabled": true, "intervalHours": 6 } } }
 */

import type { OpenClawConfig } from "../../shared/config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { isSupabaseConfigured, getSupabaseClient } from "../../shared/database/client.js";
import { getDrofbotMemory } from "../memory/drofbot-memory.js";

const log = createSubsystemLogger("cron/consolidation");

const DEFAULT_INTERVAL_HOURS = 6;
const DEDUP_SIMILARITY_THRESHOLD = 0.95;
const COMPRESSION_AGE_DAYS = 30;
const PROMOTION_MIN_OCCURRENCES = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ConsolidationConfig {
  enabled?: boolean;
  intervalHours?: number;
}

export interface ConsolidationRunner {
  stop(): void;
}

/**
 * Start the consolidation runner.
 * Uses a repeating setTimeout chain (not setInterval) to schedule runs.
 * Returns a handle that can be stopped.
 */
export function startConsolidationRunner(opts: { cfg: OpenClawConfig }): ConsolidationRunner {
  const memoryConfig = opts.cfg.memory;
  const consolidationCfg = (memoryConfig as Record<string, unknown> | undefined)?.consolidation as
    | ConsolidationConfig
    | undefined;

  const enabled = consolidationCfg?.enabled !== false;
  const intervalHours = consolidationCfg?.intervalHours ?? DEFAULT_INTERVAL_HOURS;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  if (!enabled || !isSupabaseConfigured()) {
    log.debug(`Consolidation disabled (enabled=${enabled}, supabase=${isSupabaseConfigured()}).`);
    return { stop() {} };
  }

  const scheduleNext = () => {
    if (stopped) return;
    timer = setTimeout(async () => {
      timer = null;
      if (stopped) return;
      try {
        await runConsolidation();
      } catch (err) {
        log.error(`Consolidation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      scheduleNext();
    }, intervalMs);
    timer.unref?.();
  };

  log.info(`Consolidation started: interval=${intervalHours}h`);
  scheduleNext();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      log.debug("Consolidation stopped.");
    },
  };
}

// ---------------------------------------------------------------------------
// Consolidation operations
// ---------------------------------------------------------------------------

/** Run all consolidation operations in sequence. */
export async function runConsolidation(): Promise<void> {
  const memory = getDrofbotMemory();
  if (!memory.isStructuredMemoryAvailable) return;

  log.info("Consolidation run starting…");
  const t0 = Date.now();

  const dedupCount = await deduplicateAll();
  const compressCount = await compressOldEpisodic();
  const promoteCount = await promoteRecurringPatterns();

  const durationMs = Date.now() - t0;
  log.info(
    `Consolidation complete: dedup=${dedupCount} compress=${compressCount} promote=${promoteCount} (${durationMs}ms)`,
  );
}

// ---------------------------------------------------------------------------
// 1. Deduplication
// ---------------------------------------------------------------------------

/**
 * Find and merge semantically similar entries within each bank.
 * Returns total number of entries deduplicated.
 */
async function deduplicateAll(): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;

  let total = 0;

  for (const table of ["memory_semantic", "memory_episodic", "memory_procedural"] as const) {
    try {
      const count = await deduplicateTable(client, table);
      total += count;
    } catch (err) {
      log.error(`Dedup failed for ${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return total;
}

async function deduplicateTable(
  client: ReturnType<typeof getSupabaseClient>,
  table: string,
): Promise<number> {
  if (!client) return 0;

  // Fetch entries with embeddings for pairwise comparison
  const { data: entries, error } = await client
    .from(table)
    .select("id, content, embedding")
    .not("embedding", "is", null)
    .order("created_at", { ascending: false })
    .limit(200); // Process in batches to limit memory

  if (error || !entries || entries.length < 2) return 0;

  const toDelete: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    if (seen.has(entries[i].id)) continue;
    for (let j = i + 1; j < entries.length; j++) {
      if (seen.has(entries[j].id)) continue;
      if (!entries[i].embedding || !entries[j].embedding) continue;

      const similarity = cosineSimilarity(
        entries[i].embedding as number[],
        entries[j].embedding as number[],
      );

      if (similarity >= DEDUP_SIMILARITY_THRESHOLD) {
        // Keep the newer entry (entries are sorted desc by created_at)
        toDelete.push(entries[j].id);
        seen.add(entries[j].id);
      }
    }
  }

  if (toDelete.length > 0) {
    const { error: delError } = await client.from(table).delete().in("id", toDelete);

    if (delError) {
      log.error(`Dedup delete failed: ${delError.message}`);
      return 0;
    }
    log.debug(`Dedup ${table}: removed ${toDelete.length} duplicates`);
  }

  return toDelete.length;
}

// ---------------------------------------------------------------------------
// 2. Compression (old episodic → summarized)
// ---------------------------------------------------------------------------

/**
 * Summarize episodic memories older than COMPRESSION_AGE_DAYS into condensed
 * entries, then delete the originals.
 */
async function compressOldEpisodic(): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;

  const cutoff = new Date(Date.now() - COMPRESSION_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldEntries, error } = await client
    .from("memory_episodic")
    .select("id, content, context, importance")
    .lt("timestamp", cutoff)
    .order("timestamp", { ascending: true })
    .limit(50);

  if (error || !oldEntries || oldEntries.length === 0) return 0;

  // Group by session for coherent summaries
  const bySession = new Map<string, typeof oldEntries>();
  for (const entry of oldEntries) {
    const session = ((entry.context as Record<string, unknown>)?.session as string) ?? "unknown";
    const group = bySession.get(session) ?? [];
    group.push(entry);
    bySession.set(session, group);
  }

  let compressed = 0;

  for (const [session, entries] of bySession) {
    if (entries.length < 2) continue; // Don't compress singleton entries

    const combined = entries.map((e) => e.content).join("\n");
    const summary = `[Consolidated ${entries.length} episodic memories from session ${session}]: ${combined.slice(0, 500)}`;

    const memory = getDrofbotMemory();
    try {
      await memory.episodic.store({
        content: summary,
        context: { session, topic: "consolidated", originalCount: entries.length },
        importance: Math.max(...entries.map((e) => (e.importance as number) ?? 0.5)),
      });

      // Delete originals
      const ids = entries.map((e) => e.id);
      await client.from("memory_episodic").delete().in("id", ids);
      compressed += entries.length;

      log.debug(`Compressed ${entries.length} episodic entries for session ${session}`);
    } catch (err) {
      log.error(
        `Compression failed for session ${session}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return compressed;
}

// ---------------------------------------------------------------------------
// 3. Promotion (episodic patterns → semantic)
// ---------------------------------------------------------------------------

/**
 * Detect recurring patterns in episodic memory and promote them to semantic.
 * If similar content appears in 3+ episodic entries, create a semantic fact.
 */
async function promoteRecurringPatterns(): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;

  const { data: entries, error } = await client
    .from("memory_episodic")
    .select("id, content, embedding")
    .not("embedding", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !entries || entries.length < PROMOTION_MIN_OCCURRENCES) return 0;

  // Group similar entries using embedding similarity
  const clusters: Array<{ content: string; count: number; representatives: string[] }> = [];
  const assigned = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    if (assigned.has(entries[i].id)) continue;
    if (!entries[i].embedding) continue;

    const cluster = {
      content: entries[i].content as string,
      count: 1,
      representatives: [entries[i].id as string],
    };

    for (let j = i + 1; j < entries.length; j++) {
      if (assigned.has(entries[j].id)) continue;
      if (!entries[j].embedding) continue;

      const similarity = cosineSimilarity(
        entries[i].embedding as number[],
        entries[j].embedding as number[],
      );

      // Use a lower threshold for pattern detection (0.8 vs 0.95 for dedup)
      if (similarity >= 0.8) {
        cluster.count++;
        cluster.representatives.push(entries[j].id as string);
        assigned.add(entries[j].id);
      }
    }

    if (cluster.count >= PROMOTION_MIN_OCCURRENCES) {
      clusters.push(cluster);
    }
    assigned.add(entries[i].id);
  }

  let promoted = 0;

  const memory = getDrofbotMemory();
  for (const cluster of clusters) {
    try {
      // Check if we already have this as a semantic memory
      const exists = await memory.semantic.exists(cluster.content);
      if (exists) continue;

      const promotedContent = `[Promoted from ${cluster.count} episodic observations]: ${cluster.content}`;
      await memory.semantic.store({
        content: promotedContent,
        category: "promoted",
        confidence: Math.min(0.6 + cluster.count * 0.05, 0.95),
        source: `consolidation:promotion`,
      });
      promoted++;

      log.debug(
        `Promoted to semantic: "${cluster.content.slice(0, 60)}…" (${cluster.count} occurrences)`,
      );
    } catch (err) {
      log.error(`Promotion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return promoted;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Keep legacy export for compatibility with the stub
export { ConsolidationConfig as ConsolidationJobConfig };
