/**
 * Tests for the base memory bank utilities.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
};

let _supabaseConfigured = false;

vi.mock("../../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => _supabaseConfigured,
  getSupabaseClient: () => mockSupabaseClient,
}));

vi.mock("../../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { BaseMemoryBank, requireSupabase } from "./base.js";

// Concrete test subclass
class TestBank extends BaseMemoryBank {
  constructor() {
    super("episodic");
  }

  /** Expose protected methods for testing */
  async testEmbed(text: string) {
    return this.embed(text);
  }

  testGetClient() {
    return this.getClient();
  }
}

describe("BaseMemoryBank", () => {
  let bank: TestBank;

  beforeEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
    bank = new TestBank();
  });

  afterEach(() => {
    _supabaseConfigured = false;
  });

  describe("requireSupabase", () => {
    it("returns true when Supabase is configured", () => {
      _supabaseConfigured = true;
      expect(requireSupabase()).toBe(true);
    });

    it("returns false when Supabase is not configured", () => {
      _supabaseConfigured = false;
      expect(requireSupabase()).toBe(false);
    });
  });

  describe("getClient", () => {
    it("returns Supabase client when configured", () => {
      const client = bank.testGetClient();
      expect(client).toBe(mockSupabaseClient);
    });

    it("returns null when Supabase is not configured", () => {
      _supabaseConfigured = false;
      const client = bank.testGetClient();
      expect(client).toBeNull();
    });
  });

  describe("embed", () => {
    it("returns empty array when no provider is set", async () => {
      const embedding = await bank.testEmbed("test text");
      expect(embedding).toEqual([]);
    });

    it("generates embedding when provider is set", async () => {
      const mockProvider = {
        id: "test-provider",
        model: "test-model",
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        embedBatch: vi.fn(),
      };

      bank.setEmbeddingProvider(mockProvider);
      const embedding = await bank.testEmbed("test text");

      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(mockProvider.embedQuery).toHaveBeenCalledWith("test text");
    });

    it("returns empty array on embedding error", async () => {
      const mockProvider = {
        id: "test-provider",
        model: "test-model",
        embedQuery: vi.fn().mockRejectedValue(new Error("API error")),
        embedBatch: vi.fn(),
      };

      bank.setEmbeddingProvider(mockProvider);
      const embedding = await bank.testEmbed("test text");

      expect(embedding).toEqual([]);
    });
  });
});
