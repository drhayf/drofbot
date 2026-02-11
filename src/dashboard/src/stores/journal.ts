import { create } from "zustand";
import type { JournalEntry } from "../types";
import { journalApi } from "../api/client";

interface JournalState {
  entries: JournalEntry[];
  total: number;
  page: number;
  isLoading: boolean;
  error: string | null;
  fetchEntries: (page?: number) => Promise<void>;
  createEntry: (data: {
    content: string;
    mood?: string;
    tags?: string[];
  }) => Promise<JournalEntry | null>;
  getEntry: (id: string) => Promise<JournalEntry | null>;
}

export const useJournalStore = create<JournalState>((set) => ({
  entries: [],
  total: 0,
  page: 1,
  isLoading: false,
  error: null,

  fetchEntries: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const data = await journalApi.getEntries(page);
      set({
        entries: data.entries,
        total: data.total,
        page,
        isLoading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createEntry: async (data) => {
    try {
      const result = await journalApi.createEntry(data);
      // Re-fetch to get consistent ordering
      const list = await journalApi.getEntries(1);
      set({ entries: list.entries, total: list.total, page: 1 });
      // Return a minimal entry from the creation response
      return {
        id: result.id,
        content: data.content,
        mood: data.mood,
        tags: data.tags ?? [],
        createdAt: result.timestamp,
      };
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },

  getEntry: async (id: string) => {
    try {
      const data = await journalApi.getEntry(id);
      return data.entry;
    } catch {
      return null;
    }
  },
}));
