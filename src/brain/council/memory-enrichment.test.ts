/**
 * Tests for Memory Schema Completion (Phase 4 — Area 4).
 *
 * Verifies that all four memory banks (episodic, semantic, procedural,
 * relational) support cosmic enrichment via their JSONB metadata columns.
 */

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockInsert, mockFrom, mockSupabaseClient, mockEmbedQuery, capturedInserts } = vi.hoisted(
  () => {
    const _captured: Record<string, unknown[]> = {};
    const _mockInsert = vi.fn().mockImplementation((row: unknown) => {
      // Capture the inserted row for assertions
      const last = Object.keys(_captured).pop();
      if (last) _captured[last].push(row);
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "test-1" }, error: null }),
        }),
      };
    });
    const _mockFrom = vi.fn().mockImplementation((table: string) => {
      _captured[table] = _captured[table] ?? [];
      return { insert: _mockInsert };
    });
    const _mockEmbedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));
    return {
      mockInsert: _mockInsert,
      mockFrom: _mockFrom,
      mockSupabaseClient: { from: _mockFrom, rpc: vi.fn() },
      mockEmbedQuery: _mockEmbedQuery,
      capturedInserts: _captured,
    };
  },
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => mockSupabaseClient,
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../memory/embeddings.js", () => ({
  createEmbeddingProvider: vi.fn().mockResolvedValue({
    provider: {
      id: "mock",
      model: "mock-embed",
      embedQuery: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      embedBatch: vi
        .fn()
        .mockImplementation((texts: string[]) =>
          Promise.resolve(texts.map(() => new Array(1536).fill(0.1))),
        ),
    },
  }),
}));

vi.mock("../agent-runner/agent-scope.js", () => ({
  resolveSessionAgentId: vi.fn().mockReturnValue("main"),
}));

vi.mock("../agent-runner/memory-search.js", () => ({
  resolveMemorySearchConfig: vi.fn().mockReturnValue({
    provider: "openai",
    model: "text-embedding-3-small",
  }),
}));

// Mock the enrichment module to inject a known cosmic snapshot
const mockCosmic = {
  ts: "2024-06-15T12:00:00.000Z",
  gate: { sun: 35, line: 4, earth: 5 },
  moon: { phase: "Waxing Gibbous", illum: 0.72 },
  card: { planet: "Venus", card: "7♥", day: 12, suit: "Hearts" },
};

vi.mock("../council/enrichment.js", () => ({
  enrichWithCosmic: vi.fn().mockImplementation(async (metadata?: Record<string, unknown>) => {
    return { ...(metadata ?? {}), cosmic: mockCosmic };
  }),
  matchesCosmicFilter: vi.fn().mockReturnValue(true),
  initEnrichment: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { enrichWithCosmic } from "../council/enrichment.js";
import { EpisodicMemoryBank } from "../memory/banks/episodic.js";
import { ProceduralMemoryBank } from "../memory/banks/procedural.js";
import { RelationalMemoryBank } from "../memory/banks/relational.js";
import { SemanticMemoryBank } from "../memory/banks/semantic.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Memory Schema Completion — Cosmic Enrichment on All Banks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear captured inserts
    for (const key of Object.keys(capturedInserts)) {
      delete capturedInserts[key];
    }
  });

  // ── Episodic ────────────────────────────────────────────────

  it("episodic bank enriches context with cosmic snapshot", async () => {
    const bank = new EpisodicMemoryBank();
    await bank.store({
      content: "Had a revealing conversation about life purpose",
      context: { topic: "purpose", channel: "web" },
    });

    expect(enrichWithCosmic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "purpose", channel: "web" }),
    );
    expect(mockFrom).toHaveBeenCalledWith("memory_episodic");

    // Verify insert was called with enriched context
    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.context.cosmic).toEqual(mockCosmic);
    expect(insertCall.context.topic).toBe("purpose");
  });

  // ── Semantic ────────────────────────────────────────────────

  it("semantic bank enriches metadata with cosmic snapshot", async () => {
    const bank = new SemanticMemoryBank();
    await bank.store({
      content: "Operator prefers morning briefings at 7am",
      category: "preference",
      metadata: { source: "conversation" },
    });

    expect(enrichWithCosmic).toHaveBeenCalledWith(
      expect.objectContaining({ source: "conversation" }),
    );
    expect(mockFrom).toHaveBeenCalledWith("memory_semantic");

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.metadata.cosmic).toEqual(mockCosmic);
    expect(insertCall.metadata.source).toBe("conversation");
  });

  it("semantic bank stores cosmic even without explicit metadata", async () => {
    const bank = new SemanticMemoryBank();
    await bank.store({
      content: "The sky is blue",
      category: "fact",
    });

    expect(enrichWithCosmic).toHaveBeenCalled();
    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.metadata.cosmic).toEqual(mockCosmic);
  });

  // ── Procedural ──────────────────────────────────────────────

  it("procedural bank enriches metadata with cosmic snapshot", async () => {
    const bank = new ProceduralMemoryBank();
    await bank.store({
      content: "When operator says 'run diagnostics', check all systems",
      triggerPattern: "run diagnostics",
      steps: [{ action: "check_health" }, { action: "report" }],
      metadata: { origin: "learned" },
    });

    expect(enrichWithCosmic).toHaveBeenCalledWith(expect.objectContaining({ origin: "learned" }));
    expect(mockFrom).toHaveBeenCalledWith("memory_procedural");

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.metadata.cosmic).toEqual(mockCosmic);
    expect(insertCall.metadata.origin).toBe("learned");
  });

  it("procedural bank stores cosmic even without explicit metadata", async () => {
    const bank = new ProceduralMemoryBank();
    await bank.store({
      content: "Check the weather before briefing",
      triggerPattern: "morning briefing",
    });

    expect(enrichWithCosmic).toHaveBeenCalled();
    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.metadata.cosmic).toEqual(mockCosmic);
  });

  // ── Relational ──────────────────────────────────────────────

  it("relational bank enriches metadata with cosmic snapshot", async () => {
    const bank = new RelationalMemoryBank();
    await bank.store({
      entityA: "operator",
      entityB: "Alice",
      relationship: "friend",
      metadata: { context: "mentioned in chat" },
    });

    expect(enrichWithCosmic).toHaveBeenCalledWith(
      expect.objectContaining({ context: "mentioned in chat" }),
    );
    expect(mockFrom).toHaveBeenCalledWith("memory_relational");

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.metadata.cosmic).toEqual(mockCosmic);
  });

  // ── Cross-bank consistency ──────────────────────────────────

  it("all four banks call enrichWithCosmic during store", async () => {
    const episodic = new EpisodicMemoryBank();
    const semantic = new SemanticMemoryBank();
    const procedural = new ProceduralMemoryBank();
    const relational = new RelationalMemoryBank();

    await episodic.store({ content: "event" });
    await semantic.store({ content: "fact" });
    await procedural.store({ content: "procedure" });
    await relational.store({
      entityA: "A",
      entityB: "B",
      relationship: "knows",
    });

    expect(enrichWithCosmic).toHaveBeenCalledTimes(4);
  });

  it("cosmic snapshot contains expected fields", () => {
    expect(mockCosmic.ts).toBeDefined();
    expect(mockCosmic.gate).toBeDefined();
    expect(mockCosmic.gate.sun).toBe(35);
    expect(mockCosmic.moon).toBeDefined();
    expect(mockCosmic.card).toBeDefined();
  });
});
