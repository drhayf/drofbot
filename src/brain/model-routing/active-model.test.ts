/**
 * Tests for Active Model Resolution (Phase 7d — Part 3b).
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

vi.mock("../preferences/store.js", () => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
  deletePreference: vi.fn(),
}));

import { getPreference, setPreference, deletePreference } from "../preferences/store.js";
import {
  getActiveModel,
  getActiveModelSync,
  setModelPreference,
  clearModelPreference,
  getEnvDefaultModel,
} from "./active-model.js";

const mockGetPref = vi.mocked(getPreference);
const mockSetPref = vi.mocked(setPreference);
const mockDeletePref = vi.mocked(deletePreference);

describe("Active Model Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DROFBOT_LLM_MODEL;
  });

  afterEach(() => {
    delete process.env.DROFBOT_LLM_MODEL;
  });

  // -----------------------------------------------------------------------
  // getActiveModel (async, full resolution chain)
  // -----------------------------------------------------------------------

  it("returns preference when set", async () => {
    mockGetPref.mockResolvedValue({ model: "openai/gpt-4o" });
    const result = await getActiveModel();
    expect(result.model).toBe("openai/gpt-4o");
    expect(result.source).toBe("preference");
  });

  it("falls back to env when preference is not set", async () => {
    mockGetPref.mockResolvedValue(undefined);
    process.env.DROFBOT_LLM_MODEL = "anthropic/claude-opus-4";
    const result = await getActiveModel();
    expect(result.model).toBe("anthropic/claude-opus-4");
    expect(result.source).toBe("env");
  });

  it("falls back to hardcoded default when nothing configured", async () => {
    mockGetPref.mockResolvedValue(undefined);
    const result = await getActiveModel();
    expect(result.model).toBe("anthropic/claude-sonnet-4-5-20250929");
    expect(result.source).toBe("fallback");
  });

  it("ignores empty/whitespace preference", async () => {
    mockGetPref.mockResolvedValue({ model: "   " });
    const result = await getActiveModel();
    // Should skip empty and go to env or fallback
    expect(result.source).not.toBe("preference");
  });

  it("survives preference store errors", async () => {
    mockGetPref.mockRejectedValue(new Error("DB connection failed"));
    const result = await getActiveModel();
    // Should gracefully fall through to env or fallback
    expect(result.source).not.toBe("preference");
    expect(result.model).toBe("anthropic/claude-sonnet-4-5-20250929");
  });

  // -----------------------------------------------------------------------
  // getActiveModelSync
  // -----------------------------------------------------------------------

  it("sync: returns env model when set", () => {
    process.env.DROFBOT_LLM_MODEL = "meta/llama-3";
    expect(getActiveModelSync()).toBe("meta/llama-3");
  });

  it("sync: returns fallback when env not set", () => {
    expect(getActiveModelSync()).toBe("anthropic/claude-sonnet-4-5-20250929");
  });

  // -----------------------------------------------------------------------
  // setModelPreference / clearModelPreference
  // -----------------------------------------------------------------------

  it("sets model preference", async () => {
    mockSetPref.mockResolvedValue(true);
    const ok = await setModelPreference("openai/gpt-4o");
    expect(ok).toBe(true);
    expect(mockSetPref).toHaveBeenCalledWith("model.default", { model: "openai/gpt-4o" }, false);
  });

  it("trims whitespace when setting model", async () => {
    mockSetPref.mockResolvedValue(true);
    await setModelPreference("  openai/gpt-4o  ");
    expect(mockSetPref).toHaveBeenCalledWith("model.default", { model: "openai/gpt-4o" }, false);
  });

  it("clears model preference", async () => {
    mockDeletePref.mockResolvedValue(true);
    const ok = await clearModelPreference();
    expect(ok).toBe(true);
    expect(mockDeletePref).toHaveBeenCalledWith("model.default");
  });

  // -----------------------------------------------------------------------
  // getEnvDefaultModel
  // -----------------------------------------------------------------------

  it("getEnvDefaultModel respects env", () => {
    process.env.DROFBOT_LLM_MODEL = "custom/model";
    expect(getEnvDefaultModel()).toBe("custom/model");
  });

  it("getEnvDefaultModel returns hardcoded fallback", () => {
    expect(getEnvDefaultModel()).toBe("anthropic/claude-sonnet-4-5-20250929");
  });
});
