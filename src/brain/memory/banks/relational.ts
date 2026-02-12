/**
 * Relational Memory Bank
 *
 * Stores entity relationship graphs — who/what is connected to who/what and how.
 * Powers the agent's social and contextual understanding.
 */

import type { MemoryRelational, MemoryRelationalInsert } from "../../../shared/database/schema.js";
import { BaseMemoryBank, type SearchOptions, type SearchResult } from "./base.js";
import { enrichWithCosmic } from "../../council/enrichment.js";

export interface RelationalStoreOptions {
  entityA: string;
  entityB: string;
  relationship: string;
  metadata?: Record<string, unknown>;
}

export class RelationalMemoryBank extends BaseMemoryBank {
  constructor() {
    super("relational");
  }

  /**
   * Store a relationship between two entities, enriched with cosmic timestamp.
   */
  async store(options: RelationalStoreOptions): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    // Build a descriptive text for embedding: "entityA relationship entityB"
    const description = `${options.entityA} ${options.relationship} ${options.entityB}`;
    const embedding = await this.embed(description);

    // Enrich metadata with cosmic snapshot
    const enrichedMetadata = await enrichWithCosmic(options.metadata);

    const row: MemoryRelationalInsert = {
      entity_a: options.entityA,
      entity_b: options.entityB,
      relationship: options.relationship,
      embedding: embedding.length > 0 ? embedding : undefined,
      metadata: enrichedMetadata,
    };

    const { data, error } = await client
      .from("memory_relational")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      this.log.error(`Failed to store relational memory: ${error.message}`);
      return null;
    }

    this.log.debug(`Stored relational memory: ${data.id} (${description})`);
    return data.id;
  }

  /**
   * Vector similarity search across relationship descriptions.
   */
  async search(options: SearchOptions): Promise<SearchResult<MemoryRelational>[]> {
    const client = this.getClient();
    if (!client) return [];

    const limit = options.limit ?? 10;
    const threshold = options.threshold ?? 0.7;
    const embedding = options.embedding ?? (await this.embed(options.query));

    if (embedding.length === 0) {
      return this.searchByText(options.query, limit);
    }

    // Attempt RPC
    const { data, error } = await client.rpc("match_relational_memories", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      this.log.debug(`RPC fallback: ${error.message}`);
      return this.searchFallback(embedding, limit, threshold);
    }

    return (data ?? []).map((row: MemoryRelational & { similarity: number }) => ({
      entry: row,
      similarity: row.similarity,
    }));
  }

  /**
   * Fallback: fetch and rank client-side.
   */
  private async searchFallback(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
  ): Promise<SearchResult<MemoryRelational>[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_relational")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit * 3);

    if (error || !data) return [];

    return rankBySimilarity(data as MemoryRelational[], queryEmbedding, threshold, limit);
  }

  /**
   * Text-based search fallback.
   */
  private async searchByText(
    query: string,
    limit: number,
  ): Promise<SearchResult<MemoryRelational>[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_relational")
      .select("*")
      .or(
        `entity_a.ilike.%${query}%,entity_b.ilike.%${query}%,relationship.ilike.%${query}%`,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as MemoryRelational[]).map((entry) => ({
      entry,
      similarity: 0.5,
    }));
  }

  /**
   * Get all relationships involving a specific entity (as either A or B).
   */
  async getRelationships(entity: string): Promise<MemoryRelational[]> {
    const client = this.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("memory_relational")
      .select("*")
      .or(`entity_a.ilike.%${entity}%,entity_b.ilike.%${entity}%`)
      .order("created_at", { ascending: false });

    if (error) {
      this.log.error(`Failed to get relationships: ${error.message}`);
      return [];
    }

    return (data ?? []) as MemoryRelational[];
  }

  /**
   * Graph traversal: get entities connected to an entity, optionally N levels deep.
   */
  async getConnected(entity: string, depth: number = 1): Promise<MemoryRelational[]> {
    const client = this.getClient();
    if (!client) return [];

    const visited = new Set<string>();
    const results: MemoryRelational[] = [];
    let frontier = [entity];

    for (let level = 0; level < depth && frontier.length > 0; level++) {
      const nextFrontier: string[] = [];

      for (const e of frontier) {
        if (visited.has(e)) continue;
        visited.add(e);

        const relationships = await this.getRelationships(e);
        for (const rel of relationships) {
          if (!results.some((r) => r.id === rel.id)) {
            results.push(rel);
          }
          // Add the other entity to the frontier
          const otherEntity =
            rel.entity_a.toLowerCase() === e.toLowerCase() ? rel.entity_b : rel.entity_a;
          if (!visited.has(otherEntity)) {
            nextFrontier.push(otherEntity);
          }
        }
      }

      frontier = nextFrontier;
    }

    return results;
  }

  /**
   * Check if a specific relationship already exists.
   */
  async exists(entityA: string, entityB: string, relationship: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    // Check both directions (A→B and B→A)
    const { data, error } = await client
      .from("memory_relational")
      .select("id")
      .or(
        `and(entity_a.ilike.${entityA},entity_b.ilike.${entityB},relationship.ilike.${relationship}),` +
        `and(entity_a.ilike.${entityB},entity_b.ilike.${entityA},relationship.ilike.${relationship})`,
      )
      .limit(1);

    if (error) {
      this.log.error(`Failed to check existence: ${error.message}`);
      return false;
    }

    return (data?.length ?? 0) > 0;
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
