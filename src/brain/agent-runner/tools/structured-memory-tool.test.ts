/**
 * Tests for structured memory agent tools (memory_store, memory_search_structured).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// --- Supabase mock ---------------------------------------------------------

let _supabaseConfigured = true;

vi.mock("../../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => _supabaseConfigured,
}));

// --- DrofbotMemory mock ----------------------------------------------------

const mockSemanticStore = vi
  .fn<(opts: Record<string, unknown>) => Promise<string>>()
  .mockResolvedValue("sem-1");
const mockEpisodicStore = vi
  .fn<(opts: Record<string, unknown>) => Promise<string>>()
  .mockResolvedValue("epi-1");
const mockProceduralStore = vi
  .fn<(opts: Record<string, unknown>) => Promise<string>>()
  .mockResolvedValue("proc-1");
const mockRelationalStore = vi
  .fn<(opts: Record<string, unknown>) => Promise<string>>()
  .mockResolvedValue("rel-1");

const mockSemanticSearch = vi.fn().mockResolvedValue([]);
const mockEpisodicSearch = vi.fn().mockResolvedValue([]);
const mockProceduralSearch = vi.fn().mockResolvedValue([]);
const mockRelationalSearch = vi.fn().mockResolvedValue([]);

vi.mock("../../memory/drofbot-memory.js", () => ({
  getDrofbotMemory: () => ({
    isStructuredMemoryAvailable: _supabaseConfigured,
    semantic: { store: mockSemanticStore, search: mockSemanticSearch },
    episodic: { store: mockEpisodicStore, search: mockEpisodicSearch },
    procedural: { store: mockProceduralStore, search: mockProceduralSearch },
    relational: { store: mockRelationalStore, search: mockRelationalSearch },
  }),
}));

import {
  createMemoryStoreTool,
  createMemorySearchStructuredTool,
} from "./structured-memory-tool.js";

const CONFIG = { agents: { list: [{ id: "main", default: true }] } } as never;

// ---------------------------------------------------------------------------
// Factory / gating tests
// ---------------------------------------------------------------------------

describe("createMemoryStoreTool", () => {
  afterEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
  });

  it("returns null when config is undefined", () => {
    expect(createMemoryStoreTool({ config: undefined })).toBeNull();
  });

  it("returns null when Supabase is not configured", () => {
    _supabaseConfigured = false;
    expect(createMemoryStoreTool({ config: CONFIG })).toBeNull();
  });

  it("returns a tool when properly configured", () => {
    const tool = createMemoryStoreTool({ config: CONFIG });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("memory_store");
  });
});

describe("createMemorySearchStructuredTool", () => {
  afterEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
  });

  it("returns null when config is undefined", () => {
    expect(createMemorySearchStructuredTool({ config: undefined })).toBeNull();
  });

  it("returns null when Supabase is not configured", () => {
    _supabaseConfigured = false;
    expect(createMemorySearchStructuredTool({ config: CONFIG })).toBeNull();
  });

  it("returns a tool when properly configured", () => {
    const tool = createMemorySearchStructuredTool({ config: CONFIG });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("memory_search_structured");
  });
});

// ---------------------------------------------------------------------------
// memory_store execution
// ---------------------------------------------------------------------------

describe("memory_store execution", () => {
  afterEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
  });

  it("stores to semantic bank", async () => {
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    const result = await tool.execute("call_1", {
      bank: "semantic",
      content: "TypeScript uses structural typing",
      metadata: { category: "programming", confidence: 0.9, source: "conversation" },
    });

    expect(mockSemanticStore).toHaveBeenCalledWith({
      content: "TypeScript uses structural typing",
      category: "programming",
      confidence: 0.9,
      source: "conversation",
    });
    expect(result.details).toEqual({ stored: true, bank: "semantic", id: "sem-1" });
  });

  it("stores to episodic bank", async () => {
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    const result = await tool.execute("call_2", {
      bank: "episodic",
      content: "User discussed project deadlines",
      metadata: { channel: "discord", topic: "deadlines", importance: 7 },
    });

    expect(mockEpisodicStore).toHaveBeenCalledWith({
      content: "User discussed project deadlines",
      context: {
        channel: "discord",
        topic: "deadlines",
        session: undefined,
        participants: undefined,
      },
      importance: 7,
    });
    expect(result.details).toEqual({ stored: true, bank: "episodic", id: "epi-1" });
  });

  it("stores to procedural bank", async () => {
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    const result = await tool.execute("call_3", {
      bank: "procedural",
      content: "Deploy to production",
      metadata: { trigger_pattern: "deploy prod", steps: ["build", "test", "push"] },
    });

    expect(mockProceduralStore).toHaveBeenCalledWith({
      content: "Deploy to production",
      triggerPattern: "deploy prod",
      steps: ["build", "test", "push"],
    });
    expect(result.details).toEqual({ stored: true, bank: "procedural", id: "proc-1" });
  });

  it("stores to relational bank", async () => {
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    const result = await tool.execute("call_4", {
      bank: "relational",
      content: "Alice works with Bob",
      metadata: { entity_a: "Alice", entity_b: "Bob", relationship: "colleague" },
    });

    expect(mockRelationalStore).toHaveBeenCalledWith({
      entityA: "Alice",
      entityB: "Bob",
      relationship: "colleague",
      metadata: { entity_a: "Alice", entity_b: "Bob", relationship: "colleague" },
    });
    expect(result.details).toEqual({ stored: true, bank: "relational", id: "rel-1" });
  });

  it("returns error for relational bank missing required fields", async () => {
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    const result = await tool.execute("call_5", {
      bank: "relational",
      content: "incomplete",
      metadata: { entity_a: "Alice" },
    });

    expect(mockRelationalStore).not.toHaveBeenCalled();
    expect(result.details).toEqual({
      stored: false,
      error: "Relational bank requires metadata: entity_a, entity_b, relationship.",
    });
  });

  it("returns error for unknown bank", async () => {
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    const result = await tool.execute("call_6", {
      bank: "nonexistent",
      content: "test",
    });

    expect(result.details).toEqual({
      stored: false,
      error: 'Unknown bank "nonexistent". Must be episodic, semantic, procedural, or relational.',
    });
  });

  it("handles store failure gracefully", async () => {
    mockSemanticStore.mockRejectedValueOnce(new Error("DB connection failed"));
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    const result = await tool.execute("call_7", {
      bank: "semantic",
      content: "will fail",
    });

    expect(result.details).toEqual({
      stored: false,
      error: "DB connection failed",
    });
  });

  it("returns error when structured memory unavailable at execute time", async () => {
    const tool = createMemoryStoreTool({ config: CONFIG })!;
    // Simulate memory becoming unavailable after tool creation
    _supabaseConfigured = false;
    const result = await tool.execute("call_8", {
      bank: "semantic",
      content: "test",
    });

    expect(result.details).toEqual({
      stored: false,
      error: "Structured memory unavailable (Supabase not configured).",
    });
  });
});

// ---------------------------------------------------------------------------
// memory_search_structured execution
// ---------------------------------------------------------------------------

describe("memory_search_structured execution", () => {
  afterEach(() => {
    vi.clearAllMocks();
    _supabaseConfigured = true;
  });

  it("searches all banks by default", async () => {
    const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
    await tool.execute("call_1", { query: "TypeScript" });

    expect(mockSemanticSearch).toHaveBeenCalledWith({ query: "TypeScript", limit: 10 });
    expect(mockEpisodicSearch).toHaveBeenCalledWith({ query: "TypeScript", limit: 10 });
    expect(mockProceduralSearch).toHaveBeenCalledWith({ query: "TypeScript", limit: 10 });
    expect(mockRelationalSearch).toHaveBeenCalledWith({ query: "TypeScript", limit: 10 });
  });

  it("searches only specified banks", async () => {
    const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
    await tool.execute("call_2", { query: "project", banks: ["semantic", "episodic"] });

    expect(mockSemanticSearch).toHaveBeenCalled();
    expect(mockEpisodicSearch).toHaveBeenCalled();
    expect(mockProceduralSearch).not.toHaveBeenCalled();
    expect(mockRelationalSearch).not.toHaveBeenCalled();
  });

  it("respects custom limit", async () => {
    const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
    await tool.execute("call_3", { query: "test", limit: 5 });

    expect(mockSemanticSearch).toHaveBeenCalledWith({ query: "test", limit: 5 });
  });

  it("merges and sorts results by similarity", async () => {
    mockSemanticSearch.mockResolvedValueOnce([
      {
        entry: {
          id: "s1",
          content: "fact A",
          category: "general",
          confidence: 0.8,
          source: "chat",
        },
        similarity: 0.7,
      },
    ]);
    mockEpisodicSearch.mockResolvedValueOnce([
      {
        entry: {
          id: "e1",
          content: "event B",
          context: { channel: "discord" },
          importance: 5,
          created_at: "2025-01-01",
        },
        similarity: 0.9,
      },
    ]);
    mockProceduralSearch.mockResolvedValueOnce([]);
    mockRelationalSearch.mockResolvedValueOnce([]);

    const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
    const result = await tool.execute("call_4", { query: "test" });

    const details = result.details as {
      results: Array<{ bank: string; similarity: number }>;
      total: number;
    };
    expect(details.total).toBe(2);
    // Episodic result (0.9) should come before semantic (0.7)
    expect(details.results[0].bank).toBe("episodic");
    expect(details.results[0].similarity).toBe(0.9);
    expect(details.results[1].bank).toBe("semantic");
    expect(details.results[1].similarity).toBe(0.7);
  });

  it("formats relational results as entity text", async () => {
    mockRelationalSearch.mockResolvedValueOnce([
      {
        entry: { id: "r1", entity_a: "Alice", entity_b: "Bob", relationship: "colleague" },
        similarity: 0.85,
      },
    ]);
    mockSemanticSearch.mockResolvedValueOnce([]);
    mockEpisodicSearch.mockResolvedValueOnce([]);
    mockProceduralSearch.mockResolvedValueOnce([]);

    const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
    const result = await tool.execute("call_5", { query: "Alice" });

    const details = result.details as {
      results: Array<{ content: string; metadata: Record<string, unknown> }>;
    };
    expect(details.results[0].content).toBe("Alice —[colleague]→ Bob");
    expect(details.results[0].metadata.entity_a).toBe("Alice");
    expect(details.results[0].metadata.entity_b).toBe("Bob");
  });

  it("returns empty results when structured memory unavailable", async () => {
    const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
    _supabaseConfigured = false;
    const result = await tool.execute("call_6", { query: "test" });

    expect(result.details).toEqual({
      results: [],
      error: "Structured memory unavailable (Supabase not configured).",
    });
  });

  it("handles search failure gracefully", async () => {
    mockSemanticSearch.mockRejectedValueOnce(new Error("Embedding service down"));

    const tool = createMemorySearchStructuredTool({ config: CONFIG })!;
    const result = await tool.execute("call_7", { query: "test", banks: ["semantic"] });

    expect(result.details).toEqual({
      results: [],
      error: "Embedding service down",
    });
  });
});
