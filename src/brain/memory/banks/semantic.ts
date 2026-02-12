/**
 * Semantic Memory Bank
 *
 * Stores distilled facts, user preferences, knowledge, and beliefs.
 * The agent knows things without remembering the exact moment they were learned.
 */

import type { MemorySemantic, MemorySemanticInsert } from "../../../shared/database/schema.js";
import { BaseMemoryBank, type SearchOptions, type SearchResult } from "./base.js";
import { enrichWithCosmic } from "../../council/enrichment.js";

export type SemanticCategory = "preference" | "fact" | "knowledge" | "identity";

export interface SemanticStoreOptions {
  content: string;
  category?: SemanticCategory | string;
  confidence?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SemanticSearchOptions extends SearchOptions {
  /** Filter by category */
  category?: SemanticCategory | string;
}

export class SemanticMemoryBank extends BaseMemoryBank {
  constructor() {
    super("semantic");
  }

  /**
   * Store a fact/preference with category and confidence.
   */
  async store(options: SemanticStoreOptions): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const embedding = await this.embed(options.content);
    const enrichedMetadata = await enrichWithCosmic(options.metadata);

    const row: MemorySemanticInsert = {
      content: options.content,
      embedding: embedding.length > 0 ? embedding : undefined,
      category: options.category,
      confidence: options.confidence ?? 0.8,
      source: options.source,
      metadata: enrichedMetadata,
    };

    const { data, error } = await client.from("memory_semantic").insert(row).select("id").single();

    if (error) {
      this.log.error(`Failed to store semantic memory: ${error.message}`);
      return null;
    }

    this.log.debug(`Stored semantic memory: ${data.id} [${options.category ?? "uncategorized"}]`);
    return data.id;
  }

  /**
   * Vector similarity search, optionally filtered by category.
   */
  async search(options: SemanticSearchOptions): Promise<SearchResult<MemorySemantic>[]> {
    const client = this.getClient();
    if (!client) return [];

    const limit = options.limit ?? 10;
    const threshold = options.threshold ?? 0.7;
    const embedding = options.embedding ?? (await this.embed(options.query));

    if (embedding.length === 0) {
      return this.searchByText(options.query, limit, options.category);
    }

    // Attempt RPC first
    const { data, error } = await client.rpc("match_semantic_memories", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_category: options.category ?? null,
    });

    if (error) {
      this.log.debug(`RPC fallback: ${error.message}`);
      return this.searchFallback(embedding, limit, threshold, options.category);
    }

    return (data ?? []).map((row: MemorySemantic & { similarity: number }) => ({
      entry: row,
      similarity: row.similarity,
    }));
  }

  /**
   * Fallback: fetch entries and rank client-side.
   */
  private async searchFallback(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
    category?: string,
  ): Promise<SearchResult<MemorySemantic>[]> {
    const client = this.getClient();
    if (!client) return [];

    let query = client
      .from("memory_semantic")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit * 3);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return rankBySimilarity(data as MemorySemantic[], queryEmbedding, threshold, limit);
  }

  /**
   * Text-based search fallback.
   */
  private async searchByText(
    query: string,
    limit: number,
    category?: string,
  ): Promise<SearchResult<MemorySemantic>[]> {
    const client = this.getClient();
    if (!client) return [];

    let q = client
      .from("memory_semantic")
      .select("*")
      .ilike("content", `%${query}%`)
      .order("confidence", { ascending: false })
      .limit(limit);

    if (category) {
      q = q.eq("category", category);
    }

    const { data, error } = await q;
    if (error || !data) return [];

    return (data as MemorySemantic[]).map((entry) => ({
      entry,
      similarity: 0.5,
    }));
  }

  /**
   * Get all memories of a specific category.
   */
  async getByCategory(category: SemanticCategory | string): Promise<MemorySemantic[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_semantic")
      .select("*")
      .eq("category", category)
      .order("confidence", { ascending: false });

    if (error) {
      this.log.error(`Failed to get by category: ${error.message}`);
      return [];
    }

    return (data ?? []) as MemorySemantic[];
  }

  /**
   * Adjust confidence as facts are confirmed or contradicted.
   */
  async updateConfidence(id: string, confidence: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const { error } = await client
      .from("memory_semantic")
      .update({ confidence, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      this.log.error(`Failed to update confidence: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Check if a similar fact already exists (dedup via embedding similarity).
   * Returns true if an entry with ≥0.92 similarity exists.
   */
  async exists(content: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const embedding = await this.embed(content);
    if (embedding.length === 0) {
      // Fall back to exact text match
      const { data } = await client
        .from("memory_semantic")
        .select("id")
        .eq("content", content)
        .limit(1);
      return (data?.length ?? 0) > 0;
    }

    // Try RPC
    const { data, error } = await client.rpc("match_semantic_memories", {
      query_embedding: embedding,
      match_threshold: 0.92,
      match_count: 1,
      filter_category: null,
    });

    if (error) {
      // RPC unavailable — fall back to fetching and comparing
      return this.existsFallback(embedding);
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Fallback existence check: fetch recent and compare client-side.
   */
  private async existsFallback(queryEmbedding: number[]): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const { data } = await client
      .from("memory_semantic")
      .select("embedding")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!data) return false;

    for (const row of data as { embedding?: number[] }[]) {
      if (row.embedding && cosine(queryEmbedding, row.embedding) >= 0.92) {
        return true;
      }
    }
    return false;
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
