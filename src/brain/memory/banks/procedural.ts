/**
 * Procedural Memory Bank
 *
 * Stores learned workflows, habits, and multi-step procedures.
 * The agent's "muscle memory" — how to do things, optimised over time
 * through success/failure tracking.
 */

import type { MemoryProcedural, MemoryProceduralInsert } from "../../../shared/database/schema.js";
import { BaseMemoryBank, type SearchOptions, type SearchResult } from "./base.js";
import { enrichWithCosmic } from "../../council/enrichment.js";

export interface ProceduralStoreOptions {
  content: string;
  triggerPattern?: string;
  steps?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface ProceduralSearchOptions extends SearchOptions {
  /** Filter by trigger pattern (substring match) */
  triggerPattern?: string;
}

export class ProceduralMemoryBank extends BaseMemoryBank {
  constructor() {
    super("procedural");
  }

  /**
   * Store a procedure with its trigger and optional structured steps.
   */
  async store(options: ProceduralStoreOptions): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const embedding = await this.embed(options.content);
    const enrichedMetadata = await enrichWithCosmic(options.metadata);

    const row: MemoryProceduralInsert = {
      content: options.content,
      embedding: embedding.length > 0 ? embedding : undefined,
      trigger_pattern: options.triggerPattern,
      steps: options.steps,
      metadata: enrichedMetadata,
    };

    const { data, error } = await client
      .from("memory_procedural")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      this.log.error(`Failed to store procedural memory: ${error.message}`);
      return null;
    }

    this.log.debug(`Stored procedural memory: ${data.id}`);
    return data.id;
  }

  /**
   * Vector similarity search for matching procedures.
   */
  async search(options: ProceduralSearchOptions): Promise<SearchResult<MemoryProcedural>[]> {
    const client = this.getClient();
    if (!client) return [];

    const limit = options.limit ?? 10;
    const threshold = options.threshold ?? 0.7;
    const embedding = options.embedding ?? (await this.embed(options.query));

    if (embedding.length === 0) {
      return this.searchByText(options.query, limit);
    }

    // Attempt RPC
    const { data, error } = await client.rpc("match_procedural_memories", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      this.log.debug(`RPC fallback: ${error.message}`);
      return this.searchFallback(embedding, limit, threshold);
    }

    return (data ?? []).map((row: MemoryProcedural & { similarity: number }) => ({
      entry: row,
      similarity: row.similarity,
    }));
  }

  /**
   * Fall back to client-side similarity ranking.
   */
  private async searchFallback(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
  ): Promise<SearchResult<MemoryProcedural>[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_procedural")
      .select("*")
      .order("success_count", { ascending: false })
      .limit(limit * 3);

    if (error || !data) return [];

    return rankBySimilarity(data as MemoryProcedural[], queryEmbedding, threshold, limit);
  }

  /**
   * Text-based search fallback.
   */
  private async searchByText(
    query: string,
    limit: number,
  ): Promise<SearchResult<MemoryProcedural>[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_procedural")
      .select("*")
      .or(`content.ilike.%${query}%,trigger_pattern.ilike.%${query}%`)
      .order("success_count", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as MemoryProcedural[]).map((entry) => ({
      entry,
      similarity: 0.5,
    }));
  }

  /**
   * Find procedures matching a trigger pattern (substring).
   */
  async getByTrigger(pattern: string): Promise<MemoryProcedural[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_procedural")
      .select("*")
      .ilike("trigger_pattern", `%${pattern}%`)
      .order("success_count", { ascending: false });

    if (error) {
      this.log.error(`Failed to get by trigger: ${error.message}`);
      return [];
    }

    return (data ?? []) as MemoryProcedural[];
  }

  /**
   * Increment success_count and update last_used.
   * Procedures that work get reinforced.
   */
  async recordUsage(id: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    // Fetch current count first
    const { data: current, error: fetchError } = await client
      .from("memory_procedural")
      .select("success_count")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      this.log.error(`Failed to fetch procedure for usage update: ${fetchError?.message}`);
      return false;
    }

    const { error } = await client
      .from("memory_procedural")
      .update({
        success_count: (current.success_count ?? 0) + 1,
        last_used: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      this.log.error(`Failed to record usage: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Get the N most frequently used procedures.
   */
  async getMostUsed(n: number): Promise<MemoryProcedural[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_procedural")
      .select("*")
      .order("success_count", { ascending: false })
      .limit(n);

    if (error) {
      this.log.error(`Failed to get most used: ${error.message}`);
      return [];
    }

    return (data ?? []) as MemoryProcedural[];
  }
}

/** Cosine similarity between two vectors. */
function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom < 1e-10 ? 0 : dot / denom;
}

/** Rank entries by cosine similarity. */
function rankBySimilarity<T extends { embedding?: number[] }>(
  entries: T[],
  queryEmbedding: number[],
  threshold: number,
  limit: number,
): SearchResult<T>[] {
  const results: SearchResult<T>[] = [];

  for (const entry of entries) {
    if (!entry.embedding || entry.embedding.length === 0) continue;
    const similarity = cosine(queryEmbedding, entry.embedding);
    if (similarity >= threshold) {
      results.push({ entry, similarity });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}
