import { describe, it, expect, vi, beforeEach } from "vitest";
import { useModelsStore } from "../stores/models";

// The store uses `modelsApi` from client.ts which calls `fetch()`.
// We mock `fetch` globally to control API responses.

describe("Models store", () => {
  beforeEach(() => {
    useModelsStore.setState({
      models: [],
      currentModel: null,
      isLoading: false,
      isApplying: false,
      error: null,
      searchQuery: "",
    });
    vi.restoreAllMocks();
  });

  it("initial state has empty models", () => {
    const state = useModelsStore.getState();
    expect(state.models).toEqual([]);
    expect(state.currentModel).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.searchQuery).toBe("");
  });

  it("fetchModels populates model list", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          models: [
            {
              id: "anthropic/claude-sonnet-4-5",
              name: "Claude Sonnet 4.5",
              provider: "anthropic",
              promptPrice: 3,
              completionPrice: 15,
              contextLength: 200000,
              pricing: "$3.00 / $15.00 per million tokens",
            },
          ],
          total: 1,
          cache: { fetchedAt: new Date().toISOString(), stale: false },
        }),
    });

    await useModelsStore.getState().fetchModels();

    const state = useModelsStore.getState();
    expect(state.models).toHaveLength(1);
    expect(state.models[0].id).toBe("anthropic/claude-sonnet-4-5");
    expect(state.isLoading).toBe(false);
  });

  it("fetchCurrent populates currentModel", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          model: "openai/gpt-4o",
          source: "preference",
          envDefault: "anthropic/claude-sonnet-4-5-20250929",
          pricing: "$2.50 / $10.00 per million tokens",
          contextLength: 128000,
          name: "GPT-4o",
        }),
    });

    await useModelsStore.getState().fetchCurrent();

    const state = useModelsStore.getState();
    expect(state.currentModel).not.toBeNull();
    expect(state.currentModel!.model).toBe("openai/gpt-4o");
    expect(state.currentModel!.source).toBe("preference");
  });

  it("setModel applies and refreshes current", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // PUT /models/current
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "switched",
              previous: "anthropic/claude-sonnet-4-5",
              current: "openai/gpt-4o",
              name: "GPT-4o",
              pricing: "$2.50 / $10.00",
              contextLength: 128000,
            }),
        });
      }
      // GET /models/current (refresh)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: "openai/gpt-4o",
            source: "preference",
            envDefault: "anthropic/claude-sonnet-4-5-20250929",
            pricing: "$2.50 / $10.00",
            contextLength: 128000,
            name: "GPT-4o",
          }),
      });
    });

    await useModelsStore.getState().setModel("openai/gpt-4o");

    const state = useModelsStore.getState();
    expect(state.currentModel!.model).toBe("openai/gpt-4o");
    expect(state.isApplying).toBe(false);
  });

  it("clearModel resets preference", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // DELETE /models/current
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "reset",
              previous: "openai/gpt-4o",
              activeNow: "anthropic/claude-sonnet-4-5-20250929",
              source: "env",
            }),
        });
      }
      // GET /models/current (refresh)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: "anthropic/claude-sonnet-4-5-20250929",
            source: "fallback",
            envDefault: "anthropic/claude-sonnet-4-5-20250929",
            pricing: null,
            contextLength: null,
            name: null,
          }),
      });
    });

    await useModelsStore.getState().clearModel();

    const state = useModelsStore.getState();
    expect(state.currentModel!.source).not.toBe("preference");
    expect(state.isApplying).toBe(false);
  });

  it("sets error on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    await useModelsStore.getState().fetchModels();
    expect(useModelsStore.getState().error).toBe("network error");
    expect(useModelsStore.getState().isLoading).toBe(false);
  });

  it("setSearchQuery updates search query", () => {
    useModelsStore.getState().setSearchQuery("claude");
    expect(useModelsStore.getState().searchQuery).toBe("claude");
  });
});
