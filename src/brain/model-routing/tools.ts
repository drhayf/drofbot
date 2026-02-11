/**
 * Model Selection Chat Tool
 *
 * Self-configuration tool that lets the operator change the LLM model
 * through natural conversation. Follows the same pattern as existing
 * Phase 4 self-config tools.
 *
 * Capabilities:
 *   - Report current model and source
 *   - List available models from OpenRouter
 *   - Switch to a specific model (with validation + pricing display)
 *   - Revert to environment default
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../agent-runner/tools/common.js";
import { jsonResult, readStringParam } from "../agent-runner/tools/common.js";
import {
  getActiveModel,
  setModelPreference,
  clearModelPreference,
  getEnvDefaultModel,
} from "./active-model.js";
import {
  fetchModels,
  findModel,
  searchModels,
  refreshModels,
  formatPricing,
  type ModelRegistryEntry,
} from "./registry.js";

// ─── Schemas ───────────────────────────────────────────────────

const ManageModelSchema = Type.Object({
  action: Type.String({
    description:
      "Action to perform: 'get_current', 'list', 'search', 'switch', or 'reset_default'.",
  }),
  model_id: Type.Optional(
    Type.String({
      description:
        "Full model ID (e.g. 'anthropic/claude-sonnet-4-5-20250929') for 'switch' action.",
    }),
  ),
  query: Type.Optional(
    Type.String({
      description:
        "Search query for 'list' or 'search' actions (e.g. 'claude', 'gpt', 'deepseek').",
    }),
  ),
});

// ─── Tool Factory ──────────────────────────────────────────────

export function createManageModelTool(): AnyAgentTool {
  return {
    label: "Manage Model",
    name: "manage_model",
    description:
      "View or change the active LLM model. " +
      "Check what model is in use, browse available models from OpenRouter, " +
      "switch to a different model (with pricing info), or revert to the default.",
    parameters: ManageModelSchema,
    execute: async (_toolCallId, params) => {
      const action = readStringParam(params, "action", { required: true });

      switch (action) {
        case "get_current":
          return handleGetCurrent();
        case "list":
          return handleList(readStringParam(params, "query"));
        case "search":
          return handleSearch(readStringParam(params, "query") ?? "");
        case "switch":
          return handleSwitch(readStringParam(params, "model_id") ?? "");
        case "reset_default":
          return handleResetDefault();
        default:
          return jsonResult({
            status: "error",
            message: `Unknown action: ${action}. Use 'get_current', 'list', 'search', 'switch', or 'reset_default'.`,
          });
      }
    },
  };
}

// ─── Handlers ──────────────────────────────────────────────────

async function handleGetCurrent() {
  const active = await getActiveModel();
  const envDefault = getEnvDefaultModel();
  const registryEntry = await findModel(active.model).catch(() => undefined);

  return jsonResult({
    status: "ok",
    model: active.model,
    source: active.source,
    envDefault,
    pricing: registryEntry ? formatPricing(registryEntry) : "unknown",
    contextLength: registryEntry?.contextLength ?? "unknown",
  });
}

async function handleList(query?: string) {
  const models = query ? await searchModels(query) : await fetchModels();

  // Take top 25 for readability
  const display = models.slice(0, 25).map(formatModelEntry);

  return jsonResult({
    status: "ok",
    totalAvailable: models.length,
    showing: display.length,
    models: display,
    hint:
      models.length > 25 ? "Use the 'search' action with a query to narrow results." : undefined,
  });
}

async function handleSearch(query: string) {
  if (!query.trim()) {
    return jsonResult({
      status: "error",
      message: "A search query is required. Try 'claude', 'gpt', 'deepseek', etc.",
    });
  }

  const results = await searchModels(query);
  const display = results.slice(0, 15).map(formatModelEntry);

  return jsonResult({
    status: "ok",
    query,
    resultCount: results.length,
    models: display,
  });
}

async function handleSwitch(modelId: string) {
  if (!modelId.trim()) {
    return jsonResult({
      status: "error",
      message: "A model_id is required (e.g. 'anthropic/claude-sonnet-4-5-20250929').",
    });
  }

  // Validate model exists on OpenRouter
  const model = await findModel(modelId);
  if (!model) {
    // Try fuzzy search to help
    const suggestions = await searchModels(modelId);
    const topSuggestions = suggestions.slice(0, 5).map((m) => m.id);
    return jsonResult({
      status: "error",
      message: `Model "${modelId}" not found on OpenRouter.`,
      suggestions: topSuggestions.length > 0 ? topSuggestions : undefined,
    });
  }

  // Get current for comparison
  const current = await getActiveModel();
  const currentEntry = await findModel(current.model).catch(() => undefined);

  // Apply the preference
  await setModelPreference(modelId);

  return jsonResult({
    status: "switched",
    previous: {
      model: current.model,
      pricing: currentEntry ? formatPricing(currentEntry) : "unknown",
    },
    current: {
      model: model.id,
      name: model.name,
      pricing: formatPricing(model),
      contextLength: model.contextLength,
    },
    message: `Model switched from ${current.model} to ${model.id}.`,
  });
}

async function handleResetDefault() {
  const current = await getActiveModel();
  const envDefault = getEnvDefaultModel();

  await clearModelPreference();

  return jsonResult({
    status: "reset",
    previous: current.model,
    previousSource: current.source,
    activeNow: envDefault,
    source: "env",
    message: `Model preference cleared. Now using env default: ${envDefault}.`,
  });
}

// ─── Formatting ────────────────────────────────────────────────

function formatModelEntry(m: ModelRegistryEntry) {
  return {
    id: m.id,
    name: m.name,
    pricing: formatPricing(m),
    contextLength: m.contextLength,
  };
}
