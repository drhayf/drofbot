import { create } from "zustand";
import type { Hypothesis, PatternSummary } from "../types";
import { intelligenceApi } from "../api/client";

interface IntelligenceState {
  hypotheses: Hypothesis[];
  patterns: PatternSummary[];
  isLoading: boolean;
  error: string | null;
  fetchHypotheses: (status?: string) => Promise<void>;
  fetchPatterns: () => Promise<void>;
  confirmHypothesis: (id: string) => Promise<void>;
  rejectHypothesis: (id: string) => Promise<void>;
  getHypothesis: (id: string) => Promise<Hypothesis | null>;
}

export const useIntelligenceStore = create<IntelligenceState>((set) => ({
  hypotheses: [],
  patterns: [],
  isLoading: false,
  error: null,

  fetchHypotheses: async (status?: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await intelligenceApi.getHypotheses(status);
      set({ hypotheses: data.hypotheses, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  fetchPatterns: async () => {
    try {
      const data = await intelligenceApi.getPatterns();
      set({ patterns: data.patterns });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  confirmHypothesis: async (id: string) => {
    try {
      await intelligenceApi.confirmHypothesis(id);
      const data = await intelligenceApi.getHypotheses();
      set({ hypotheses: data.hypotheses });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  rejectHypothesis: async (id: string) => {
    try {
      await intelligenceApi.rejectHypothesis(id);
      const data = await intelligenceApi.getHypotheses();
      set({ hypotheses: data.hypotheses });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  getHypothesis: async (id: string) => {
    try {
      return await intelligenceApi.getHypothesis(id);
    } catch {
      return null;
    }
  },
}));
