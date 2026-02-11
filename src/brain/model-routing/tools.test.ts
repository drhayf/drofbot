/**
 * Tests for Model Selection Chat Tool (Phase 7d — Part 3c).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("./active-model.js", () => ({
  getActiveModel: vi.fn(),
  setModelPreference: vi.fn(),
  clearModelPreference: vi.fn(),
  getEnvDefaultModel: vi.fn(),
}));

vi.mock("./registry.js", () => ({
  fetchModels: vi.fn(),
  findModel: vi.fn(),
  searchModels: vi.fn(),
  refreshModels: vi.fn(),
  formatPricing: vi.fn(),
}));

import {
  getActiveModel,
  setModelPreference,
  clearModelPreference,
  getEnvDefaultModel,
} from "./active-model.js";
import { fetchModels, findModel, searchModels, formatPricing } from "./registry.js";
import { createManageModelTool } from "./tools.js";

const mockGetActive = vi.mocked(getActiveModel);
const mockSetPref = vi.mocked(setModelPreference);
const mockClearPref = vi.mocked(clearModelPreference);
const mockGetEnvDefault = vi.mocked(getEnvDefaultModel);
const mockFetchModels = vi.mocked(fetchModels);
const mockFindModel = vi.mocked(findModel);
const mockSearchModels = vi.mocked(searchModels);
const mockFormatPricing = vi.mocked(formatPricing);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ManageModel Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEnvDefault.mockReturnValue("anthropic/claude-sonnet-4-5-20250929");
    mockFormatPricing.mockReturnValue("$3.00 / $15.00 per million tokens");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("get_current returns active model info", async () => {
    mockGetActive.mockResolvedValue({ model: "openai/gpt-4o", source: "preference" });
    mockFindModel.mockResolvedValue({
      id: "openai/gpt-4o",
      name: "GPT-4o",
      promptPrice: 2.5,
      completionPrice: 10,
      contextLength: 128000,
      provider: "openai",
    });

    const tool = createManageModelTool();
    const result = await tool.execute("tc-1", { action: "get_current" });
    const data = parseResult(result);

    expect(data.status).toBe("ok");
    expect(data.model).toBe("openai/gpt-4o");
    expect(data.source).toBe("preference");
  });

  it("list returns available models", async () => {
    mockFetchModels.mockResolvedValue([
      {
        id: "a/1",
        name: "Model A",
        promptPrice: 1,
        completionPrice: 5,
        contextLength: 100000,
        provider: "a",
      },
      {
        id: "b/2",
        name: "Model B",
        promptPrice: 2,
        completionPrice: 8,
        contextLength: 200000,
        provider: "b",
      },
    ]);

    const tool = createManageModelTool();
    const result = await tool.execute("tc-2", { action: "list" });
    const data = parseResult(result);

    expect(data.status).toBe("ok");
    expect(data.totalAvailable).toBe(2);
    expect(data.models).toHaveLength(2);
  });

  it("search filters by query", async () => {
    mockSearchModels.mockResolvedValue([
      {
        id: "anthropic/claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        promptPrice: 3,
        completionPrice: 15,
        contextLength: 200000,
        provider: "anthropic",
      },
    ]);

    const tool = createManageModelTool();
    const result = await tool.execute("tc-3", { action: "search", query: "claude" });
    const data = parseResult(result);

    expect(data.status).toBe("ok");
    expect(data.query).toBe("claude");
    expect(data.models).toHaveLength(1);
  });

  it("search rejects empty query", async () => {
    const tool = createManageModelTool();
    const result = await tool.execute("tc-4", { action: "search", query: "" });
    const data = parseResult(result);

    expect(data.status).toBe("error");
    expect(data.message).toContain("query is required");
  });

  it("switch sets model preference on valid model", async () => {
    mockFindModel.mockResolvedValue({
      id: "openai/gpt-4o",
      name: "GPT-4o",
      promptPrice: 2.5,
      completionPrice: 10,
      contextLength: 128000,
      provider: "openai",
    });
    mockGetActive.mockResolvedValue({ model: "anthropic/claude-sonnet-4-5", source: "env" });
    mockSetPref.mockResolvedValue(true);

    const tool = createManageModelTool();
    const result = await tool.execute("tc-5", { action: "switch", model_id: "openai/gpt-4o" });
    const data = parseResult(result);

    expect(data.status).toBe("switched");
    expect(data.current.model).toBe("openai/gpt-4o");
    expect(mockSetPref).toHaveBeenCalledWith("openai/gpt-4o");
  });

  it("switch rejects unknown model with suggestions", async () => {
    mockFindModel.mockResolvedValue(undefined);
    mockSearchModels.mockResolvedValue([
      {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        promptPrice: 2.5,
        completionPrice: 10,
        contextLength: 128000,
        provider: "openai",
      },
    ]);

    const tool = createManageModelTool();
    const result = await tool.execute("tc-6", { action: "switch", model_id: "openai/gpt5" });
    const data = parseResult(result);

    expect(data.status).toBe("error");
    expect(data.message).toContain("not found");
    expect(data.suggestions).toContain("openai/gpt-4o");
  });

  it("switch rejects empty model_id", async () => {
    const tool = createManageModelTool();
    const result = await tool.execute("tc-7", { action: "switch", model_id: "" });
    const data = parseResult(result);

    expect(data.status).toBe("error");
    expect(data.message).toContain("model_id is required");
  });

  it("reset_default clears preference", async () => {
    mockGetActive.mockResolvedValue({ model: "openai/gpt-4o", source: "preference" });
    mockClearPref.mockResolvedValue(true);

    const tool = createManageModelTool();
    const result = await tool.execute("tc-8", { action: "reset_default" });
    const data = parseResult(result);

    expect(data.status).toBe("reset");
    expect(data.activeNow).toBe("anthropic/claude-sonnet-4-5-20250929");
    expect(mockClearPref).toHaveBeenCalled();
  });

  it("unknown action returns error", async () => {
    const tool = createManageModelTool();
    const result = await tool.execute("tc-9", { action: "explode" });
    const data = parseResult(result);

    expect(data.status).toBe("error");
    expect(data.message).toContain("Unknown action");
  });
});
