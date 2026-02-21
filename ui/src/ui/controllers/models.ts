/**
 * Models Controller
 *
 * Handles fetching and caching the model catalog from the gateway.
 * The model catalog contains all available models from all providers,
 * with metadata like context window, vision support, and reasoning capabilities.
 */

import type { GatewayBrowserClient } from "../gateway.ts";

/**
 * Model catalog entry from the gateway.
 * Matches the structure from src/brain/agent-runner/model-catalog.ts
 */
export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
};

/**
 * Model catalog result from the gateway.
 */
export type ModelCatalogResult = {
  models: ModelCatalogEntry[];
};

/**
 * Models grouped by provider for UI display.
 */
export type ModelsByProvider = Map<string, ModelCatalogEntry[]>;

/**
 * State for the models controller.
 */
export type ModelsState = {
  modelsLoading: boolean;
  modelsError: string | null;
  modelsCatalog: ModelCatalogEntry[];
  modelsByProvider: ModelsByProvider;
  modelsLastFetch: number | null;
};

/**
 * Create initial models state.
 */
export function createModelsState(): ModelsState {
  return {
    modelsLoading: false,
    modelsError: null,
    modelsCatalog: [],
    modelsByProvider: new Map(),
    modelsLastFetch: null,
  };
}

/**
 * Fetch the model catalog from the gateway.
 */
export async function loadModels(
  state: ModelsState & { client: GatewayBrowserClient | null },
  opts?: { forceRefresh?: boolean },
): Promise<void> {
  if (!state.client) {
    state.modelsError = "Not connected to gateway";
    return;
  }

  // Skip if already loading
  if (state.modelsLoading) {
    return;
  }

  // Skip if recently fetched (within 30 seconds) unless force refresh
  const now = Date.now();
  if (
    !opts?.forceRefresh &&
    state.modelsLastFetch &&
    now - state.modelsLastFetch < 30000 &&
    state.modelsCatalog.length > 0
  ) {
    return;
  }

  state.modelsLoading = true;
  state.modelsError = null;

  try {
    const result = await state.client.request<ModelCatalogResult>("models.list", {});
    state.modelsCatalog = result?.models ?? [];
    state.modelsByProvider = groupModelsByProvider(state.modelsCatalog);
    state.modelsLastFetch = now;
  } catch (err) {
    state.modelsError = String(err);
  } finally {
    state.modelsLoading = false;
  }
}

/**
 * Group models by provider for UI display.
 */
export function groupModelsByProvider(models: ModelCatalogEntry[]): ModelsByProvider {
  const grouped = new Map<string, ModelCatalogEntry[]>();
  for (const model of models) {
    const provider = model.provider || "unknown";
    const existing = grouped.get(provider) ?? [];
    existing.push(model);
    grouped.set(provider, existing);
  }
  // Sort each provider's models by name
  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

/**
 * Filter models by search query.
 */
export function filterModels(models: ModelCatalogEntry[], query: string): ModelCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return models;
  }
  return models.filter(
    (model) =>
      model.name.toLowerCase().includes(normalized) ||
      model.id.toLowerCase().includes(normalized) ||
      model.provider.toLowerCase().includes(normalized),
  );
}

/**
 * Format context window size for display.
 */
export function formatContextWindow(contextWindow?: number): string {
  if (!contextWindow) {
    return "-";
  }
  if (contextWindow >= 1_000_000) {
    return `${(contextWindow / 1_000_000).toFixed(1)}M`;
  }
  if (contextWindow >= 1000) {
    return `${Math.round(contextWindow / 1000)}K`;
  }
  return String(contextWindow);
}

/**
 * Get model capabilities as a list of strings.
 */
export function getModelCapabilities(model: ModelCatalogEntry): string[] {
  const caps: string[] = [];
  if (model.input?.includes("image")) {
    caps.push("vision");
  }
  if (model.reasoning) {
    caps.push("reasoning");
  }
  return caps;
}

/**
 * Find a model in the catalog by its full ID (provider/model or just model ID).
 */
export function findModelById(
  catalog: ModelCatalogEntry[],
  fullId: string,
): ModelCatalogEntry | undefined {
  // Try exact match first
  const exact = catalog.find((m) => m.id === fullId);
  if (exact) {
    return exact;
  }

  // Try provider/model format
  const [provider, ...modelParts] = fullId.split("/");
  const modelId = modelParts.join("/");

  if (modelId) {
    // Match by provider + model ID
    return catalog.find(
      (m) =>
        m.provider.toLowerCase() === provider.toLowerCase() &&
        m.id.toLowerCase() === modelId.toLowerCase(),
    );
  }

  // Try matching just the model ID without provider prefix
  return catalog.find((m) => m.id.toLowerCase() === fullId.toLowerCase());
}

/**
 * Get a human-readable label for a model.
 */
export function getModelLabel(model: ModelCatalogEntry | undefined): string {
  if (!model) {
    return "-";
  }
  const caps = getModelCapabilities(model);
  const capStr = caps.length > 0 ? ` (${caps.join(", ")})` : "";
  const ctx = model.contextWindow ? ` ${formatContextWindow(model.contextWindow)} ctx` : "";
  return `${model.name}${ctx}${capStr}`;
}

/**
 * Provider display names and ordering.
 */
export const PROVIDER_DISPLAY: Record<string, { label: string; order: number }> = {
  anthropic: { label: "Anthropic", order: 1 },
  openai: { label: "OpenAI", order: 2 },
  openrouter: { label: "OpenRouter", order: 3 },
  google: { label: "Google", order: 4 },
  groq: { label: "Groq", order: 5 },
  cerebras: { label: "Cerebras", order: 6 },
  deepseek: { label: "DeepSeek", order: 7 },
  xai: { label: "xAI", order: 8 },
  ollama: { label: "Ollama", order: 9 },
  lmstudio: { label: "LM Studio", order: 10 },
};

/**
 * Get display info for a provider.
 */
export function getProviderDisplay(provider: string): { label: string; order: number } {
  return (
    PROVIDER_DISPLAY[provider.toLowerCase()] ?? {
      label: provider.charAt(0).toUpperCase() + provider.slice(1),
      order: 100,
    }
  );
}

/**
 * Sort providers by display order.
 */
export function sortProvidersByOrder(providers: string[]): string[] {
  return [...providers].sort((a: string, b: string) => {
    const aOrder = getProviderDisplay(a).order;
    const bOrder = getProviderDisplay(b).order;
    return aOrder - bOrder;
  });
}
