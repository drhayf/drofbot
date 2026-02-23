import { create } from "zustand";
import { modelsApi, type ModelInfo, type CurrentModelInfo, type ProviderInfo } from "../api/client";

interface ModelsState {
  models: ModelInfo[];
  currentModel: CurrentModelInfo | null;
  providers: ProviderInfo[];
  configuredProviders: string[];
  selectedProvider: string | null;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;
  searchQuery: string;

  fetchProviders: () => Promise<void>;
  fetchModels: (query?: string, provider?: string) => Promise<void>;
  fetchCurrent: () => Promise<void>;
  setModel: (modelId: string) => Promise<void>;
  clearModel: () => Promise<void>;
  refreshRegistry: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSelectedProvider: (provider: string | null) => void;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  currentModel: null,
  providers: [],
  configuredProviders: [],
  selectedProvider: null,
  isLoading: false,
  isApplying: false,
  error: null,
  searchQuery: "",

  fetchProviders: async () => {
    try {
      const data = await modelsApi.getProviders();
      set({
        providers: data.providers,
        configuredProviders: data.configured,
        // Default to first configured provider
        selectedProvider: get().selectedProvider ?? data.configured[0] ?? null,
      });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchModels: async (query?: string, provider?: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeProvider = provider ?? get().selectedProvider ?? undefined;
      const data = await modelsApi.list(query, activeProvider);
      set({ models: data.models, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  fetchCurrent: async () => {
    try {
      const data = await modelsApi.getCurrent();
      set({ currentModel: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  setModel: async (modelId: string) => {
    set({ isApplying: true, error: null });
    try {
      await modelsApi.setCurrent(modelId);
      // Refresh current model info
      await get().fetchCurrent();
      set({ isApplying: false });
    } catch (e) {
      set({ error: (e as Error).message, isApplying: false });
    }
  },

  clearModel: async () => {
    set({ isApplying: true, error: null });
    try {
      await modelsApi.clearCurrent();
      await get().fetchCurrent();
      set({ isApplying: false });
    } catch (e) {
      set({ error: (e as Error).message, isApplying: false });
    }
  },

  refreshRegistry: async () => {
    set({ isLoading: true, error: null });
    try {
      await modelsApi.refresh();
      const q = get().searchQuery;
      const provider = get().selectedProvider ?? undefined;
      await get().fetchModels(q || undefined, provider);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),

  setSelectedProvider: (provider: string | null) => {
    set({ selectedProvider: provider, models: [] });
    // Fetch models for the new provider
    const q = get().searchQuery;
    get().fetchModels(q || undefined, provider ?? undefined);
  },
}));
