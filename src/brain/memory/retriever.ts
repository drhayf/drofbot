/**
 * Memory Retriever
 *
 * Cross-bank memory retrieval with relevance scoring. Given a query, determines
 * which bank(s) to search and returns a unified, ranked result set.
 *
 * Uses rule-based routing (no LLM call) — SEMANTIC is always searched,
 * other banks are included based on query heuristics.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { BankName, SearchResult } from "./banks/base.js";
import type { DrofbotMemory } from "./drofbot-memory.js";
import { matchesCosmicFilter, type CosmicFilter, type CosmicSnapshot } from "../council/enrichment.js";

const log = createSubsystemLogger("memory/retriever");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievalResult {
  bank: BankName;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface RetrievalOptions {
  query: string;
  maxResults?: number; // default 15 across all banks
  /** Force specific banks (overrides heuristics) */
  banks?: BankName[];
  /** Include N most recent episodic memories regardless of similarity */
  includeRecent?: boolean;
  /** Filter by cosmic context stored on memories */
  cosmicFilter?: CosmicFilter;
}

// ---------------------------------------------------------------------------
// Routing heuristics
// ---------------------------------------------------------------------------

/** Time-reference patterns → include EPISODIC */
const TIME_PATTERNS =
  /\b(yesterday|last\s+(?:week|month|time|session)|before|when\s+(?:we|I|you)|remember\s+when|previously|earlier|ago|recent(?:ly)?|history)\b/i;

/** How-to patterns → include PROCEDURAL */
const PROCEDURAL_PATTERNS =
  /\b(how\s+(?:to|do\s+I|does|should)|process\s+for|steps?\s+(?:to|for)|workflow|procedure|deploy|build|run|install|setup|configure)\b/i;

/** Relationship patterns → include RELATIONAL */
const RELATIONAL_PATTERNS =
  /\b(depends?\s+on|connect(?:s|ed)?\s+to|related\s+to|relationship|between|uses?|requires?|linked|associated)\b/i;

function routeQuery(query: string, forced?: BankName[]): BankName[] {
  if (forced && forced.length > 0) return forced;

  // SEMANTIC is always included
  const banks = new Set<BankName>(["semantic"]);

  if (TIME_PATTERNS.test(query)) banks.add("episodic");
  if (PROCEDURAL_PATTERNS.test(query)) banks.add("procedural");
  if (RELATIONAL_PATTERNS.test(query)) banks.add("relational");

  return Array.from(banks);
}

// ---------------------------------------------------------------------------
// Retriever
// ---------------------------------------------------------------------------

export class MemoryRetriever {
  private memory: DrofbotMemory;

  constructor(memory: DrofbotMemory) {
    this.memory = memory;
  }

  /**
   * Search across relevant memory banks and return merged, ranked results.
   */
  async search(options: RetrievalOptions): Promise<RetrievalResult[]> {
    if (!this.memory.isStructuredMemoryAvailable) return [];

    const maxResults = options.maxResults ?? 15;
    const banks = routeQuery(options.query, options.banks);
    const perBankLimit = Math.ceil(maxResults / banks.length) + 2; // fetch a few extra for ranking

    log.debug(`Retrieval routing: query="${options.query.slice(0, 80)}" → banks=[${banks.join(",")}]`);

    const allResults: RetrievalResult[] = [];

    // Search in parallel across selected banks
    const searchPromises = banks.map(async (bank) => {
      try {
        const results = await this.searchBank(bank, options.query, perBankLimit);
        return results;
      } catch (err) {
        log.error(`Bank ${bank} search failed: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    });

    const bankResults = await Promise.all(searchPromises);
    for (const results of bankResults) {
      allResults.push(...results);
    }

    // Optionally include recent episodic memories
    if (options.includeRecent && !banks.includes("episodic")) {
      try {
        const recent = await this.memory.episodic.getRecent(3);
        for (const entry of recent) {
          // Avoid duplicates
          if (!allResults.some((r) => r.content === entry.content)) {
            allResults.push({
              bank: "episodic",
              content: entry.content,
              similarity: 0.5, // default for recency-included
              metadata: { ...(entry.context ?? {}), importance: entry.importance },
            });
          }
        }
      } catch (err) {
        log.debug(`Recent episodic fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Sort by similarity descending and truncate
    allResults.sort((a, b) => b.similarity - a.similarity);

    // Apply cosmic filter if specified
    if (options.cosmicFilter) {
      const filtered = allResults.filter((r) => {
        const snapshot = r.metadata?.cosmic as CosmicSnapshot | undefined;
        return matchesCosmicFilter(snapshot, options.cosmicFilter!);
      });
      return filtered.slice(0, maxResults);
    }

    return allResults.slice(0, maxResults);
  }

  /**
   * Search a single bank and convert results to RetrievalResult format.
   */
  private async searchBank(
    bank: BankName,
    query: string,
    limit: number,
  ): Promise<RetrievalResult[]> {
    const searchOptions = { query, limit, threshold: 0.6 };

    switch (bank) {
      case "episodic": {
        const results = await this.memory.episodic.search(searchOptions);
        return results.map((r) => ({
          bank: "episodic" as const,
          content: r.entry.content,
          similarity: r.similarity,
          metadata: { ...(r.entry.context ?? {}), importance: r.entry.importance },
        }));
      }

      case "semantic": {
        const results = await this.memory.semantic.search(searchOptions);
        return results.map((r) => ({
          bank: "semantic" as const,
          content: r.entry.content,
          similarity: r.similarity,
          metadata: {
            category: r.entry.category,
            confidence: r.entry.confidence,
            source: r.entry.source,
          },
        }));
      }

      case "procedural": {
        const results = await this.memory.procedural.search(searchOptions);
        return results.map((r) => ({
          bank: "procedural" as const,
          content: r.entry.content,
          similarity: r.similarity,
          metadata: {
            trigger_pattern: r.entry.trigger_pattern,
            success_count: r.entry.success_count,
          },
        }));
      }

      case "relational": {
        const results = await this.memory.relational.search(searchOptions);
        return results.map((r) => ({
          bank: "relational" as const,
          content: `${r.entry.entity_a} ${r.entry.relationship} ${r.entry.entity_b}`,
          similarity: r.similarity,
          metadata: {
            entity_a: r.entry.entity_a,
            entity_b: r.entry.entity_b,
            relationship: r.entry.relationship,
            ...(r.entry.metadata ?? {}),
          },
        }));
      }

      default:
        return [];
    }
  }

  /**
   * Group results by bank for formatted output.
   */
  static groupByBank(
    results: RetrievalResult[],
  ): Partial<Record<BankName, RetrievalResult[]>> {
    const grouped: Partial<Record<BankName, RetrievalResult[]>> = {};
    for (const r of results) {
      if (!grouped[r.bank]) grouped[r.bank] = [];
      grouped[r.bank]!.push(r);
    }
    return grouped;
  }
}
