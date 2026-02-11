/**
 * Active Model Resolution
 *
 * Single source of truth for which LLM model is currently active.
 * Checks preferences store first, then falls back to environment config.
 *
 * Resolution order:
 *   1. Preference `model.default` in the preferences store (operator-set at runtime)
 *   2. Environment variable DROFBOT_LLM_MODEL
 *   3. Hardcoded fallback: anthropic/claude-opus-4.6
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getPreference, setPreference, deletePreference } from "../preferences/store.js";

const log = createSubsystemLogger("model-routing");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREF_KEY = "model.default";
const ENV_FALLBACK_MODEL = "anthropic/claude-opus-4.6";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelPreferences {
  default: string; // e.g. "anthropic/claude-opus-4.6"
}

export interface ActiveModelInfo {
  model: string;
  source: "preference" | "env" | "fallback";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the currently active model ID.
 * Preference > env > hardcoded fallback.
 */
export async function getActiveModel(): Promise<ActiveModelInfo> {
  try {
    const pref = await getPreference(PREF_KEY);
    if (pref?.model && typeof pref.model === "string" && pref.model.trim()) {
      return { model: pref.model.trim(), source: "preference" };
    }
  } catch (err) {
    log.warn(
      `Failed to read model preference: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const envModel = process.env.DROFBOT_LLM_MODEL?.trim();
  if (envModel) {
    return { model: envModel, source: "env" };
  }

  return { model: ENV_FALLBACK_MODEL, source: "fallback" };
}

/**
 * Synchronous model resolution (for hot paths that can't await).
 * Reads from env only — preference requires async store access.
 */
export function getActiveModelSync(): string {
  return process.env.DROFBOT_LLM_MODEL?.trim() || ENV_FALLBACK_MODEL;
}

/**
 * Set the model preference (takes priority over env).
 */
export async function setModelPreference(modelId: string): Promise<boolean> {
  log.info(`Model preference set to: ${modelId}`);
  return setPreference(PREF_KEY, { model: modelId.trim() }, false);
}

/**
 * Clear the model preference (reverts to env default).
 */
export async function clearModelPreference(): Promise<boolean> {
  log.info("Model preference cleared, reverting to env default");
  return deletePreference(PREF_KEY);
}

/**
 * Get the env default model (what we'd use if no preference is set).
 */
export function getEnvDefaultModel(): string {
  return process.env.DROFBOT_LLM_MODEL?.trim() || ENV_FALLBACK_MODEL;
}
