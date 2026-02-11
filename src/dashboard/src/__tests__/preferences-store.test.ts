import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePreferencesStore } from "../stores/preferences";

describe("Preferences store", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      preferences: {},
      briefings: null,
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it("initial state has empty preferences", () => {
    expect(usePreferencesStore.getState().preferences).toEqual({});
    expect(usePreferencesStore.getState().briefings).toBeNull();
  });

  it("fetch populates preferences", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          preferences: { theme: "dark", language: "en" },
        }),
    });

    await usePreferencesStore.getState().fetch();
    expect(usePreferencesStore.getState().preferences).toEqual({
      theme: "dark",
      language: "en",
    });
  });

  it("update merges preferences locally", async () => {
    usePreferencesStore.setState({ preferences: { a: { value: 1 } } });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    await usePreferencesStore.getState().update({ b: 2 });
    expect(usePreferencesStore.getState().preferences).toEqual({ a: 1, b: 2 });
  });

  it("fetchBriefings populates briefings", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ briefings: { morning: true } }),
    });

    await usePreferencesStore.getState().fetchBriefings();
    expect(usePreferencesStore.getState().briefings).toEqual({ morning: true });
  });

  it("sets error on failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));

    await usePreferencesStore.getState().fetch();
    expect(usePreferencesStore.getState().error).toBe("fail");
  });
});
