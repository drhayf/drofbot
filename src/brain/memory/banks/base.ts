/**
 * Base utilities for memory bank operations.
 * All four banks share: Supabase operations, embedding generation, graceful degradation.
 *
 * The structured memory banks are an enhancement layer on top of the existing
 * QMD/markdown memory. When Supabase is not configured, operations return empty
 * results and do not throw.
 */

import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../../shared/database/client.js";
import type { EmbeddingProvider } from "../embeddings.js";

const log = createSubsystemLogger("memory/banks");

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface StoreOptions {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  query: string;
  embedding?: number[]; // pre-computed; generated if omitted
  limit?: number; // default 10
  threshold?: number; // cosine similarity threshold, default 0.7
}

export interface SearchResult<T> {
  entry: T;
  similarity: number;
}

export type BankName = "episodic" | "semantic" | "procedural" | "relational";

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

/**
 * Check if Supabase is available. When false, log a warning once and return false.
 * Callers should return empty/no-op results.
 */
let _warnedUnavailable = false;

export function requireSupabase(): boolean {
  if (isSupabaseConfigured()) return true;
  if (!_warnedUnavailable) {
    log.warn(
      "Supabase not configured — structured memory banks unavailable. QMD memory still active.",
    );
    _warnedUnavailable = true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Base memory bank
// ---------------------------------------------------------------------------

/**
 * Abstract base for all four memory banks. Provides shared helpers for
 * embedding generation and Supabase access. Subclasses implement bank-specific
 * store/search/query logic.
 */
export abstract class BaseMemoryBank {
  protected readonly bankName: BankName;
  protected readonly log: ReturnType<typeof createSubsystemLogger>;
  private embeddingProvider: EmbeddingProvider | null = null;

  constructor(bankName: BankName) {
    this.bankName = bankName;
    this.log = createSubsystemLogger(`memory/banks/${bankName}`);
  }

  /** Inject the embedding provider (set once by DrofbotMemory after creation). */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  /** Generate an embedding vector for a text string. Returns [] if no provider. */
  protected async embed(text: string): Promise<number[]> {
    if (!this.embeddingProvider) {
      this.log.warn("No embedding provider available — storing without embedding.");
      return [];
    }
    try {
      return await this.embeddingProvider.embedQuery(text);
    } catch (err) {
      this.log.error(`Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /** Get the Supabase client. Returns null if not configured. */
  protected getClient() {
    if (!requireSupabase()) return null;
    try {
      return getSupabaseClient();
    } catch (err) {
      this.log.error(`Supabase client error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
