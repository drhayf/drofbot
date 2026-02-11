import { create } from "zustand";
import type { PlayerStats, Quest } from "../types";
import { progressionApi } from "../api/client";

interface ProgressionState {
  stats: PlayerStats | null;
  quests: Quest[];
  isLoading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
  fetchQuests: () => Promise<void>;
  completeQuest: (id: string) => Promise<void>;
  createQuest: (data: { title: string; description: string; difficulty: string }) => Promise<void>;
}

export const useProgressionStore = create<ProgressionState>((set) => ({
  stats: null,
  quests: [],
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await progressionApi.getStats();
      set({ stats: data.stats, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  fetchQuests: async () => {
    try {
      const data = await progressionApi.getQuests();
      set({ quests: data.quests });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  completeQuest: async (id: string) => {
    try {
      await progressionApi.completeQuest(id);
      // Re-fetch both to sync XP and quest status
      const [stats, quests] = await Promise.all([
        progressionApi.getStats(),
        progressionApi.getQuests(),
      ]);
      set({ stats: stats.stats, quests: quests.quests });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  createQuest: async (data) => {
    try {
      await progressionApi.createQuest(data);
      const questsData = await progressionApi.getQuests();
      set({ quests: questsData.quests });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));
