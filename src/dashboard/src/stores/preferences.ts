import { create } from "zustand";
import { preferencesApi } from "../api/client";

/** Preferences are a generic key-value store — Record<string, unknown> is the correct type here */
type PreferencesMap = Record<string, Record<string, unknown> | undefined>;

interface PreferencesState {
  preferences: PreferencesMap;
  briefings: PreferencesMap | null;
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  update: (prefs: Record<string, unknown>) => Promise<void>;
  fetchBriefings: () => Promise<void>;
  updateBriefings: (config: Record<string, unknown>) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  preferences: {},
  briefings: null,
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await preferencesApi.getAll();
      set({ preferences: data.preferences, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  update: async (prefs) => {
    try {
      await preferencesApi.update(prefs);
      // Merge locally - cast to PreferencesMap for type safety
      set((state) => ({ preferences: { ...state.preferences, ...prefs } as PreferencesMap }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchBriefings: async () => {
    try {
      const data = await preferencesApi.getBriefings();
      set({ briefings: data.briefings });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  updateBriefings: async (config) => {
    try {
      await preferencesApi.updateBriefings(config);
      set({ briefings: config as PreferencesMap });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));
