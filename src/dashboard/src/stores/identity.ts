import { create } from "zustand";
import type {
  IdentityPageData,
  IdentityProfile,
  MemoryStats,
  RelationshipData,
  VaultSynthesis,
  VoiceProfile,
} from "../types";
import {
  identityApi,
  intelligenceApi,
  memoryApi,
  preferencesApi,
  profileApi,
  progressionApi,
  vaultApi,
} from "../api/client";

export interface EvolutionMilestone {
  id: string;
  label: string;
  timestamp: string | null; // null = future/not reached
  category: "identity" | "memory" | "intelligence";
}

interface IdentityStoreState extends IdentityPageData {
  depthOfUnderstanding: number;
  milestones: EvolutionMilestone[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetch: (force?: boolean) => Promise<void>;
}

// Helper to safely extract value from PromiseFulfilledResult
const val = <T>(res: PromiseSettledResult<T>, fallback: T | null = null): T | null => {
  return res.status === "fulfilled" ? res.value : fallback;
};

export const useIdentityStore = create<IdentityStoreState>((set, get) => ({
  profile: null,
  vault: null,
  voice: null,
  memory: null,
  hypotheses: [],
  patterns: [],
  progression: { stats: null, quests: [] },
  relationship: null,
  preferences: {},

  depthOfUnderstanding: 0,
  milestones: [],

  isLoading: false,
  error: null,
  lastFetched: null,

  fetch: async (force = false) => {
    const last = get().lastFetched;
    if (!force && last && Date.now() - last < 5 * 60 * 1000) return;

    set({ isLoading: true, error: null });

    try {
      const [
        profileRes,
        synthesisRes,
        voiceRes,
        memoryRes,
        hypothesesRes,
        patternsRes,
        progressionRes,
        questsRes,
        relationshipRes,
        preferencesRes,
      ] = await Promise.allSettled([
        profileApi.get(),
        vaultApi.getSynthesis(),
        vaultApi.getVoiceProfile(),
        memoryApi.getStats(),
        intelligenceApi.getHypotheses(),
        intelligenceApi.getPatterns(),
        progressionApi.getStats(),
        progressionApi.getQuests(),
        identityApi.getRelationship(),
        preferencesApi.getAll(),
      ]);

      // Extract data with fallbacks
      // API returns profile directly, not wrapped in { profile: {...} }
      const profile = val(profileRes) as IdentityProfile | null;
      const vault = val(synthesisRes) as VaultSynthesis | null;
      const voice = val(voiceRes) as VoiceProfile | null;
      const memory = val(memoryRes) as MemoryStats | null;
      const hypotheses = val(hypothesesRes)?.hypotheses ?? [];
      const patterns = val(patternsRes)?.patterns ?? [];
      const stats = val(progressionRes)?.stats ?? null;
      const quests = val(questsRes)?.quests ?? [];
      const relationship = val(relationshipRes) as RelationshipData | null;
      const preferences = val(preferencesRes)?.preferences ?? {};

      // ─── Calculate Depth of Understanding ─────────────────────────────
      let score = 0;
      // 1. Birth Data Set (15%)
      if (profile?.birthData) score += 15;
      // 2. Voice Profile (10%)
      // API returns uniqueExpressions, not descriptors
      const voiceDescriptors = (voice?.profile as Record<string, unknown>)?.uniqueExpressions ?? [];
      if (voice?.profile && Array.isArray(voiceDescriptors) && voiceDescriptors.length > 0)
        score += 10;
      // 3. Memories (10%)
      const totalMemories =
        (memory?.stats.episodic.count ?? 0) + (memory?.stats.semantic.count ?? 0);
      if (totalMemories >= 10) score += 10;
      // 4. Hypotheses (10%)
      if (hypotheses.length > 0) score += 10;
      // 5. Cosmic Blueprint (15%) - HD or Cardology present
      if (profile?.humanDesign || profile?.cardology) score += 15;
      // 6. Vault Synthesis (15%)
      // API returns 'rendered', not 'narrative'
      const synthesisObj = vault?.synthesis as Record<string, unknown> | undefined;
      const synthesisText = String(synthesisObj?.rendered ?? synthesisObj?.narrative ?? "");
      if (vault?.synthesis && synthesisText.length > 50) score += 15;
      // 7. Patterns (10%)
      if (patterns.length > 0) score += 10;
      // 8. Progression (10%)
      if (stats && stats.level > 1) score += 10;
      // 9. Relationship (5%)
      if (relationship) score += 5;

      const depthOfUnderstanding = Math.min(100, score);

      // ─── Calculate Milestones ─────────────────────────────────────────
      const milestones: EvolutionMilestone[] = [];

      // Birth Data
      if (profile?.birthData) {
        milestones.push({
          id: "birth_data",
          label: "Core Identity Established",
          timestamp: profile.birthData.datetime, // Approximate as birth time if no created_at
          category: "identity",
        });
      } else {
        milestones.push({
          id: "birth_data",
          label: "Core Identity",
          timestamp: null,
          category: "identity",
        });
      }

      // First Conversation (Approximated by earliest hypothesis or fixed start if not available)
      // Ideally we'd query the earliest message, but we'll use earliest memory/hypothesis as proxy
      if (hypotheses.length > 0) {
        const earliestHypothesis = hypotheses.reduce(
          (earliest, h) => (new Date(h.createdAt) < new Date(earliest) ? h.createdAt : earliest),
          hypotheses[0].createdAt,
        );
        milestones.push({
          id: "first_hypothesis",
          label: "First Hypothesis Formed",
          timestamp: earliestHypothesis,
          category: "intelligence",
        });
      }

      if (profile?.confirmedFacts && profile.confirmedFacts.length > 0) {
        milestones.push({
          id: "facts_learned",
          label: "First Facts Learned",
          timestamp: new Date().toISOString(), // We don't have timestamp for facts, just existence
          category: "memory",
        });
      }

      // 100 Memories
      if (totalMemories >= 100) {
        milestones.push({
          id: "100_memories",
          label: "100 Memories Stored",
          timestamp: new Date().toISOString(), // Proxy
          category: "memory",
        });
      } else {
        milestones.push({
          id: "100_memories",
          label: "100 Memories",
          timestamp: null,
          category: "memory",
        });
      }

      // Voice Profile
      if (voice?.profile) {
        milestones.push({
          id: "voice_profile",
          label: "Voice Profile Established",
          timestamp: voice.profile.lastUpdated ?? null,
          category: "identity",
        });
      }

      // Sort chronological
      milestones.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      set({
        profile,
        vault,
        voice,
        memory,
        hypotheses,
        patterns,
        progression: { stats, quests },
        relationship,
        preferences,
        depthOfUnderstanding,
        milestones,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },
}));
