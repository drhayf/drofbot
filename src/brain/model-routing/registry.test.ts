/**
 * Tests for OpenRouter Model Registry (Phase 7d — Part 3a).
 */

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  fetchModels,
  findModel,
  searchModels,
  refreshModels,
  getCacheInfo,
  formatPricing,
  resetRegistryCache,
  type ModelRegistryEntry,
} from "./registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockResponse(models: Array<{ id: string; name: string }>) {
  return {
    data: models.map((m) => ({
      id: m.id,
      name: m.name,
      pricing: { prompt: "0.000003", completion: "0.000015" },
      context_length: 200000,
      top_provider: { max_completion_tokens: 8192 },
    })),
  };
}

function mockFetchSuccess(models: Array<{ id: string; name: string }>) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makeMockResponse(models)),
  });
}

function mockFetchFailure() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Model Registry", () => {
  beforeEach(() => {
    resetRegistryCache();
    process.env.DROFBOT_LLM_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DROFBOT_LLM_API_KEY;
  });

  it("fetches and caches models from OpenRouter", async () => {
    mockFetchSuccess([
      { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "openai/gpt-4o", name: "GPT-4o" },
    ]);

    const models = await fetchModels();
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("anthropic/claude-sonnet-4-5");
    expect(models[0].provider).toBe("anthropic");
    expect(models[1].provider).toBe("openai");

    // Second call should use cache (no new fetch)
    const models2 = await fetchModels();
    expect(models2).toHaveLength(2);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("force refresh bypasses cache", async () => {
    const mockFn = vi.fn();

    // First call returns 1 model
    mockFn.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(makeMockResponse([{ id: "anthropic/claude-3-opus", name: "Opus" }])),
    });

    // Second call returns 2 models
    mockFn.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          makeMockResponse([
            { id: "anthropic/claude-3-opus", name: "Opus" },
            { id: "meta/llama-3", name: "Llama 3" },
          ]),
        ),
    });

    globalThis.fetch = mockFn;

    await fetchModels();
    expect(mockFn).toHaveBeenCalledTimes(1);

    const refreshed = await refreshModels();
    expect(refreshed).toHaveLength(2);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("returns stale cache on API error", async () => {
    mockFetchSuccess([{ id: "anthropic/claude-3-opus", name: "Opus" }]);
    await fetchModels();

    // Force refresh with failure — should return stale
    mockFetchFailure();
    const result = await fetchModels({ force: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("anthropic/claude-3-opus");
  });

  it("returns empty array when no API key and no cache", async () => {
    delete process.env.DROFBOT_LLM_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const models = await fetchModels();
    expect(models).toEqual([]);
  });

  it("findModel locates a specific model", async () => {
    mockFetchSuccess([
      { id: "anthropic/claude-sonnet-4-5", name: "Sonnet" },
      { id: "openai/gpt-4o", name: "GPT-4o" },
    ]);

    const model = await findModel("openai/gpt-4o");
    expect(model).toBeDefined();
    expect(model!.name).toBe("GPT-4o");

    const missing = await findModel("nonexistent/model");
    expect(missing).toBeUndefined();
  });

  it("searchModels finds by partial name", async () => {
    mockFetchSuccess([
      { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "anthropic/claude-opus-4", name: "Claude Opus 4" },
      { id: "openai/gpt-4o", name: "GPT-4o" },
    ]);

    const results = await searchModels("claude");
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.id.includes("claude"))).toBe(true);
  });

  it("getCacheInfo reports state correctly", async () => {
    let info = getCacheInfo();
    expect(info.count).toBe(0);
    expect(info.stale).toBe(true);

    mockFetchSuccess([{ id: "test/model", name: "Test" }]);
    await fetchModels();

    info = getCacheInfo();
    expect(info.count).toBe(1);
    expect(info.stale).toBe(false);
    expect(info.fetchedAt).toBeGreaterThan(0);
  });

  it("parses pricing per million tokens", async () => {
    mockFetchSuccess([{ id: "test/model", name: "Test" }]);
    const models = await fetchModels();
    // pricing.prompt = "0.000003" → 3.0 per million
    expect(models[0].promptPrice).toBeCloseTo(3.0, 1);
    // pricing.completion = "0.000015" → 15.0 per million
    expect(models[0].completionPrice).toBeCloseTo(15.0, 1);
  });

  it("formatPricing produces readable string", () => {
    const model: ModelRegistryEntry = {
      id: "test/model",
      name: "Test",
      promptPrice: 3,
      completionPrice: 15,
      contextLength: 200000,
      provider: "test",
    };
    const pricing = formatPricing(model);
    expect(pricing).toBe("$3.00 / $15.00 per million tokens");
  });
});
