/**
 * Tests for the Episodic Memory Bank.
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

import { EpisodicMemoryBank } from "./episodic.js";

describe("EpisodicMemoryBank", () => {
  let bank: EpisodicMemoryBank;

  beforeEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
    bank = new EpisodicMemoryBank();
  });

  afterEach(() => {
    _supabaseConfigured = false;
  });

  describe("store", () => {
    it("inserts an episodic memory with context and importance", async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { id: "uuid-1" }, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      mockFrom.mockReturnValue({ insert: insertMock });

      await bank.store({
        content: "User decided to use TypeScript for the project",
        context: { session: "abc-123", topic: "tech-stack" },
        importance: 0.8,
      });

      expect(mockFrom).toHaveBeenCalledWith("memory_episodic");
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "User decided to use TypeScript for the project",
          context: { session: "abc-123", topic: "tech-stack" },
          importance: 0.8,
        }),
      );
    });

    it("defaults importance to 0.5 when not specified", async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { id: "uuid-2" }, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      mockFrom.mockReturnValue({ insert: insertMock });

      await bank.store({ content: "Something happened" });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ importance: 0.5 }),
      );
    });

    it("does nothing when Supabase is not configured", async () => {
      _supabaseConfigured = false;
      await bank.store({ content: "test" });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("includes embedding when provider is available", async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { id: "uuid-3" }, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      mockFrom.mockReturnValue({ insert: insertMock });

      bank.setEmbeddingProvider({
        id: "test",
        model: "test-embed",
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        embedBatch: vi.fn(),
      });

      await bank.store({ content: "Important event" });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ embedding: [0.1, 0.2, 0.3] }),
      );
    });
  });

  describe("search", () => {
    it("returns results from RPC search", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            id: "1",
            content: "Previous discussion about deployment",
            similarity: 0.85,
            context: { topic: "devops" },
            importance: 0.7,
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
        error: null,
      });

      // Need embedding provider for search query embedding
      bank.setEmbeddingProvider({
        id: "test",
        model: "test-embed",
        embedQuery: vi.fn().mockResolvedValue([0.5, 0.5]),
        embedBatch: vi.fn(),
      });

      const results = await bank.search({ query: "deployment" });

      expect(results).toHaveLength(1);
      expect(results[0].entry.content).toBe("Previous discussion about deployment");
      expect(results[0].similarity).toBe(0.85);
    });

    it("returns empty results when Supabase is not configured", async () => {
      _supabaseConfigured = false;
      const results = await bank.search({ query: "anything" });
      expect(results).toEqual([]);
    });
  });

  describe("getRecent", () => {
    it("returns recent entries ordered by timestamp descending", async () => {
      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              { id: "1", content: "Recent event 1", timestamp: "2024-01-02" },
              { id: "2", content: "Recent event 2", timestamp: "2024-01-01" },
            ],
            error: null,
          }),
        }),
      });
      mockFrom.mockReturnValue({ select: selectMock });

      const results = await bank.getRecent(2);

      expect(results).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith("memory_episodic");
      expect(results[0].content).toBe("Recent event 1");
    });
  });
});
