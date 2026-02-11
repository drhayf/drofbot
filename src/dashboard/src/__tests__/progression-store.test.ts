import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProgressionStore } from "../stores/progression";

describe("Progression store", () => {
  beforeEach(() => {
    useProgressionStore.setState({
      stats: null,
      quests: [],
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it("initial state has no stats", () => {
    expect(useProgressionStore.getState().stats).toBeNull();
    expect(useProgressionStore.getState().quests).toEqual([]);
  });

  it("fetchStats populates stats", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          stats: {
            level: 5,
            xp: 100,
            rank: "D",
            xpToNextLevel: 200,
            streakDays: 3,
            syncRate: 0.8,
            levelProgress: 0.5,
          },
        }),
    });

    await useProgressionStore.getState().fetchStats();

    const state = useProgressionStore.getState();
    expect(state.stats).not.toBeNull();
    expect(state.stats!.level).toBe(5);
    expect(state.stats!.streakDays).toBe(3);
    expect(state.isLoading).toBe(false);
  });

  it("fetchQuests populates quests array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          quests: [{ id: "q-1", title: "Quest 1", status: "ACTIVE", xpReward: 50 }],
        }),
    });

    await useProgressionStore.getState().fetchQuests();
    expect(useProgressionStore.getState().quests).toHaveLength(1);
  });

  it("fetchStats sets error on failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));

    await useProgressionStore.getState().fetchStats();
    expect(useProgressionStore.getState().error).toBe("fail");
  });
});
