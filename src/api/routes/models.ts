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
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureAuthProfileStore,
  listProfilesForProvider,
} from "../../brain/agent-runner/auth-profiles.js";
import { resolveOpenClawAgentDir } from "../../brain/agent-runner/agent-paths.js";
import { resolveEnvApiKey } from "../../brain/agent-runner/model-auth.js";
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
import type { LiveProviderCache } from "../../brain/model-routing/live-sync.js";

const log = createSubsystemLogger("dashboard-api/models");

export const modelsRouter: Router = Router();

// Provider definitions basic info
const PROVIDERS: Record<string, { name: string; prefix: string }> = {
  openrouter: {
    name: "OpenRouter",
    prefix: "", // OpenRouter models already have provider/model format
  },
  anthropic: {
    name: "Anthropic (Direct)",
    prefix: "anthropic/",
  },
};

/**
 * Detect which providers are configured (have API keys or auth profiles).
 */
function detectConfiguredProviders(): string[] {
  const configured: string[] = [];

  // OpenRouter is configured if the API key exists (env or auth profile)
  const openrouterEnv = process.env.DROFBOT_LLM_API_KEY || process.env.OPENROUTER_API_KEY;
  const store = ensureAuthProfileStore();
  const openrouterProfiles = listProfilesForProvider(store, "openrouter");
  if (openrouterEnv || openrouterProfiles.length > 0) {
    configured.push("openrouter");
  }

  // Anthropic is configured if API key exists (env, auth profile, or OAuth token)
  const anthropicEnv = resolveEnvApiKey("anthropic");
  const anthropicProfiles = listProfilesForProvider(store, "anthropic");
  if (anthropicEnv || anthropicProfiles.length > 0) {
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
 * List available models from the live sync cache (Anthropic & OpenRouter).
 * Optional query params:
 *   ?q=search_term - Filter models by search term
 *   ?provider=openrouter|anthropic - Filter by provider
 */
modelsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string | undefined)?.trim();
    const providerReq = (req.query.provider as string | undefined)?.trim().toLowerCase();

    const unifiedModels: any[] = [];
    let fetchedAt: string | null = null;
    let fallbackOpenRouter = true;

    try {
      const raw = await fs.readFile(path.join(resolveOpenClawAgentDir(), "live-provider-cache.json"), "utf8");
      const liveCache = JSON.parse(raw) as LiveProviderCache;
      fetchedAt = new Date(liveCache.updatedAtMs).toISOString();

      if (liveCache.anthropic?.models) {
         for (const m of liveCache.anthropic.models) {
             unifiedModels.push({
                 id: `${PROVIDERS.anthropic.prefix}${m.id}`,
                 name: m.name,
                 provider: "anthropic",
                 promptPrice: m.cost?.input ?? 3,
                 completionPrice: m.cost?.output ?? 15,
                 contextLength: m.contextWindow ?? 200000,
                 pricing: "See provider pricing",
             });
         }
      }

      if (liveCache.openrouter?.models) {
         fallbackOpenRouter = false; // Cache has OpenRouter data
         for (const m of liveCache.openrouter.models) {
             unifiedModels.push({
                 id: m.id,
                 name: m.name,
                 provider: "openrouter",
                 promptPrice: m.cost?.input ?? 0,
                 completionPrice: m.cost?.output ?? 0,
                 contextLength: m.contextWindow ?? 128000,
                 pricing: `Prompt: $${m.cost?.input}/M | Comp: $${m.cost?.output}/M`,
             });
         }
      }
    } catch {
       // Cache not found or invalid
    }

    if (fallbackOpenRouter) {
         const allModels = await fetchModels();
         for (const m of allModels) {
             unifiedModels.push({
                 id: m.id,
                 name: m.name,
                 provider: m.provider,
                 promptPrice: m.promptPrice,
                 completionPrice: m.completionPrice,
                 contextLength: m.contextLength,
                 pricing: formatPricing(m),
             });
         }
         fetchedAt = getCacheInfo().fetchedAt ? new Date(getCacheInfo().fetchedAt).toISOString() : null;
    }

    // Filter by provider
    let filtered = unifiedModels;
    if (providerReq) {
        filtered = filtered.filter(m => m.provider === providerReq);
    }

    // Filter by search query
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      );
    }

    res.json({
      models: filtered,
      total: filtered.length,
      cache: {
        fetchedAt,
        stale: false, // The sync runs on interval now
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
