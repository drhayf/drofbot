import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useIdentityStore } from "../identity";
import { profileApi, identityApi, vaultApi, memoryApi, progressionApi } from "../../api/client";

// Mock API client
vi.mock("../../api/client", () => ({
  profileApi: {
    get: vi.fn(),
  },
  identityApi: {
    getSelf: vi.fn(),
    getRelationship: vi.fn(),
  },
  vaultApi: {
    getSynthesis: vi.fn(),
    getVoiceProfile: vi.fn(),
  },
  memoryApi: {
    getStats: vi.fn(),
  },
  progressionApi: {
    getStats: vi.fn(),
    getQuests: vi.fn(),
  },
  intelligenceApi: {
    getHypotheses: vi.fn(),
    getPatterns: vi.fn(),
  },
  preferencesApi: {
    getAll: vi.fn(),
  },
}));

describe("useIdentityStore", () => {
  beforeEach(() => {
    useIdentityStore.setState({
      profile: null,
      vault: null,
      relationship: null,
      voice: null,
      hypotheses: [],
      patterns: [],
      memory: null,
      progression: { stats: null, quests: [] },
      depthOfUnderstanding: 0,
      milestones: [],
      isLoading: false,
      error: null,
      lastFetched: null,
      preferences: {},
    });
    vi.clearAllMocks();
  });

  it("should have initial state", () => {
    const state = useIdentityStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.depthOfUnderstanding).toBe(0);
    expect(state.profile).toBeNull();
  });

  it("should fetch data successfully and calculate milestones", async () => {
    // Mock successful responses
    (profileApi.get as any).mockResolvedValue({ 
      profile: { 
        birthData: { datetime: "1990-01-01T00:00:00Z" },
        confirmedFacts: []
      } 
    });
    // identityApi.getSelf is not used in store
    (vaultApi.getSynthesis as any).mockResolvedValue({ synthesis: { narrative: "Test Narrative" } });
    (vaultApi.getVoiceProfile as any).mockResolvedValue({ profile: { dimensions: {}, descriptors: ["Warm"], descriptors_count: 1 } });
    (identityApi.getRelationship as any).mockResolvedValue({ operator: {}, agent: {} });
    (memoryApi.getStats as any).mockResolvedValue({ stats: { episodic: { count: 50 }, semantic: { count: 50 }, procedural: { count: 0 }, relational: { count: 0 } } });
    (progressionApi.getStats as any).mockResolvedValue({ stats: { level: 5 } });
    (progressionApi.getQuests as any).mockResolvedValue({ quests: [] });
    
    await act(async () => {
      await useIdentityStore.getState().fetch();
    });

    const state = useIdentityStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.profile).toBeDefined();
    expect(state.milestones.length).toBeGreaterThan(0);
    // Should have some depth
    expect(state.depthOfUnderstanding).toBeGreaterThan(0);
  });

  it("should handle partial failures gracefully", async () => {
    // Mock mixed responses
    (profileApi.get as any).mockResolvedValue({ profile: {} });
    (vaultApi.getSynthesis as any).mockRejectedValue(new Error("Failed"));
    
    // Silence console.error for expected failure
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await useIdentityStore.getState().fetch();
    });

    const state = useIdentityStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.profile).toBeDefined(); // Should still have profile
    expect(state.vault).toBeNull(); // Vault failed
    
    consoleSpy.mockRestore();
  });
});
