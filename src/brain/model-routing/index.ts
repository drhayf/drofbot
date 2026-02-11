/**
 * Model Routing — barrel export
 */

export {
  fetchModels,
  findModel,
  searchModels,
  refreshModels,
  getCacheInfo,
  formatPricing,
  resetRegistryCache,
  type ModelRegistryEntry,
  type OpenRouterModel,
} from "./registry.js";

export {
  getActiveModel,
  getActiveModelSync,
  setModelPreference,
  clearModelPreference,
  getEnvDefaultModel,
  type ActiveModelInfo,
  type ModelPreferences,
} from "./active-model.js";
