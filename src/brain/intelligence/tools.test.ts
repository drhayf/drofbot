/**
 * Tests for intelligence agent tools (hypothesis_*, pattern_*).
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { Pattern } from "./observer.js";
import { EvidenceType } from "./confidence.js";
import { HypothesisEngine, HypothesisStatus } from "./hypothesis.js";
import {
  createHypothesisListTool,
  createHypothesisDetailTool,
  createHypothesisConfirmTool,
  createHypothesisRejectTool,
  createHypothesisCreateTool,
  createPatternListTool,
  createPatternDetailTool,
  createIntelligenceTools,
  setIntelligenceState,
} from "./tools.js";

// ─── Helpers ───────────────────────────────────────────────────

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

function makeTestPattern(overrides?: Partial<Pattern>): Pattern {
  return {
    type: "SOLAR_CORRELATION" as never,
    confidence: 0.78,
    description: "Mood improves during high solar activity",
    pValue: 0.02,
    effectSize: 0.65,
    evidenceType: EvidenceType.COSMIC_CORRELATION,
    planet: "Sun",
    sunGate: 25,
    ...overrides,
  };
}

// ─── Test Suite ────────────────────────────────────────────────

describe("Intelligence Tools", () => {
  let engine: HypothesisEngine;

  beforeEach(() => {
    engine = new HypothesisEngine();
    setIntelligenceState(engine, []);
  });

  // ─── Factory tests ─────────────────────────────────────────

  describe("createIntelligenceTools", () => {
    it("returns 7 tools", () => {
      const tools = createIntelligenceTools();
      expect(tools).toHaveLength(7);
      const names = tools.map((t) => t.name);
      expect(names).toContain("hypothesis_list");
      expect(names).toContain("hypothesis_detail");
      expect(names).toContain("hypothesis_confirm");
      expect(names).toContain("hypothesis_reject");
      expect(names).toContain("hypothesis_create");
      expect(names).toContain("pattern_list");
      expect(names).toContain("pattern_detail");
    });
  });

  // ─── Hypothesis List ───────────────────────────────────────

  describe("hypothesis_list", () => {
    it("returns empty list when no hypotheses exist", async () => {
      const tool = createHypothesisListTool();
      const result = await tool.execute("tc-1", {});
      const data = parseResult(result);
      expect(data.count).toBe(0);
      expect(data.hypotheses).toEqual([]);
    });

    it("lists active hypotheses by default", async () => {
      const patterns: Pattern[] = [makeTestPattern()];
      engine.generateFromPatterns(patterns);

      const tool = createHypothesisListTool();
      const result = await tool.execute("tc-2", {});
      const data = parseResult(result);
      expect(data.count).toBe(1);
      expect(data.hypotheses[0].statement).toBe("Mood improves during high solar activity");
      expect(data.hypotheses[0].confidence).toBeGreaterThan(0);
      expect(data.hypotheses[0].evidenceCount).toBe(1);
    });

    it("filters by status=all", async () => {
      engine.generateFromPatterns([makeTestPattern()]);
      const tool = createHypothesisListTool();
      const result = await tool.execute("tc-3", { status: "all" });
      const data = parseResult(result);
      expect(data.count).toBeGreaterThan(0);
    });

    it("filters by status=confirmed (empty when none confirmed)", async () => {
      engine.generateFromPatterns([makeTestPattern()]);
      const tool = createHypothesisListTool();
      const result = await tool.execute("tc-4", { status: "confirmed" });
      const data = parseResult(result);
      expect(data.count).toBe(0);
    });
  });

  // ─── Hypothesis Detail ─────────────────────────────────────

  describe("hypothesis_detail", () => {
    it("returns full details for a valid hypothesis", async () => {
      const generated = engine.generateFromPatterns([makeTestPattern()]);
      const hyp = generated[0];

      const tool = createHypothesisDetailTool();
      const result = await tool.execute("tc-5", { id: hyp.id });
      const data = parseResult(result);

      expect(data.id).toBe(hyp.id);
      expect(data.statement).toBe(hyp.statement);
      expect(data.evidenceRecords).toHaveLength(1);
      expect(data.confidenceHistory).toHaveLength(1);
      expect(data.createdAt).toBeTruthy();
    });

    it("returns error for unknown id", async () => {
      const tool = createHypothesisDetailTool();
      const result = await tool.execute("tc-6", { id: "nonexistent" });
      const data = parseResult(result);
      expect(data.error).toContain("not found");
    });
  });

  // ─── Hypothesis Confirm ────────────────────────────────────

  describe("hypothesis_confirm", () => {
    it("increases confidence on confirmation", async () => {
      const generated = engine.generateFromPatterns([makeTestPattern()]);
      const hyp = generated[0];

      const tool = createHypothesisConfirmTool();
      const result = await tool.execute("tc-7", { id: hyp.id, note: "I agree with this" });
      const data = parseResult(result);

      expect(data.confirmed).toBe(true);
      expect(typeof data.newConfidence).toBe("number");
      expect(data.newConfidence).toBeGreaterThan(0);
      expect(data.newConfidence).toBeLessThanOrEqual(1);
      expect(data.id).toBe(hyp.id);

      // Verify the hypothesis now has 2 evidence records (observer + user confirmation)
      const detail = await createHypothesisDetailTool().execute("tc-7b", { id: hyp.id });
      const detailData = parseResult(detail);
      expect(detailData.evidenceRecords).toHaveLength(2);
      expect(detailData.evidenceRecords[1].type).toBe("USER_CONFIRMATION");
    });

    it("returns error for unknown id", async () => {
      const tool = createHypothesisConfirmTool();
      const result = await tool.execute("tc-8", { id: "bad-id" });
      const data = parseResult(result);
      expect(data.error).toContain("not found");
    });
  });

  // ─── Hypothesis Reject ─────────────────────────────────────

  describe("hypothesis_reject", () => {
    it("decreases confidence on rejection", async () => {
      const generated = engine.generateFromPatterns([makeTestPattern()]);
      const hyp = generated[0];
      const originalConfidence = hyp.confidence;

      const tool = createHypothesisRejectTool();
      const result = await tool.execute("tc-9", {
        id: hyp.id,
        reason: "This doesn't match my experience",
      });
      const data = parseResult(result);

      expect(data.rejected).toBe(true);
      expect(data.newConfidence).toBeLessThan(originalConfidence);
    });
  });

  // ─── Hypothesis Create ─────────────────────────────────────

  describe("hypothesis_create", () => {
    it("creates a new hypothesis from operator statement", async () => {
      const tool = createHypothesisCreateTool();
      const result = await tool.execute("tc-10", {
        statement: "I am more creative during Mercury periods",
        category: "productivity",
        initialEvidence: "Noticed several creative breakthroughs during last Mercury period",
      });
      const data = parseResult(result);

      expect(data.created).toBe(true);
      expect(data.hypothesis.statement).toBe("I am more creative during Mercury periods");
      expect(data.hypothesis.category).toBe("productivity");
      expect(data.hypothesis.confidence).toBeGreaterThan(0);
    });

    it("detects duplicate hypotheses", async () => {
      const tool = createHypothesisCreateTool();
      await tool.execute("tc-11a", {
        statement: "I sleep better on full moons",
        category: "sensitivity",
      });

      const result = await tool.execute("tc-11b", {
        statement: "I sleep better on full moons",
        category: "sensitivity",
      });
      const data = parseResult(result);

      expect(data.created).toBe(false);
      expect(data.reason).toContain("Duplicate");
    });
  });

  // ─── Pattern List ──────────────────────────────────────────

  describe("pattern_list", () => {
    it("returns empty list when no patterns", async () => {
      const tool = createPatternListTool();
      const result = await tool.execute("tc-12", {});
      const data = parseResult(result);
      expect(data.count).toBe(0);
    });

    it("lists all patterns", async () => {
      setIntelligenceState(engine, [
        makeTestPattern(),
        makeTestPattern({ confidence: 0.45, description: "Energy dips during Mercury retro" }),
      ]);

      const tool = createPatternListTool();
      const result = await tool.execute("tc-13", {});
      const data = parseResult(result);
      expect(data.count).toBe(2);
    });

    it("filters by minConfidence", async () => {
      setIntelligenceState(engine, [
        makeTestPattern({ confidence: 0.9 }),
        makeTestPattern({ confidence: 0.3, description: "Weak pattern" }),
      ]);

      const tool = createPatternListTool();
      const result = await tool.execute("tc-14", { minConfidence: 0.5 });
      const data = parseResult(result);
      expect(data.count).toBe(1);
      expect(data.patterns[0].confidence).toBeGreaterThanOrEqual(0.5);
    });

    it("filters by type", async () => {
      setIntelligenceState(engine, [
        makeTestPattern(),
        makeTestPattern({
          type: "TEMPORAL_PATTERN" as never,
          description: "Better focus in mornings",
        }),
      ]);

      const tool = createPatternListTool();
      const result = await tool.execute("tc-15", { type: "SOLAR_CORRELATION" });
      const data = parseResult(result);
      expect(data.count).toBe(1);
    });
  });

  // ─── Pattern Detail ────────────────────────────────────────

  describe("pattern_detail", () => {
    it("returns full pattern details", async () => {
      setIntelligenceState(engine, [makeTestPattern()]);

      const tool = createPatternDetailTool();
      const result = await tool.execute("tc-16", { id: "0" });
      const data = parseResult(result);

      expect(data.index).toBe(0);
      expect(data.type).toBe("SOLAR_CORRELATION");
      expect(data.description).toBe("Mood improves during high solar activity");
      expect(data.planet).toBe("Sun");
      expect(data.sunGate).toBe(25);
    });

    it("returns error for invalid index", async () => {
      setIntelligenceState(engine, [makeTestPattern()]);

      const tool = createPatternDetailTool();
      const result = await tool.execute("tc-17", { id: "99" });
      const data = parseResult(result);
      expect(data.error).toContain("Invalid pattern index");
    });
  });

  // ─── Uninitialized engine ──────────────────────────────────

  describe("uninitialized engine", () => {
    it("hypothesis_list returns error when engine is null", async () => {
      setIntelligenceState(null as never, []);
      const tool = createHypothesisListTool();
      const result = await tool.execute("tc-18", {});
      const data = parseResult(result);
      expect(data.error).toContain("not initialized");
    });
  });
});
