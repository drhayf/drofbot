/**
 * OpenRouter Model Registry
 *
 * Fetches available models from OpenRouter's /api/v1/models endpoint,
 * caches the result in memory (refreshes every 6 hours or on demand),
 * and exposes a typed API for querying available models.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("model-registry");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string; // cost per token as string, e.g. "0.000003"
    completion: string;
  };
  context_length: number;
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
  };
}

export interface ModelRegistryEntry {
  id: string;
  name: string;
  promptPrice: number; // per million tokens
  completionPrice: number; // per million tokens
  contextLength: number;
  provider: string; // extracted from id, e.g. "anthropic" from "anthropic/claude-3-opus"
  maxCompletionTokens?: number;
}

interface CacheState {
  models: ModelRegistryEntry[];
  fetchedAt: number;
  inFlight?: Promise<ModelRegistryEntry[]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache: CacheState = {
  models: [],
  fetchedAt: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseModel(raw: OpenRouterModel): ModelRegistryEntry {
  const slashIdx = raw.id.indexOf("/");
  const provider = slashIdx > 0 ? raw.id.slice(0, slashIdx) : "unknown";

  return {
    id: raw.id,
    name: raw.name,
    promptPrice: parseFloat(raw.pricing.prompt) * 1_000_000,
    completionPrice: parseFloat(raw.pricing.completion) * 1_000_000,
    contextLength: raw.context_length,
    provider,
    maxCompletionTokens: raw.top_provider?.max_completion_tokens,
  };
}

function isCacheValid(): boolean {
  return cache.models.length > 0 && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch models from OpenRouter. Uses cache if still valid.
 * Pass `force: true` to bypass cache.
 */
export async function fetchModels(options?: {
  apiKey?: string;
  force?: boolean;
}): Promise<ModelRegistryEntry[]> {
  const force = options?.force ?? false;

  if (!force && isCacheValid()) {
    return cache.models;
  }

  // Deduplicate concurrent fetches
  if (cache.inFlight) {
    return cache.inFlight;
  }

  const apiKey =
    options?.apiKey || process.env.DROFBOT_LLM_API_KEY || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    log.warn("No API key available for OpenRouter model registry");
    return cache.models; // return stale cache if any
  }

  cache.inFlight = (async () => {
    try {
      log.debug("Fetching models from OpenRouter...");
      const res = await fetch(OPENROUTER_MODELS_URL, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://drofbot.ai",
          "X-Title": "Drofbot",
        },
      });

      if (!res.ok) {
        log.error(`OpenRouter API error: ${res.status} ${res.statusText}`);
        return cache.models; // return stale cache
      }

      const body = (await res.json()) as { data?: OpenRouterModel[] };
      const rawModels = body.data ?? [];
      const models = rawModels.map(parseModel);

      cache.models = models;
      cache.fetchedAt = Date.now();
      log.debug(`Cached ${models.length} models from OpenRouter`);

      return models;
    } catch (err) {
      log.error(
        `Failed to fetch OpenRouter models: ${err instanceof Error ? err.message : String(err)}`,
      );
      return cache.models; // return stale cache
    } finally {
      cache.inFlight = undefined;
    }
  })();

  return cache.inFlight;
}

/**
 * Look up a single model by its ID (e.g. "anthropic/claude-sonnet-4-5-20250929").
 * Returns undefined if not found in the registry.
 */
export async function findModel(
  modelId: string,
  options?: { apiKey?: string },
): Promise<ModelRegistryEntry | undefined> {
  const models = await fetchModels(options);
  return models.find((m) => m.id === modelId);
}

/**
 * Search models by partial name or ID match.
 */
export async function searchModels(
  query: string,
  options?: { apiKey?: string },
): Promise<ModelRegistryEntry[]> {
  const models = await fetchModels(options);
  const q = query.toLowerCase();
  return models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
}

/**
 * Force refresh the model cache, returning the updated models.
 */
export async function refreshModels(options?: { apiKey?: string }): Promise<ModelRegistryEntry[]> {
  return fetchModels({ ...options, force: true });
}

/**
 * Get the current cache state (for diagnostics / API responses).
 */
export function getCacheInfo(): { count: number; fetchedAt: number; stale: boolean } {
  return {
    count: cache.models.length,
    fetchedAt: cache.fetchedAt,
    stale: !isCacheValid(),
  };
}

/**
 * Format pricing for display, e.g. "$3.00 / $15.00 per million tokens"
 */
export function formatPricing(model: ModelRegistryEntry): string {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  return `${fmt(model.promptPrice)} / ${fmt(model.completionPrice)} per million tokens`;
}

/**
 * Reset cache (for testing).
 */
export function resetRegistryCache(): void {
  cache.models = [];
  cache.fetchedAt = 0;
  cache.inFlight = undefined;
}
