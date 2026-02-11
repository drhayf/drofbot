/**
 * Dashboard API — Model Routes
 *
 * GET    /api/models           — List available models (from OpenRouter, cached)
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

/**
 * GET /api/models
 * List available models from the OpenRouter registry (cached).
 * Optional query param: ?q=search_term
 */
modelsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string | undefined)?.trim();
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

    // Validate model exists on OpenRouter
    const registryEntry = await findModel(trimmed);
    if (!registryEntry) {
      res.status(404).json({
        error: `Model "${trimmed}" not found on OpenRouter`,
        hint: "Use GET /api/models?q=... to search for available models",
      });
      return;
    }

    const previous = await getActiveModel();
    await setModelPreference(trimmed);

    res.json({
      status: "updated",
      previous: previous.model,
      current: trimmed,
      name: registryEntry.name,
      pricing: formatPricing(registryEntry),
      contextLength: registryEntry.contextLength,
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
