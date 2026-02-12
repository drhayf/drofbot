/**
 * Unified memory interface for the Drofbot Brain.
 * Provides access to all four memory banks and the existing QMD system.
 *
 * Structured memory (Supabase) is an enhancement layer — when Supabase is not
 * configured, `isStructuredMemoryAvailable` is false and bank operations
 * gracefully return empty results.
 */

import type { OpenClawConfig } from "../../shared/config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { isSupabaseConfigured } from "../../shared/database/client.js";
import { resolveSessionAgentId } from "../agent-runner/agent-scope.js";
import { resolveMemorySearchConfig } from "../agent-runner/memory-search.js";
import { createEmbeddingProvider, type EmbeddingProvider } from "./embeddings.js";
import { EpisodicMemoryBank } from "./banks/episodic.js";
import { SemanticMemoryBank } from "./banks/semantic.js";
import { ProceduralMemoryBank } from "./banks/procedural.js";
import { RelationalMemoryBank } from "./banks/relational.js";

const log = createSubsystemLogger("memory");

export class DrofbotMemory {
  readonly episodic: EpisodicMemoryBank;
  readonly semantic: SemanticMemoryBank;
  readonly procedural: ProceduralMemoryBank;
  readonly relational: RelationalMemoryBank;
  readonly isStructuredMemoryAvailable: boolean;

  constructor() {
    this.isStructuredMemoryAvailable = isSupabaseConfigured();
    this.episodic = new EpisodicMemoryBank();
    this.semantic = new SemanticMemoryBank();
    this.procedural = new ProceduralMemoryBank();
    this.relational = new RelationalMemoryBank();

    if (this.isStructuredMemoryAvailable) {
      log.info("Structured memory banks initialized (Supabase configured).");
    } else {
      log.debug("Structured memory banks inactive — Supabase not configured. QMD memory active.");
    }
  }

  /**
   * Inject the embedding provider into all banks.
   * Call this after creating the DrofbotMemory once an embedding provider is available.
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.episodic.setEmbeddingProvider(provider);
    this.semantic.setEmbeddingProvider(provider);
    this.procedural.setEmbeddingProvider(provider);
    this.relational.setEmbeddingProvider(provider);
    log.debug(`Embedding provider set: ${provider.id} (${provider.model})`);
  }
}

// Singleton
let _instance: DrofbotMemory | null = null;

export function getDrofbotMemory(): DrofbotMemory {
  if (!_instance) {
    _instance = new DrofbotMemory();
  }
  return _instance;
}

/** Reset the singleton (for testing). */
export function resetDrofbotMemory(): void {
  _instance = null;
}

// ---------------------------------------------------------------------------
// Startup wiring — auto-detect the embedding provider from config and inject
// into the structured memory banks so vector search works out of the box.
// ---------------------------------------------------------------------------

let _embeddingInitialized = false;

/**
 * Initialize the embedding provider for structured memory banks.
 *
 * Uses the **same** embedding config that the existing QMD memory-search system
 * reads from `agents.defaults.memorySearch.*`. This means structured memory
 * embeddings always stay in sync with the QMD provider — no duplicate config.
 *
 * Safe to call multiple times; only the first successful call wires the provider.
 * Gracefully no-ops when Supabase is not configured or when no embedding provider
 * is available (QMD-only setups, missing API keys, etc.).
 */
export async function initStructuredMemoryEmbeddings(cfg: OpenClawConfig): Promise<void> {
  if (_embeddingInitialized) return;
  if (!isSupabaseConfigured()) {
    log.debug("Skipping structured memory embedding init — Supabase not configured.");
    return;
  }

  const agentId = resolveSessionAgentId({ config: cfg });
  const settings = resolveMemorySearchConfig(cfg, agentId);
  if (!settings) {
    log.debug("Skipping structured memory embedding init — memory search not configured.");
    return;
  }

  try {
    const result = await createEmbeddingProvider({
      config: cfg,
      provider: settings.provider ?? "auto",
      remote: settings.remote,
      model: settings.model,
      fallback: settings.fallback ?? "none",
      local: settings.local,
    });

    getDrofbotMemory().setEmbeddingProvider(result.provider);
    _embeddingInitialized = true;

    const fallbackNote = result.fallbackFrom
      ? ` (fallback from ${result.fallbackFrom}: ${result.fallbackReason})`
      : "";
    log.info(
      `Structured memory embedding provider ready: ${result.provider.id}/${result.provider.model}${fallbackNote}`,
    );
  } catch (err) {
    log.warn(
      `Structured memory embedding init failed — memories will store without embeddings: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Reset embedding init flag (for testing). */
export function resetEmbeddingInit(): void {
  _embeddingInitialized = false;
}
