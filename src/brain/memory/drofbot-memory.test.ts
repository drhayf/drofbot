/**
 * Tests for the DrofbotMemory unified interface.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

let _supabaseConfigured = false;

vi.mock("../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => _supabaseConfigured,
  getSupabaseClient: () => null,
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { DrofbotMemory, getDrofbotMemory, resetDrofbotMemory } from "./drofbot-memory.js";

describe("DrofbotMemory", () => {
  afterEach(() => {
    resetDrofbotMemory();
    _supabaseConfigured = false;
  });

  it("reports structured memory unavailable when Supabase not configured", () => {
    _supabaseConfigured = false;
    const memory = new DrofbotMemory();
    expect(memory.isStructuredMemoryAvailable).toBe(false);
  });

  it("reports structured memory available when Supabase is configured", () => {
    _supabaseConfigured = true;
    const memory = new DrofbotMemory();
    expect(memory.isStructuredMemoryAvailable).toBe(true);
  });

  it("initializes all four banks", () => {
    const memory = new DrofbotMemory();
    expect(memory.episodic).toBeDefined();
    expect(memory.semantic).toBeDefined();
    expect(memory.procedural).toBeDefined();
    expect(memory.relational).toBeDefined();
  });

  it("propagates embedding provider to all banks", () => {
    const memory = new DrofbotMemory();
    const provider = {
      id: "test-provider",
      model: "test-model",
      embedQuery: vi.fn(),
      embedBatch: vi.fn(),
    };

    // Should not throw
    memory.setEmbeddingProvider(provider);
  });

  describe("singleton", () => {
    it("getDrofbotMemory returns same instance", () => {
      const a = getDrofbotMemory();
      const b = getDrofbotMemory();
      expect(a).toBe(b);
    });

    it("resetDrofbotMemory clears the singleton", () => {
      const a = getDrofbotMemory();
      resetDrofbotMemory();
      const b = getDrofbotMemory();
      expect(a).not.toBe(b);
    });
  });
});
