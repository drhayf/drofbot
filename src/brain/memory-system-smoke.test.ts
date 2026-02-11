/**
 * Smoke tests for Drofbot's structured memory system.
 *
 * Verifies the complete memory pipeline from agent tool invocation through
 * bank storage/search and back. Supabase is mocked at the client level;
 * every layer above it is exercised:
 *
 *   Agent Tool → DrofbotMemory singleton → Memory Bank → Supabase client (mocked)
 *
 * Scenarios covered:
 *   1. Embedding provider auto-wire lifecycle
 *   2. memory_store tool → bank.store() → supabase insert
 *   3. memory_search_structured tool → bank.search() → supabase RPC
 *   4. Graceful degradation when Supabase is not configured
 *   5. Consolidation runner lifecycle (start/stop)
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted runs before vi.mock)
// ---------------------------------------------------------------------------

const { mockInsert, mockFrom, mockRpc, mockSupabaseClient, mockEmbedQuery, mockEmbedBatch } =
  vi.hoisted(() => {
    const _mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "smoke-1" }, error: null }),
      }),
    });
    const _mockFrom = vi.fn().mockReturnValue({ insert: _mockInsert });
    const _mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const _mockEmbedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));
    const _mockEmbedBatch = vi
      .fn()
      .mockImplementation((texts: string[]) =>
        Promise.resolve(texts.map(() => new Array(1536).fill(0.1))),
      );
    return {
      mockInsert: _mockInsert,
      mockFrom: _mockFrom,
      mockRpc: _mockRpc,
      mockSupabaseClient: { from: _mockFrom, rpc: _mockRpc },
      mockEmbedQuery: _mockEmbedQuery,
      mockEmbedBatch: _mockEmbedBatch,
    };
  });

let _supabaseConfigured = true;

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../shared/database/client.js", () => ({
  isSupabaseConfigured: () => _supabaseConfigured,
  getSupabaseClient: () => (_supabaseConfigured ? mockSupabaseClient : null),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("./memory/embeddings.js", () => ({
  createEmbeddingProvider: vi.fn().mockResolvedValue({
    provider: {
      id: "mock",
      model: "mock-embed",
      embedQuery: mockEmbedQuery,
      embedBatch: mockEmbedBatch,
    },
  }),
}));

vi.mock("./agent-runner/agent-scope.js", () => ({
  resolveSessionAgentId: vi.fn().mockReturnValue("main"),
}));

vi.mock("./agent-runner/memory-search.js", () => ({
  resolveMemorySearchConfig: vi.fn().mockReturnValue({
    provider: "openai",
    model: "text-embedding-3-small",
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  createMemoryStoreTool,
  createMemorySearchStructuredTool,
} from "./agent-runner/tools/structured-memory-tool.js";
import { startConsolidationRunner } from "./cron/consolidation.js";
import {
  getDrofbotMemory,
  resetDrofbotMemory,
  initStructuredMemoryEmbeddings,
  resetEmbeddingInit,
} from "./memory/drofbot-memory.js";

const CONFIG = {} as never;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Memory System E2E Smoke Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetDrofbotMemory();
    resetEmbeddingInit();
    _supabaseConfigured = true;
  });

  // -------------------------------------------------------------------------
  // 1. Embedding provider auto-wire
  // -------------------------------------------------------------------------
  describe("embedding provider auto-wire", () => {
    it("initializes embedding provider from config", async () => {
      await initStructuredMemoryEmbeddings(CONFIG);
      const memory = getDrofbotMemory();
      // After init, the memory should have an embedding provider set
      expect(memory.isStructuredMemoryAvailable).toBe(true);
    });

    it("skips when Supabase is not configured", async () => {
      _supabaseConfigured = false;
      // Should not throw, just no-op
      await initStructuredMemoryEmbeddings(CONFIG);
    });

    it("is idempotent (double-init does not throw)", async () => {
      await initStructuredMemoryEmbeddings(CONFIG);
      await initStructuredMemoryEmbeddings(CONFIG);
      // Second call is a no-op
    });
  });

  // -------------------------------------------------------------------------
  // 2. Full store pipeline: tool → bank → supabase
  // -------------------------------------------------------------------------
  describe("store pipeline", () => {
    it("memory_store tool stores to semantic bank via Supabase insert", async () => {
      await initStructuredMemoryEmbeddings(CONFIG);
      const tool = createMemoryStoreTool({ config: CONFIG })!;
      expect(tool).not.toBeNull();

      const result = await tool.execute("e2e-store-1", {
        bank: "semantic",
        content: "TypeScript supports structural typing",
        metadata: { category: "programming", confidence: 0.9 },
      });

      expect(result.details).toEqual(expect.objectContaining({ stored: true, bank: "semantic" }));
      expect(mockFrom).toHaveBeenCalledWith("memory_semantic");
    });

    it("memory_store tool handles relational bank with entities", async () => {
      await initStructuredMemoryEmbeddings(CONFIG);
      const tool = createMemoryStoreTool({ config: CONFIG })!;

      const result = await tool.execute("e2e-store-2", {
        bank: "relational",
        content: "Alice collaborates with Bob",
        metadata: { entity_a: "Alice", entity_b: "Bob", relationship: "collaborator" },
      });

      expect(result.details).toEqual(expect.objectContaining({ stored: true, bank: "relational" }));
      expect(mockFrom).toHaveBeenCalledWith("memory_relational");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Full search pipeline: tool → bank → supabase RPC
  // -------------------------------------------------------------------------
  describe("search pipeline", () => {
    it("memory_search_structured tool searches via Supabase RPC", async () => {
      await initStructuredMemoryEmbeddings(CONFIG);
      const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
      expect(tool).not.toBeNull();

      const result = await tool.execute("e2e-search-1", {
        query: "TypeScript patterns",
        banks: ["semantic"],
        limit: 5,
      });

      const details = result.details as {
        results: unknown[];
        banks_searched: string[];
        total: number;
      };
      expect(details.banks_searched).toContain("semantic");
      // RPC mock returns empty, so total is 0
      expect(details.total).toBe(0);
    });

    it("searches all banks when none specified", async () => {
      await initStructuredMemoryEmbeddings(CONFIG);
      const tool = createMemorySearchStructuredTool({ config: CONFIG })!;

      await tool.execute("e2e-search-2", { query: "anything" });

      // Should call RPC for each bank's search function
      expect(mockRpc).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Graceful degradation
  // -------------------------------------------------------------------------
  describe("graceful degradation", () => {
    it("tools return null when Supabase not configured", () => {
      _supabaseConfigured = false;

      const storeTool = createMemoryStoreTool({ config: CONFIG });
      const searchTool = createMemorySearchStructuredTool({ config: CONFIG });

      expect(storeTool).toBeNull();
      expect(searchTool).toBeNull();
    });

    it("DrofbotMemory reports unavailable when Supabase not configured", () => {
      _supabaseConfigured = false;
      resetDrofbotMemory();
      const memory = getDrofbotMemory();
      expect(memory.isStructuredMemoryAvailable).toBe(false);
    });

    it("bank operations return null without Supabase", async () => {
      _supabaseConfigured = false;
      resetDrofbotMemory();
      const memory = getDrofbotMemory();

      // Store returns null when Supabase client is unavailable
      const result = await memory.semantic.store({ content: "test" });
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Consolidation runner lifecycle
  // -------------------------------------------------------------------------
  describe("consolidation runner", () => {
    it("starts and stops cleanly", () => {
      const runner = startConsolidationRunner({
        cfg: { memory: { consolidation: { enabled: true } } } as never,
      });

      expect(runner).toBeDefined();
      expect(typeof runner.stop).toBe("function");
      runner.stop();
    });

    it("returns no-op when disabled", () => {
      const runner = startConsolidationRunner({
        cfg: { memory: { consolidation: { enabled: false } } } as never,
      });

      runner.stop(); // Should not throw
    });
  });
});
