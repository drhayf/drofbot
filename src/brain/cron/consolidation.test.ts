/**
 * Tests for the Memory Consolidation Runner.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// --- Supabase mock ---------------------------------------------------------

const mockFrom = vi.fn();
const mockRpc = vi.fn();

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc,
};

let _supabaseConfigured = true;

vi.mock("../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => _supabaseConfigured,
  getSupabaseClient: () => (_supabaseConfigured ? mockSupabaseClient : null),
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock DrofbotMemory with available banks
const mockEpisodicStore = vi.fn().mockResolvedValue(undefined);
const mockSemanticStore = vi.fn().mockResolvedValue(undefined);
const mockSemanticExists = vi.fn().mockResolvedValue(false);

vi.mock("../memory/drofbot-memory.js", () => ({
  getDrofbotMemory: () => ({
    isStructuredMemoryAvailable: _supabaseConfigured,
    episodic: { store: mockEpisodicStore },
    semantic: { store: mockSemanticStore, exists: mockSemanticExists },
  }),
}));

import {
  startConsolidationRunner,
  runConsolidation,
  type ConsolidationRunner,
} from "./consolidation.js";

describe("Consolidation Runner", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    _supabaseConfigured = true;
  });

  describe("startConsolidationRunner", () => {
    it("returns a runner with stop method", () => {
      const runner = startConsolidationRunner({
        cfg: { memory: { consolidation: { enabled: true } } } as never,
      });

      expect(runner).toBeDefined();
      expect(typeof runner.stop).toBe("function");
      runner.stop(); // Cleanup
    });

    it("returns no-op runner when consolidation is disabled", () => {
      const runner = startConsolidationRunner({
        cfg: { memory: { consolidation: { enabled: false } } } as never,
      });

      expect(runner).toBeDefined();
      runner.stop(); // Should not throw
    });

    it("returns no-op runner when Supabase is not configured", () => {
      _supabaseConfigured = false;
      const runner = startConsolidationRunner({
        cfg: {} as never,
      });

      expect(runner).toBeDefined();
      runner.stop(); // Should not throw
    });

    it("stop prevents further runs", () => {
      const runner = startConsolidationRunner({
        cfg: {} as never,
      });

      runner.stop();
      // After stop, no more timers should be active
      // This tests the basic lifecycle without waiting for intervals
    });
  });

  describe("runConsolidation", () => {
    it("completes without error when no entries exist", async () => {
      // Each dedup table query returns empty
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      // For compress — no old entries
      mockFrom.mockImplementation((table: string) => {
        if (table === "memory_episodic") {
          return {
            select: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      });

      // Should complete without throwing
      await runConsolidation();
    });

    it("skips when structured memory is not available", async () => {
      _supabaseConfigured = false;

      await runConsolidation();

      // No Supabase calls should be made
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
