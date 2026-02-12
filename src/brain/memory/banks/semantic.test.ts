/**
 * Tests for the Semantic Memory Bank.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Supabase mock ---------------------------------------------------------

const mockFrom = vi.fn();
const mockRpc = vi.fn();

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc,
};

let _supabaseConfigured = true;

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

import { SemanticMemoryBank } from "./semantic.js";

describe("SemanticMemoryBank", () => {
  let bank: SemanticMemoryBank;

  beforeEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
    bank = new SemanticMemoryBank();
  });

  afterEach(() => {
    _supabaseConfigured = false;
  });

  describe("store", () => {
    it("inserts a semantic memory with category and confidence", async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { id: "uuid-1" }, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      mockFrom.mockReturnValue({ insert: insertMock });

      await bank.store({
        content: "User prefers dark mode editors",
        category: "preference",
        confidence: 0.9,
        source: "conversation-2024-01",
      });

      expect(mockFrom).toHaveBeenCalledWith("memory_semantic");
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "User prefers dark mode editors",
          category: "preference",
          confidence: 0.9,
          source: "conversation-2024-01",
        }),
      );
    });

    it("defaults confidence to 0.8", async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { id: "uuid-2" }, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      mockFrom.mockReturnValue({ insert: insertMock });

      await bank.store({ content: "Some fact" });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ confidence: 0.8 }),
      );
    });

    it("does nothing when Supabase is not configured", async () => {
      _supabaseConfigured = false;
      await bank.store({ content: "test" });
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("exists", () => {
    it("returns true when similar content exists", async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: "1", content: "User prefers dark mode", similarity: 0.98 }],
        error: null,
      });

      bank.setEmbeddingProvider({
        id: "test",
        model: "test-embed",
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
        embedBatch: vi.fn(),
      });

      const result = await bank.exists("User prefers dark mode");
      expect(result).toBe(true);
    });

    it("returns false when no similar content exists", async () => {
      mockRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      bank.setEmbeddingProvider({
        id: "test",
        model: "test-embed",
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
        embedBatch: vi.fn(),
      });

      const result = await bank.exists("Something totally new");
      expect(result).toBe(false);
    });

    it("returns false when Supabase is not configured", async () => {
      _supabaseConfigured = false;
      const result = await bank.exists("anything");
      expect(result).toBe(false);
    });
  });

  describe("search", () => {
    it("returns results from RPC search", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            id: "1",
            content: "User works with TypeScript",
            similarity: 0.92,
            category: "fact",
            confidence: 0.85,
          },
        ],
        error: null,
      });

      bank.setEmbeddingProvider({
        id: "test",
        model: "test-embed",
        embedQuery: vi.fn().mockResolvedValue([0.5, 0.5]),
        embedBatch: vi.fn(),
      });

      const results = await bank.search({ query: "TypeScript" });

      expect(results).toHaveLength(1);
      expect(results[0].entry.content).toBe("User works with TypeScript");
      expect(results[0].similarity).toBe(0.92);
    });

    it("returns empty results when Supabase is not configured", async () => {
      _supabaseConfigured = false;
      const results = await bank.search({ query: "anything" });
      expect(results).toEqual([]);
    });
  });
});
