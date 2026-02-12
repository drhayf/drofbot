/**
 * Structured Memory Integration
 *
 * Bridges the structured memory banks (Supabase) into the core agent runner.
 * Provides helpers for:
 *   1. Pre-fetching structured memory context for system prompt injection
 *   2. Classifying + storing memories after each agent turn (fire-and-forget)
 *   3. Flushing conversation context to episodic memory before compaction
 *
 * All functions gracefully degrade — if Supabase is not configured, they
 * short-circuit with no side effects.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { OpenClawConfig } from "../../shared/config/config.js";
import { isSupabaseConfigured } from "../../shared/database/client.js";
import type { BankName } from "./banks/base.js";
import { MemoryClassifier } from "./classifier.js";
import { getDrofbotMemory } from "./drofbot-memory.js";
import { MemoryRetriever, type RetrievalResult } from "./retriever.js";
import { testExchangeAgainstHypotheses } from "../intelligence/integration.js";
import { analyzeConversationTurn } from "../identity/operator/voice-analyzer.js";
import { calculateConversationXP } from "../progression/conversation-xp.js";
import { getProgressionEngine } from "../progression/tools.js";

const log = createSubsystemLogger("memory/integration");

// ---------------------------------------------------------------------------
// 1. Structured memory context for prompt injection
// ---------------------------------------------------------------------------

/** Max characters for structured memory context injected into the prompt. */
const MAX_STRUCTURED_CONTEXT_CHARS = 3000;

/**
 * Fetch structured memory context relevant to the user's current message.
 * Returns a formatted string suitable for prepending to the user prompt,
 * or null if no relevant memories are found (or Supabase is not configured).
 */
export async function fetchStructuredMemoryContext(
  userMessage: string,
  options: { config?: OpenClawConfig; agentId?: string },
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  if (!userMessage.trim()) return null;

  const memory = getDrofbotMemory();
  if (!memory.isStructuredMemoryAvailable) return null;

  const retriever = new MemoryRetriever(memory);
  const results = await retriever.search({
    query: userMessage,
    maxResults: 10,
    includeRecent: true,
  });

  if (results.length === 0) return null;

  return formatStructuredContext(results);
}

/**
 * Format retrieval results into a structured context block for prompt injection.
 */
function formatStructuredContext(results: RetrievalResult[]): string | null {
  const grouped = MemoryRetriever.groupByBank(results);

  const sections: string[] = [];

  if (grouped.semantic && grouped.semantic.length > 0) {
    sections.push(
      "### Known Facts & Preferences",
      ...grouped.semantic.map((r) => `- ${r.content}`),
    );
  }
  if (grouped.episodic && grouped.episodic.length > 0) {
    sections.push(
      "### Relevant Past Events",
      ...grouped.episodic.map((r) => `- ${r.content}`),
    );
  }
  if (grouped.procedural && grouped.procedural.length > 0) {
    sections.push(
      "### Relevant Procedures",
      ...grouped.procedural.map((r) => `- ${r.content}`),
    );
  }
  if (grouped.relational && grouped.relational.length > 0) {
    sections.push(
      "### Entity Relationships",
      ...grouped.relational.map((r) => `- ${r.content}`),
    );
  }

  if (sections.length === 0) return null;

  let context = `## Memory (Structured)\n${sections.join("\n")}`;

  // Enforce token budget by truncating if necessary
  if (context.length > MAX_STRUCTURED_CONTEXT_CHARS) {
    context = context.slice(0, MAX_STRUCTURED_CONTEXT_CHARS) + "\n[...truncated]";
  }

  return context;
}

// ---------------------------------------------------------------------------
// 2. Post-turn memory classification + storage
// ---------------------------------------------------------------------------

export interface PostTurnContext {
  sessionId: string;
  sessionKey?: string;
  channel?: string;
  config?: OpenClawConfig;
  agentId?: string;
  /** Tool names used during the exchange (from attempt toolMetas). */
  toolsUsed?: string[];
  /** Lifetime conversation count for the operator (for XP milestones). */
  conversationCount?: number;
}

/**
 * Classify a conversation exchange and store resulting memories.
 * This is meant to be called fire-and-forget after the agent's response
 * is delivered (non-blocking).
 */
