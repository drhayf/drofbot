/**
 * * Dashboard API — Model Routes
 *
 * GET    /api/models           — List available models (from OpenRouter, cached)
 * GET    /api/models/providers  — List available providers (OpenRouter, Anthropic, etc.)
 * GET    /api/models/current   — Current active model (preference or env default)
 * PUT    /api/models/current   — Set model preference
 * DELETE /api/models/current   — Clear preference (revert to env default)
 * GET    /api/models/refresh   — Force refresh the OpenRouter model cache
 */

import { Router, type Request, type Response } from "express";
import {
  getActiveModel,
  setModelPreference,
  clearModelPreference,
  getEnvDefaultModel,
} from "../../brain/model-routing/active-model.js";
import {
  fetchModels,
  findModel,
  refreshModels,
  getCacheInfo,
  formatPricing,
} from "../../brain/model-routing/registry.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("dashboard-api/models");

export const modelsRouter: Router = Router();

// Provider definitions with their model prefixes and display names
const PROVIDERS: Record<string, { name: string; prefix: string; models: string[] }> = {
  openrouter: {
    name: "OpenRouter",
    prefix: "", // OpenRouter models already have provider/model format
    models: [], // Populated dynamically from registry
  },
  anthropic: {
    name: "Anthropic (Direct)",
    prefix: "anthropic/",
    models: [
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
      "claude-opus-4-5-20250929",
      "claude-opus-4-20250514",
    ],
  },
};

/**
 * Detect which providers are configured (have API keys).
 */
function detectConfiguredProviders(): string[] {
  const configured: string[] = [];

  // OpenRouter is configured if the API key exists
  if (process.env.DROFBOT_LLM_API_KEY || process.env.OPENROUTER_API_KEY) {
    configured.push("openrouter");
  }

  // Anthropic is configured if the API key exists
  if (process.env.ANTHROPIC_API_KEY) {
    configured.push("anthropic");
  }

  return configured;
}

/**
 * GET /api/models/providers
 * List available providers and their configuration status.
 */
modelsRouter.get("/providers", async (_req: Request, res: Response) => {
  try {
    const configured = detectConfiguredProviders();
    const providers = Object.entries(PROVIDERS).map(([key, info]) => ({
      id: key,
      name: info.name,
      prefix: info.prefix,
      configured: configured.includes(key),
    }));

    res.json({ providers, configured });
  } catch (err) {
    log.error(`Failed to list providers: ${err}`);
    res.status(500).json({ error: "Failed to list providers" });
  }
});

/**
 * GET /api/models
 * List available models from the OpenRouter registry (cached).
 * Optional query params:
 *   ?q=search_term - Filter models by search term
 *   ?provider=openrouter|anthropic - Filter by provider
 */
modelsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string | undefined)?.trim();
    const provider = (req.query.provider as string | undefined)?.trim().toLowerCase();

    // If requesting Anthropic models specifically
    if (provider === "anthropic") {
      const anthropicProvider = PROVIDERS.anthropic;
      const models = anthropicProvider.models.map((modelId) => ({
        id: `${anthropicProvider.prefix}${modelId}`,
        name: modelId.replace(/-/g, " ").replace(/^claude /i, "Claude "),
        provider: "anthropic",
        promptPrice: 3, // Approximate Anthropic pricing
        completionPrice: 15,
        contextLength: 200000,
        pricing: "See Anthropic pricing",
      }));

      let filtered = models;
      if (query) {
        const q = query.toLowerCase();
        filtered = models.filter(
          (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
        );
      }

      return res.json({
        models: filtered,
        total: filtered.length,
        cache: { fetchedAt: null, stale: false },
      });
    }

    // Default: OpenRouter models
    const allModels = await fetchModels();

    let models = allModels;
    if (query) {
      const q = query.toLowerCase();
      models = allModels.filter(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      );
    }

    const cache = getCacheInfo();

    res.json({
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        promptPrice: m.promptPrice,
        completionPrice: m.completionPrice,
        contextLength: m.contextLength,
        pricing: formatPricing(m),
      })),
      total: models.length,
      cache: {
        fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
        stale: cache.stale,
      },
    });
  } catch (err) {
    log.error(`Failed to list models: ${err}`);
    res.status(500).json({ error: "Failed to list models" });
  }
});

/**
 * GET /api/models/current
 * Return the currently active model and its source.
 */
modelsRouter.get("/current", async (_req: Request, res: Response) => {
  try {
    const active = await getActiveModel();
    const envDefault = getEnvDefaultModel();
    const registryEntry = await findModel(active.model).catch(() => undefined);

    res.json({
      model: active.model,
      source: active.source,
      envDefault,
      pricing: registryEntry ? formatPricing(registryEntry) : null,
      contextLength: registryEntry?.contextLength ?? null,
      name: registryEntry?.name ?? null,
    });
  } catch (err) {
    log.error(`Failed to get current model: ${err}`);
    res.status(500).json({ error: "Failed to get current model" });
  }
});

/**
 * PUT /api/models/current
 * Set the model preference. Body: { model: "provider/model-id" }
 */
modelsRouter.put("/current", async (req: Request, res: Response) => {
  try {
    const { model } = req.body as { model?: string };

    if (!model || typeof model !== "string" || !model.trim()) {
      res.status(400).json({ error: "Body must include a 'model' string" });
      return;
    }

    const trimmed = model.trim();

    // Check if it's an Anthropic direct model
    const isAnthropicDirect = trimmed.startsWith("anthropic/") && !trimmed.includes("/claude-"); // Not an OpenRouter anthropic/claude-* path

    // For Anthropic direct models, skip OpenRouter validation
    if (!isAnthropicDirect) {
      // Validate model exists on OpenRouter
      const registryEntry = await findModel(trimmed);
      if (!registryEntry) {
        res.status(404).json({
          error: `Model "${trimmed}" not found on OpenRouter`,
          hint: "Use GET /api/models?q=... to search for available models",
        });
        return;
      }
    }

    const previous = await getActiveModel();
    await setModelPreference(trimmed);

    res.json({
      status: "updated",
      previous: previous.model,
      current: trimmed,
      name: trimmed.split("/").pop()?.replace(/-/g, " ") || trimmed,
      pricing: "See provider pricing",
      contextLength: 200000,
    });
  } catch (err) {
    log.error(`Failed to set model: ${err}`);
    res.status(500).json({ error: "Failed to set model" });
  }
});

/**
 * DELETE /api/models/current
 * Clear the model preference, reverting to env default.
 */
modelsRouter.delete("/current", async (_req: Request, res: Response) => {
  try {
    const previous = await getActiveModel();
    await clearModelPreference();
    const envDefault = getEnvDefaultModel();

    res.json({
      status: "cleared",
      previous: previous.model,
      activeNow: envDefault,
      source: "env",
    });
  } catch (err) {
    log.error(`Failed to clear model preference: ${err}`);
    res.status(500).json({ error: "Failed to clear model preference" });
  }
});

/**
 * GET /api/models/refresh
 * Force refresh the OpenRouter model cache.
 */
modelsRouter.get("/refresh", async (_req: Request, res: Response) => {
  try {
    const models = await refreshModels();
    const cache = getCacheInfo();

    res.json({
      status: "refreshed",
      count: models.length,
      fetchedAt: new Date(cache.fetchedAt).toISOString(),
    });
  } catch (err) {
    log.error(`Failed to refresh models: ${err}`);
    res.status(500).json({ error: "Failed to refresh models" });
  }
});
