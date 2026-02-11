import { create } from "zustand";
import { modelsApi, type ModelInfo, type CurrentModelInfo } from "../api/client";

interface ModelsState {
  models: ModelInfo[];
  currentModel: CurrentModelInfo | null;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;
  searchQuery: string;

  fetchModels: (query?: string) => Promise<void>;
  fetchCurrent: () => Promise<void>;
  setModel: (modelId: string) => Promise<void>;
  clearModel: () => Promise<void>;
  refreshRegistry: () => Promise<void>;
  setSearchQuery: (q: string) => void;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  currentModel: null,
  isLoading: false,
  isApplying: false,
  error: null,
  searchQuery: "",

  fetchModels: async (query?: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await modelsApi.list(query);
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
      await get().fetchModels(q || undefined);
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),
}));
