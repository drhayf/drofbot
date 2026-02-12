/**
 * Tests for the Structured Memory Integration bridge.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// --- Mock setup ------------------------------------------------------------

const mockRetrieverSearch = vi.fn();
const mockClassifierClassify = vi.fn();
const mockEpisodicStore = vi.fn().mockResolvedValue(undefined);

let _supabaseConfigured = true;

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

vi.mock("./drofbot-memory.js", () => ({
  getDrofbotMemory: () => ({
    isStructuredMemoryAvailable: _supabaseConfigured,
    episodic: {
      store: mockEpisodicStore,
      search: vi.fn().mockResolvedValue([]),
      getRecent: vi.fn().mockResolvedValue([]),
    },
    semantic: {
      store: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      exists: vi.fn().mockResolvedValue(false),
    },
    procedural: {
      store: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    },
    relational: {
      store: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    },
    setEmbeddingProvider: vi.fn(),
  }),
  resetDrofbotMemory: vi.fn(),
}));

vi.mock("./retriever.js", () => {
  return {
    MemoryRetriever: class MockRetriever {
      search(...args: unknown[]) {
        return mockRetrieverSearch(...args);
      }

      static groupByBank(
        results: Array<{ bank: string }>,
      ): Record<string, Array<{ bank: string }>> {
        const grouped: Record<string, Array<{ bank: string }>> = {};
        for (const r of results) {
          if (!grouped[r.bank]) grouped[r.bank] = [];
          grouped[r.bank].push(r);
        }
        return grouped;
      }
    },
  };
});

vi.mock("./classifier.js", () => {
  return {
    MemoryClassifier: class MockClassifier {
      classify(...args: unknown[]) {
        return mockClassifierClassify(...args);
      }
    },
  };
});

import {
  fetchStructuredMemoryContext,
  classifyAndStorePostTurn,
  flushCompactionMemory,
} from "./structured-memory-integration.js";

describe("Structured Memory Integration", () => {
  afterEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
  });

  describe("fetchStructuredMemoryContext", () => {
    it("returns null when structured memory is not available", async () => {
      _supabaseConfigured = false;

      const result = await fetchStructuredMemoryContext(
        "hello",
        { config: {} as never },
      );

      expect(result).toBeNull();
    });

    it("returns formatted context when memories are found", async () => {
      mockRetrieverSearch.mockResolvedValue([
        {
          bank: "semantic",
          content: "User prefers TypeScript",
          similarity: 0.92,
          metadata: {},
        },
        {
          bank: "episodic",
          content: "Discussed project architecture yesterday",
          similarity: 0.85,
          metadata: {},
        },
      ]);

      const result = await fetchStructuredMemoryContext(
        "what do we know about the project",
        { config: {} as never },
      );

      expect(result).toBeDefined();
      expect(result).toContain("TypeScript");
      expect(result).toContain("architecture");
    });

    it("returns null when no memories are found", async () => {
      mockRetrieverSearch.mockResolvedValue([]);

      const result = await fetchStructuredMemoryContext(
        "something",
        { config: {} as never },
      );

      expect(result).toBeNull();
    });

    it("throws on retriever error (caller handles)", async () => {
      mockRetrieverSearch.mockRejectedValue(new Error("search failed"));

      await expect(
        fetchStructuredMemoryContext("test", { config: {} as never }),
      ).rejects.toThrow("search failed");
    });
  });

  describe("classifyAndStorePostTurn", () => {
    it("does nothing when structured memory is not available", async () => {
      _supabaseConfigured = false;

      await classifyAndStorePostTurn(
        "test",
        "response",
        { sessionId: "s1", config: {} as never },
      );

      expect(mockClassifierClassify).not.toHaveBeenCalled();
    });

    it("classifies the exchange and does not store when shouldStore is false", async () => {
      mockClassifierClassify.mockResolvedValue({
        shouldStore: false,
        banks: [],
      });

      await classifyAndStorePostTurn(
        "hello",
        "hi there!",
        { sessionId: "s1", config: {} as never },
      );

      expect(mockClassifierClassify).toHaveBeenCalled();
    });

    it("propagates classifier errors to caller", async () => {
      mockClassifierClassify.mockRejectedValue(new Error("classify failed"));

      await expect(
        classifyAndStorePostTurn(
          "test",
          "response",
          { sessionId: "s1", config: {} as never },
        ),
      ).rejects.toThrow("classify failed");
    });
  });

  describe("flushCompactionMemory", () => {
    it("does nothing when structured memory is not available", async () => {
      _supabaseConfigured = false;

      await flushCompactionMemory("compact summary", {
        sessionId: "s1",
      });

      expect(mockEpisodicStore).not.toHaveBeenCalled();
    });

    it("stores compaction summary in episodic memory", async () => {
      await flushCompactionMemory("Session summary: discussed TypeScript migration", {
        sessionId: "sess-123",
      });

      expect(mockEpisodicStore).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("TypeScript migration"),
          importance: 0.7,
        }),
      );
    });

    it("handles storage errors gracefully", async () => {
      mockEpisodicStore.mockRejectedValue(new Error("storage failed"));

      // Should not throw
      await flushCompactionMemory("summary", { sessionId: "k" });
    });
  });
});