export async function classifyAndStorePostTurn(
  userMessage: string,
  agentResponse: string,
  context: PostTurnContext,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (!context.config) return;

  const exchange = `User: ${userMessage}\nAssistant: ${agentResponse}`;

  const classifier = new MemoryClassifier();
  const classification = await classifier.classify(exchange, { cfg: context.config });

  // Track which banks were stored to (for XP calculation)
  const memoriesStored: { bank: string }[] = [];

  if (classification.shouldStore) {
    const memory = getDrofbotMemory();

    for (const entry of classification.banks) {
      try {
        await storeByBank(memory, entry.bank, entry.content, entry.metadata, context);
        memoriesStored.push({ bank: entry.bank });
      } catch (err) {
        log.error(
          `Post-turn store failed (${entry.bank}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    log.debug(
      `Post-turn: stored ${memoriesStored.length} memory entries [${memoriesStored.map((b) => b.bank).join(",")}]`,
    );
  } else {
    log.debug("Post-turn: nothing to store.");
  }

  // Test exchange against active hypotheses (awaited so we can capture updates for XP)
  let hypothesisUpdated = false;
  try {
    const updates = await testExchangeAgainstHypotheses(userMessage, agentResponse);
    hypothesisUpdated = updates.length > 0;
  } catch (err) {
    log.error(`Post-turn intelligence hook failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Fire-and-forget: analyze operator voice profile from their message
  // This builds up a profile of communication patterns over time
  analyzeConversationTurn(userMessage).catch((err) => {
    log.error(`Voice analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  // Award conversation XP based on brain engagement depth
  try {
    const xpResult = calculateConversationXP({
      userMessage,
      assistantResponse: agentResponse,
      memoriesStored,
      hypothesisUpdated,
      toolsUsed: context.toolsUsed ?? [],
      conversationCount: context.conversationCount ?? 0,
    });

    if (xpResult.totalXP > 0) {
      const engine = getProgressionEngine();
      if (engine) {
        const reason = xpResult.breakdown.map((b) => `${b.source}:${b.xp}`).join(", ");
        engine.addXP(xpResult.totalXP, `conversation [${reason}]`);
        log.debug(`Post-turn XP: +${xpResult.totalXP} (${reason})`);

        if (xpResult.milestones.length > 0) {
          log.info(`XP milestones: ${xpResult.milestones.join(", ")}`);
        }
      }
    }
  } catch (err) {
    log.error(`Post-turn XP calculation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Compaction memory flush
// ---------------------------------------------------------------------------

export interface CompactionContext {
  sessionId: string;
  sessionKey?: string;
  channel?: string;
}

/**
 * Store a compaction summary in episodic memory so context survives compaction.
 * Called before session.compact() to preserve key conversation context that
 * would otherwise be lost.
 */
export async function flushCompactionMemory(
  summary: string,
  context: CompactionContext,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (!summary.trim()) return;

  const memory = getDrofbotMemory();
  if (!memory.isStructuredMemoryAvailable) return;

  try {
    await memory.episodic.store({
      content: summary,
      context: {
        session: context.sessionId,
        channel: context.channel,
        topic: "compaction_summary",
      },
      importance: 0.7,
    });
    log.debug(`Compaction flush: stored summary for session ${context.sessionId}`);
  } catch (err) {
    log.error(
      `Compaction flush failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function storeByBank(
  memory: ReturnType<typeof getDrofbotMemory>,
  bank: BankName,
  content: string,
  metadata: Record<string, unknown>,
  context: PostTurnContext,
): Promise<void> {
  switch (bank) {
    case "episodic":
      await memory.episodic.store({
        content,
        context: {
          session: context.sessionId,
          channel: context.channel,
          ...(metadata as Record<string, unknown>),
        },
        importance: (metadata.importance as number) ?? 0.5,
      });
      break;

    case "semantic": {
      // Dedup: don't store if we already have a very similar entry
      const exists = await memory.semantic.exists(content);
      if (!exists) {
        await memory.semantic.store({
          content,
          category: (metadata.category as string) ?? "fact",
          confidence: (metadata.confidence as number) ?? 0.8,
          source: `session:${context.sessionId}`,
        });
      } else {
        log.debug(`Semantic dedup: skipping duplicate "${content.slice(0, 60)}…"`);
      }
      break;
    }

    case "procedural":
      await memory.procedural.store({
        content,
        triggerPattern: (metadata.trigger_pattern as string) ?? undefined,
        steps: (metadata.steps as Record<string, unknown>[]) ?? undefined,
      });
      break;

    case "relational":
      await memory.relational.store({
        entityA: (metadata.entity_a as string) ?? "unknown",
        entityB: (metadata.entity_b as string) ?? "unknown",
        relationship: content,
        metadata,
      });
      break;
  }
}
