/**
 * Episodic Memory Bank
 *
 * Stores timestamped events, experiences, decisions, and conversation context.
 * The agent's "autobiography" — what happened, when, and in what context.
 */

import type { MemoryEpisodic, MemoryEpisodicInsert } from "../../../shared/database/schema.js";
import { BaseMemoryBank, type SearchOptions, type SearchResult } from "./base.js";
import { enrichWithCosmic, matchesCosmicFilter, type CosmicFilter } from "../../council/enrichment.js";

export interface EpisodicContext {
  session?: string;
  channel?: string;
  topic?: string;
  participants?: string[];
  decision?: boolean;
  [key: string]: unknown;
}

export interface EpisodicStoreOptions {
  content: string;
  context?: EpisodicContext;
  importance?: number;
  timestamp?: string;
}

export interface EpisodicSearchOptions extends SearchOptions {
  /** ISO date string — only return memories after this time */
  after?: string;
  /** ISO date string — only return memories before this time */
  before?: string;
  /** Filter by channel */
  channel?: string;
}

export class EpisodicMemoryBank extends BaseMemoryBank {
  constructor() {
    super("episodic");
  }

  /**
   * Store a new episodic memory, enriched with cosmic timestamp.
   */
  async store(options: EpisodicStoreOptions): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const embedding = await this.embed(options.content);

    // Enrich context with cosmic snapshot (graceful — does nothing if Council is off)
    const enrichedContext = (await enrichWithCosmic(options.context)) as EpisodicContext;

    const row: MemoryEpisodicInsert = {
      content: options.content,
      embedding: embedding.length > 0 ? embedding : undefined,
      timestamp: options.timestamp ?? new Date().toISOString(),
      context: enrichedContext,
      importance: options.importance ?? 0.5,
    };

    const { data, error } = await client.from("memory_episodic").insert(row).select("id").single();

    if (error) {
      this.log.error(`Failed to store episodic memory: ${error.message}`);
      return null;
    }

    this.log.debug(`Stored episodic memory: ${data.id}`);
    return data.id;
  }

  /**
   * Vector similarity search with optional time range and channel filtering.
   */
  async search(options: EpisodicSearchOptions): Promise<SearchResult<MemoryEpisodic>[]> {
    const client = this.getClient();
    if (!client) return [];

    const limit = options.limit ?? 10;
    const threshold = options.threshold ?? 0.7;
    const embedding = options.embedding ?? (await this.embed(options.query));

    if (embedding.length === 0) {
      // Fall back to text search if no embedding available
      return this.searchByText(options.query, limit);
    }

    // Use Supabase RPC for vector similarity search
    // pgvector cosine distance: 1 - (a <=> b) gives similarity
    let query = client
      .rpc("match_episodic_memories", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      });

    // If RPC is not set up, fall back to client-side filtering
    const { data, error } = await query;

    if (error) {
      // RPC may not exist yet — fall back to basic query
      this.log.debug(`RPC fallback: ${error.message}`);
      return this.searchFallback(embedding, options, limit, threshold);
    }

    return (data ?? []).map((row: MemoryEpisodic & { similarity: number }) => ({
      entry: row,
      similarity: row.similarity,
    }));
  }

  /**
   * Fallback search: fetch recent entries and compute similarity client-side.
   */
  private async searchFallback(
    queryEmbedding: number[],
    options: EpisodicSearchOptions,
    limit: number,
    threshold: number,
  ): Promise<SearchResult<MemoryEpisodic>[]> {
    const client = this.getClient();
    if (!client) return [];

    let query = client
      .from("memory_episodic")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit * 3); // fetch more for filtering

    if (options.after) {
      query = query.gte("timestamp", options.after);
    }
    if (options.before) {
      query = query.lte("timestamp", options.before);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return this.rankBySimilarity(data as MemoryEpisodic[], queryEmbedding, threshold, limit, options.channel);
  }

  /**
   * Simple text-based search (no embeddings available).
   */
  private async searchByText(
    query: string,
    limit: number,
  ): Promise<SearchResult<MemoryEpisodic>[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_episodic")
      .select("*")
      .ilike("content", `%${query}%`)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as MemoryEpisodic[]).map((entry) => ({
      entry,
      similarity: 0.5, // unknown similarity for text search
    }));
  }

  /**
   * Get N most recent episodic memories, optionally within a time range.
   */
  async getRecent(n: number, options?: { after?: string; before?: string }): Promise<MemoryEpisodic[]> {
    const client = this.getClient();
    if (!client) return [];

    let query = client
      .from("memory_episodic")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(n);

    if (options?.after) {
      query = query.gte("timestamp", options.after);
    }
    if (options?.before) {
      query = query.lte("timestamp", options.before);
    }

    const { data, error } = await query;
    if (error) {
      this.log.error(`Failed to get recent memories: ${error.message}`);
      return [];
    }

    return (data ?? []) as MemoryEpisodic[];
  }

  /**
   * Get all memories from a specific session.
   */
  async getBySession(sessionId: string): Promise<MemoryEpisodic[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_episodic")
      .select("*")
      .contains("context", { session: sessionId })
      .order("timestamp", { ascending: true });

    if (error) {
      this.log.error(`Failed to get session memories: ${error.message}`);
      return [];
    }

    return (data ?? []) as MemoryEpisodic[];
  }

  /**
   * Update the importance score of a memory (used by consolidation).
   */
  async updateImportance(id: string, importance: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const { error } = await client
      .from("memory_episodic")
      .update({ importance, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      this.log.error(`Failed to update importance: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Rank entries by cosine similarity to a query embedding.
   * Used as a client-side fallback when pgvector RPC is unavailable.
   */
  private rankBySimilarity(
    entries: MemoryEpisodic[],
    queryEmbedding: number[],
    threshold: number,
    limit: number,
    channel?: string,
  ): SearchResult<MemoryEpisodic>[] {
    const results: SearchResult<MemoryEpisodic>[] = [];

    for (const entry of entries) {
      if (channel && entry.context?.channel !== channel) continue;
      if (!entry.embedding || entry.embedding.length === 0) continue;

      const similarity = cosine(queryEmbedding, entry.embedding);
      if (similarity >= threshold) {
        results.push({ entry, similarity });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
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
