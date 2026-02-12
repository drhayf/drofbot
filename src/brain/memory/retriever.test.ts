/**
 * Tests for the Memory Retriever.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { MemoryRetriever, type RetrievalResult } from "./retriever.js";
import type { DrofbotMemory } from "./drofbot-memory.js";

function createMockMemory(opts?: { available?: boolean }): DrofbotMemory {
  return {
    isStructuredMemoryAvailable: opts?.available ?? true,
    episodic: {
      search: vi.fn().mockResolvedValue([]),
      getRecent: vi.fn().mockResolvedValue([]),
    },
    semantic: {
      search: vi.fn().mockResolvedValue([]),
    },
    procedural: {
      search: vi.fn().mockResolvedValue([]),
    },
    relational: {
      search: vi.fn().mockResolvedValue([]),
    },
  } as unknown as DrofbotMemory;
}

describe("MemoryRetriever", () => {
  describe("search", () => {
    it("always includes semantic bank", async () => {
      const memory = createMockMemory();
      const retriever = new MemoryRetriever(memory);

      await retriever.search({ query: "what color is the sky" });

      expect(memory.semantic.search).toHaveBeenCalled();
    });

    it("includes episodic bank for time-reference queries", async () => {
      const memory = createMockMemory();
      const retriever = new MemoryRetriever(memory);

      await retriever.search({ query: "what did we discuss yesterday" });

      expect(memory.episodic.search).toHaveBeenCalled();
      expect(memory.semantic.search).toHaveBeenCalled();
    });

    it("includes procedural bank for how-to queries", async () => {
      const memory = createMockMemory();
      const retriever = new MemoryRetriever(memory);

      await retriever.search({ query: "how to deploy to production" });

      expect(memory.procedural.search).toHaveBeenCalled();
      expect(memory.semantic.search).toHaveBeenCalled();
    });

    it("includes relational bank for relationship queries", async () => {
      const memory = createMockMemory();
      const retriever = new MemoryRetriever(memory);

      await retriever.search({ query: "what depends on the database" });

      expect(memory.relational.search).toHaveBeenCalled();
      expect(memory.semantic.search).toHaveBeenCalled();
    });

    it("respects forced bank selection", async () => {
      const memory = createMockMemory();
      const retriever = new MemoryRetriever(memory);

      await retriever.search({
        query: "anything",
        banks: ["procedural", "relational"],
      });

      expect(memory.procedural.search).toHaveBeenCalled();
      expect(memory.relational.search).toHaveBeenCalled();
      // Semantic should NOT be called when banks are forced
      expect(memory.semantic.search).not.toHaveBeenCalled();
    });

    it("returns empty when memory is not available", async () => {
      const memory = createMockMemory({ available: false });
      const retriever = new MemoryRetriever(memory);

      const results = await retriever.search({ query: "anything" });

      expect(results).toEqual([]);
      expect(memory.semantic.search).not.toHaveBeenCalled();
    });

    it("merges and ranks results from multiple banks", async () => {
      const memory = createMockMemory();
      (memory.semantic.search as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          entry: { content: "User likes TypeScript", category: "preference", confidence: 0.9 },
          similarity: 0.85,
        },
      ]);
      (memory.episodic.search as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          entry: {
            content: "Discussed TypeScript yesterday",
            context: { topic: "tech" },
            importance: 0.7,
          },
          similarity: 0.92,
        },
      ]);

      const retriever = new MemoryRetriever(memory);

      const results = await retriever.search({
        query: "what do we know about TypeScript from last time",
      });

      // Results should be sorted by similarity descending
      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.92); // episodic first (higher sim)
      expect(results[1].similarity).toBe(0.85); // semantic second
    });

    it("limits total results to maxResults", async () => {
      const memory = createMockMemory();
      (memory.semantic.search as ReturnType<typeof vi.fn>).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          entry: { content: `Fact ${i}`, category: "fact", confidence: 0.8 },
          similarity: 0.9 - i * 0.01,
        })),
      );

      const retriever = new MemoryRetriever(memory);
      const results = await retriever.search({ query: "facts", maxResults: 5 });

      expect(results).toHaveLength(5);
    });

    it("handles bank search errors gracefully", async () => {
      const memory = createMockMemory();
      (memory.semantic.search as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB connection error"),
      );

      const retriever = new MemoryRetriever(memory);
      const results = await retriever.search({ query: "test" });

      // Should return empty results, not throw
      expect(results).toEqual([]);
    });
  });

  describe("groupByBank", () => {
    it("groups results by bank name", () => {
      const results: RetrievalResult[] = [
        { bank: "semantic", content: "fact 1", similarity: 0.9, metadata: {} },
        { bank: "episodic", content: "event 1", similarity: 0.8, metadata: {} },
        { bank: "semantic", content: "fact 2", similarity: 0.7, metadata: {} },
      ];

      const grouped = MemoryRetriever.groupByBank(results);

      expect(grouped.semantic).toHaveLength(2);
      expect(grouped.episodic).toHaveLength(1);
      expect(grouped.procedural).toBeUndefined();
    });

    it("handles empty input", () => {
      const grouped = MemoryRetriever.groupByBank([]);
      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });
});
