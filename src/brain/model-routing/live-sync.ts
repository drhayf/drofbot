import { getChildLogger } from "../../logging.js";
import { loadConfig } from "../../shared/config/config.js";
import { resolveApiKeyForProvider } from "../agent-runner/model-auth.js";
import { type ProviderConfig } from "../agent-runner/models-config.providers.js";
import path from "node:path";
import fs from "node:fs/promises";
import { resolveOpenClawAgentDir } from "../agent-runner/agent-paths.js";
import { fetchModels as fetchOpenRouterFromRegistry } from "./registry.js";

const logger = getChildLogger({ module: "model-live-sync" });

export type LiveProviderCache = {
  anthropic?: ProviderConfig;
  openrouter?: ProviderConfig;
  updatedAtMs: number;
};

const DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const FALLBACK_ANTHROPIC_MODELS = [
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
];

export async function syncLiveModels(): Promise<void> {
  logger.info("Starting live model synchronization for Anthropic and OpenRouter...");
  const cfg = loadConfig();
  const cache: LiveProviderCache = { updatedAtMs: Date.now() };

  // 1. Sync Anthropic
  let anthropicKey = process.env.ANTHROPIC_API_KEY;
  try {
    if (!anthropicKey) {
        const { ensureAuthProfileStore, listProfilesForProvider } = await import("../agent-runner/auth-profiles.js");
        const store = ensureAuthProfileStore();
        const profiles = listProfilesForProvider(store, "anthropic");
        console.log("[LIVE-SYNC] Found anthropic profiles:", profiles);
        if (profiles.length > 0) {
            const p = store.profiles[profiles[0]];
            if (p?.type === "api_key") anthropicKey = p.key;
            else if (p?.type === "oauth") anthropicKey = p.access;
            else if (p?.type === "token") anthropicKey = p.token;
        }
    }

    if (anthropicKey) {
      logger.debug("Fetching live Anthropic models...");
      const res = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
      });
      console.log(`[LIVE-SYNC] Anthropic Fetch Status: ${res.status}`);
      if (res.ok) {
        const data = (await res.json()) as { data?: { id: string; display_name: string }[] };
        const models = data.data || [];
        
        cache.anthropic = {
          baseUrl: "https://api.anthropic.com",
          api: "anthropic-messages",
          // Map to standard OpenClaw ProviderConfig models
          models: models.map(m => ({
            id: m.id,
            name: m.display_name || m.id,
            reasoning: m.id.includes("thinking") || m.id.includes("reasoning"),
            input: ["text", "image"],
            contextWindow: 200000, 
            maxTokens: 8192,
            cost: DEFAULT_COST,
          })),
        };
        logger.info(`Synced ${models.length} Anthropic models.`);
      } else {
        const bodyText = await res.text();
        console.log(`[LIVE-SYNC] Anthropic error body:`, bodyText);
        logger.warn(`Anthropic sync failed: ${res.status}, using static fallback models.`);
        // Fallback for OAuth tokens where `/v1/models` is unsupported
        cache.anthropic = {
          baseUrl: "https://api.anthropic.com",
          api: "anthropic-messages",
          models: FALLBACK_ANTHROPIC_MODELS.map(id => ({
            id,
            name: id.replace(/-/g, " ").replace(/^claude /i, "Claude "),
            reasoning: id.includes("thinking") || id.includes("reasoning") || id.includes("3-7"),
            input: ["text", "image"],
            contextWindow: 200000,
            maxTokens: 8192,
            cost: DEFAULT_COST
          }))
        };
      }
    } else {
      logger.debug("No Anthropic API key available, skipping sync.");
    }
  } catch (err) {
    logger.error(`Error syncing Anthropic models: ${err}`);
    if (anthropicKey) {
        cache.anthropic = {
          baseUrl: "https://api.anthropic.com",
          api: "anthropic-messages",
          models: FALLBACK_ANTHROPIC_MODELS.map(id => ({
            id,
            name: id.replace(/-/g, " ").replace(/^claude /i, "Claude "),
            reasoning: id.includes("thinking") || id.includes("reasoning") || id.includes("3-7"),
            input: ["text", "image"],
            contextWindow: 200000,
            maxTokens: 8192,
            cost: DEFAULT_COST
          }))
        };
    }
  }

  // 2. Sync OpenRouter
  // We can leverage the existing `registry.ts` fetchModels to do the heavy lifting of parsing,
  // but we convert it into a ProviderConfig to inject into the CLI.
  try {
    const auth = await resolveApiKeyForProvider({ provider: "openrouter", cfg }).catch(() => null);
    if (auth?.apiKey) {
      logger.debug("Fetching live OpenRouter models...");
      const orModels = await fetchOpenRouterFromRegistry({ apiKey: auth.apiKey, force: true });
      if (orModels.length > 0) {
        cache.openrouter = {
          baseUrl: "https://openrouter.ai/api/v1",
          api: "openai-completions",
          models: orModels.map(m => ({
            id: m.id,
            name: m.name,
            reasoning: m.id.includes("thinking") || m.id.includes("reasoning"),
            input: ["text", "image"], // OpenRouter supports both generically
            contextWindow: m.contextLength,
            maxTokens: 8192,
            cost: {
                input: m.promptPrice,
                output: m.completionPrice,
                cacheRead: 0,
                cacheWrite: 0,
            }
          })),
        };

        logger.info(`Synced ${orModels.length} OpenRouter models.`);
      }
    } else {
      logger.debug("No OpenRouter API key available, skipping sync.");
    }
  } catch (err) {
    logger.error(`Error syncing OpenRouter models: ${err}`);
  }

  // 3. Save to Cache
  try {
    const agentDir = resolveOpenClawAgentDir();
    const cachePath = path.join(agentDir, "live-provider-cache.json");
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    logger.debug(`Live model cache saved to ${cachePath}`);
  } catch (err) {
    logger.error(`Failed to write live model cache: ${err}`);
  }
}
