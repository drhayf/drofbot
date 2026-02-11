/**
 * Synthesis Module — Comprehensive Tests
 *
 * Tests for:
 * 1. Rendering helpers (cosmicWeather, harmony, profile, intelligence, relationship)
 * 2. Assembly + token budget enforcement
 * 3. SynthesisEngine (generateMasterSynthesis, generateSelfModel, generateRelationshipModel)
 * 4. Synthesis Cron Runner
 * 5. Truncation edge cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { CosmicState, HarmonicSynthesis, BirthMoment } from "../council/types.js";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import { Element, ResonanceType } from "../council/types.js";
import { HypothesisStatus, HypothesisType } from "../intelligence/hypothesis.js";
import {
  SynthesisEngine,
  truncate,
  renderCosmicWeather,
  renderHarmony,
  renderProfile,
  renderIntelligence,
  renderRelationship,
  assembleSynthesis,
  type SynthesisDeps,
  type MasterSynthesis,
} from "./master.js";
import {
  runSynthesisCycle,
  configureSynthesisEngine,
  getSynthesisEngine,
  resetSynthesisSingleton,
} from "./synthesis-runner.js";

// ─── Test Helpers ──────────────────────────────────────────────

function makeCosmicState(system: string, summary: string): CosmicState {
  return {
    system,
    timestamp: new Date("2025-06-01T12:00:00Z"),
    primary: { key: "value" },
    summary,
    metrics: { value: 0.5 },
  };
}

function makeHarmonic(overrides?: Partial<HarmonicSynthesis>): HarmonicSynthesis {
  return {
    overallResonance: 0.82,
    resonanceType: ResonanceType.HARMONIC,
    pairwise: [],
    dominantElements: [Element.FIRE, Element.ETHER],
    elementalBalance: {
      [Element.FIRE]: 0.3,
      [Element.WATER]: 0.1,
      [Element.AIR]: 0.2,
      [Element.EARTH]: 0.1,
      [Element.ETHER]: 0.3,
    },
    guidance: "Strong creative alignment today.",
    ...overrides,
  };
}

function makeHypothesis(overrides?: Partial<Hypothesis>): Hypothesis {
  return {
    id: `hyp-${Math.random().toString(36).slice(2, 8)}`,
    statement: "Operator shows elevated energy during Fire-dominant periods",
    type: HypothesisType.CYCLICAL_INFLUENCE,
    category: "cyclical",
    status: HypothesisStatus.TESTING,
    confidence: 0.65,
    evidenceRecords: [],
    confidenceHistory: [{ confidence: 0.65, timestamp: new Date() }],
    firstDetectedAt: new Date("2025-05-01T00:00:00Z"),
    lastEvidenceAt: new Date("2025-05-30T00:00:00Z"),
    periodEvidenceCount: 3,
    gateEvidenceCount: 0,
    sourcePatterns: ["solar-correlation"],
    ...overrides,
  };
}

const testBirth: BirthMoment = {
  datetime: new Date("1990-06-15T10:30:00Z"),
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
};

const agentBirth: BirthMoment = {
  datetime: new Date("2025-01-01T00:00:00Z"),
  latitude: 0,
  longitude: 0,
  timezone: "UTC",
};

function makeDeps(overrides?: Partial<SynthesisDeps>): SynthesisDeps {
  const states = new Map<string, CosmicState>();
  states.set(
    "cardology",
    makeCosmicState("cardology", "Mercury period, 7 of Clubs. Mental focus and curiosity."),
  );
  states.set("iching", makeCosmicState("iching", "Gate 48, Line 3. Depth, mastery, the well."));
  states.set("solar", makeCosmicState("solar", "Kp 2, quiet. No significant solar activity."));

  return {
    calculateCosmicStates: async () => states,
    getCosmicTimestamp: async () => ({ datetime: new Date(), systems: {} }),
    calculateHarmonic: async () => makeHarmonic(),
    getActiveHypotheses: () => [makeHypothesis()],
    getConfirmedHypotheses: () => [
      makeHypothesis({
        status: HypothesisStatus.CONFIRMED,
        confidence: 0.91,
        statement: "Operator is sensitive to solar electromagnetic activity above Kp 5",
      }),
    ],
    getRecentEpisodicContext: async (limit) =>
      [
        "User discussed coding project progress",
        "User mentioned feeling energetic in the morning",
        "User asked about transit patterns",
      ].slice(0, limit),
    getSemanticByCategory: async (cat) => {
      if (cat === "identity") return ["Software developer", "Night owl tendency"];
      if (cat === "preference")
        return ["Concise responses preferred", "Technical language welcome"];
      if (cat === "knowledge") return ["Works on TypeScript projects"];
      return [];
    },
    getSelfKnowledge: async () => [
      "I am a cosmic companion bot",
      "I use 6 metaphysical systems for pattern detection",
    ],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Synthesis Module", () => {
  // ─── Truncation ────────────────────────────────────────────

  describe("truncate", () => {
    it("returns text unchanged if within limit", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("truncates with ellipsis when exceeding limit", () => {
      expect(truncate("hello world", 5)).toBe("hell…");
    });

    it("handles exact length", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("handles empty string", () => {
      expect(truncate("", 10)).toBe("");
    });

    it("handles length 1 limit", () => {
      expect(truncate("hello", 1)).toBe("…");
    });
  });

  // ─── renderCosmicWeather ───────────────────────────────────

  describe("renderCosmicWeather", () => {
    it("renders system summaries", () => {
      const states = new Map<string, CosmicState>();
      states.set("cardology", makeCosmicState("cardology", "Mercury period active"));
      states.set("solar", makeCosmicState("solar", "Kp 3, moderate"));

      const result = renderCosmicWeather(states);
      expect(result).toContain("Mercury period active");
      expect(result).toContain("Kp 3, moderate");
    });

    it("returns fallback for empty states", () => {
      const result = renderCosmicWeather(new Map());
      expect(result).toBe("No cosmic data available.");
    });

    it("truncates long summaries", () => {
      const states = new Map<string, CosmicState>();
      const longSummary = "a".repeat(200);
      states.set("test", makeCosmicState("test", longSummary));

      const result = renderCosmicWeather(states);
      expect(result.length).toBeLessThanOrEqual(150);
    });
  });

  // ─── renderHarmony ─────────────────────────────────────────

  describe("renderHarmony", () => {
    it("renders resonance percentage and type", () => {
      const result = renderHarmony(makeHarmonic());
      expect(result).toContain("82%");
      expect(result).toContain("HARMONIC");
    });

    it("includes dominant elements", () => {
      const result = renderHarmony(makeHarmonic());
      expect(result).toContain("FIRE");
      expect(result).toContain("ETHER");
    });

    it("includes guidance text", () => {
      const result = renderHarmony(makeHarmonic({ guidance: "Creative flow today" }));
      expect(result).toContain("Creative flow today");
    });

    it("handles empty dominant elements", () => {
      const result = renderHarmony(makeHarmonic({ dominantElements: [] }));
      expect(result).not.toContain("Dominant:");
    });

    it("handles empty guidance", () => {
      const result = renderHarmony(makeHarmonic({ guidance: "" }));
      expect(result).toContain("82%");
    });
  });

  // ─── renderProfile ─────────────────────────────────────────

  describe("renderProfile", () => {
    it("renders facts and preferences", () => {
      const result = renderProfile(["Software developer", "Night owl"], ["Concise responses"]);
      expect(result).toContain("Software developer");
      expect(result).toContain("Night owl");
      expect(result).toContain("Preferences:");
      expect(result).toContain("Concise responses");
    });

    it("returns fallback when empty", () => {
      const result = renderProfile([], []);
      expect(result).toBe("Profile not yet established.");
    });

    it("limits facts to 5", () => {
      const facts = Array.from({ length: 10 }, (_, i) => `Fact ${i}`);
      const result = renderProfile(facts, []);
      expect(result).toContain("Fact 0");
      expect(result).toContain("Fact 4");
      expect(result).not.toContain("Fact 5");
    });

    it("limits preferences to 3", () => {
      const prefs = Array.from({ length: 5 }, (_, i) => `Pref ${i}`);
      const result = renderProfile([], prefs);
      expect(result).toContain("Pref 0");
      expect(result).toContain("Pref 2");
      expect(result).not.toContain("Pref 3");
    });
  });

  // ─── renderIntelligence ────────────────────────────────────

  describe("renderIntelligence", () => {
    it("renders confirmed hypotheses", () => {
      const confirmed = [
        makeHypothesis({
          status: HypothesisStatus.CONFIRMED,
          confidence: 0.92,
          statement: "Solar sensitivity confirmed",
        }),
      ];
      const result = renderIntelligence([], confirmed);
      expect(result).toContain("Confirmed insights:");
      expect(result).toContain("Solar sensitivity confirmed");
      expect(result).toContain("92%");
    });

    it("renders active hypotheses", () => {
      const active = [
        makeHypothesis({
          status: HypothesisStatus.TESTING,
          confidence: 0.65,
          statement: "Energy cycles correlate with lunar phase",
        }),
      ];
      const result = renderIntelligence(active, []);
      expect(result).toContain("Under investigation:");
      expect(result).toContain("Energy cycles");
      expect(result).toContain("TESTING");
      expect(result).toContain("65%");
    });

    it("returns baseline message when no hypotheses", () => {
      const result = renderIntelligence([], []);
      expect(result).toContain("No patterns detected yet");
    });

    it("limits to 3 confirmed + 3 active", () => {
      const confirmed = Array.from({ length: 5 }, (_, i) =>
        makeHypothesis({
          status: HypothesisStatus.CONFIRMED,
          confidence: 0.9,
          statement: `Confirmed ${i}`,
        }),
      );
      const active = Array.from({ length: 5 }, (_, i) =>
        makeHypothesis({
          status: HypothesisStatus.TESTING,
          confidence: 0.6,
          statement: `Active ${i}`,
        }),
      );
      const result = renderIntelligence(active, confirmed);
      expect(result).toContain("Confirmed 0");
      expect(result).toContain("Confirmed 2");
      expect(result).not.toContain("Confirmed 3");
      expect(result).toContain("Active 0");
      expect(result).toContain("Active 2");
      expect(result).not.toContain("Active 3");
    });
  });

  // ─── renderRelationship ────────────────────────────────────

  describe("renderRelationship", () => {
    it("renders duration and trust", () => {
      const result = renderRelationship(30, ["coding discussions"], 0.85, ["growth area"]);
      expect(result).toContain("30 days");
      expect(result).toContain("85%");
    });

    it("includes interaction patterns", () => {
      const result = renderRelationship(10, ["coding", "reflection"], 0.5, []);
      expect(result).toContain("coding");
      expect(result).toContain("reflection");
    });

    it("includes growth areas", () => {
      const result = renderRelationship(10, [], 0.5, ["emotional awareness"]);
      expect(result).toContain("emotional awareness");
    });

    it("omits duration when 0", () => {
      const result = renderRelationship(0, [], 0.5, []);
      expect(result).not.toContain("Relationship:");
      expect(result).toContain("50%");
    });
  });

  // ─── assembleSynthesis ─────────────────────────────────────

  describe("assembleSynthesis", () => {
    it("assembles all sections with headers", () => {
      const result = assembleSynthesis({
        profile: "Dev profile",
        cosmicWeather: "Mercury period active",
        intelligence: "Solar sensitivity confirmed",
        harmony: "82% HARMONIC",
        progression: "",
      });
      expect(result).toContain("## Master Synthesis");
      expect(result).toContain("### Profile");
      expect(result).toContain("### Cosmic Weather");
      expect(result).toContain("### Harmony");
      expect(result).toContain("### Intelligence");
    });

    it("omits empty sections", () => {
      const result = assembleSynthesis({
        profile: "Dev profile",
        cosmicWeather: "",
        intelligence: "",
        harmony: "",
        progression: "",
      });
      expect(result).toContain("### Profile");
      expect(result).not.toContain("### Cosmic Weather");
      expect(result).not.toContain("### Intelligence");
      expect(result).not.toContain("### Progression");
    });

    it("enforces token budget (MAX_RENDERED_CHARS)", () => {
      const result = assembleSynthesis({
        profile: "x".repeat(1000),
        cosmicWeather: "y".repeat(1000),
        intelligence: "z".repeat(1000),
        harmony: "w".repeat(1000),
        progression: "v".repeat(1000),
      });
      // MAX_RENDERED_CHARS = 3200
      expect(result.length).toBeLessThanOrEqual(3200);
    });

    it("truncates individual sections to MAX_SECTION_CHARS", () => {
      const result = assembleSynthesis({
        profile: "x".repeat(1000),
        cosmicWeather: "",
        intelligence: "",
        harmony: "",
        progression: "",
      });
      // The profile section content should be truncated
      // Find the profile section and check it's capped
      const profileStart = result.indexOf("### Profile\n") + "### Profile\n".length;
      const nextHeader = result.indexOf("\n##", profileStart);
      const profileContent =
        nextHeader > 0 ? result.slice(profileStart, nextHeader) : result.slice(profileStart);
      expect(profileContent.length).toBeLessThanOrEqual(601); // 600 + ellipsis
    });
  });

  // ─── SynthesisEngine ──────────────────────────────────────

  describe("SynthesisEngine", () => {
    let engine: SynthesisEngine;
    let deps: SynthesisDeps;

    beforeEach(() => {
      deps = makeDeps();
      engine = new SynthesisEngine(deps, testBirth, agentBirth);
    });

    describe("generateMasterSynthesis", () => {
      it("produces a complete synthesis", async () => {
        const synthesis = await engine.generateMasterSynthesis();
        expect(synthesis.rendered).toContain("## Master Synthesis");
        expect(synthesis.generatedAt).toBeInstanceOf(Date);
      });

      it("includes cosmic weather from all systems", async () => {
        const synthesis = await engine.generateMasterSynthesis();
        expect(synthesis.cosmicWeather).toContain("Mercury period");
        expect(synthesis.cosmicWeather).toContain("Gate 48");
        expect(synthesis.cosmicWeather).toContain("Kp 2");
      });

      it("includes profile from semantic memory", async () => {
        const synthesis = await engine.generateMasterSynthesis();
        expect(synthesis.profile).toContain("Software developer");
        expect(synthesis.profile).toContain("Concise responses");
      });

      it("includes intelligence section", async () => {
        const synthesis = await engine.generateMasterSynthesis();
        expect(synthesis.intelligence).toContain("Confirmed insights:");
        expect(synthesis.intelligence).toContain("Under investigation:");
      });

      it("includes harmony section", async () => {
        const synthesis = await engine.generateMasterSynthesis();
        expect(synthesis.harmony).toContain("82%");
        expect(synthesis.harmony).toContain("HARMONIC");
      });

      it("caches the result", async () => {
        expect(engine.getCached()).toBeNull();
        const synthesis = await engine.generateMasterSynthesis();
        expect(engine.getCached()).toBe(synthesis);
      });

      it("rendered output respects token budget", async () => {
        const synthesis = await engine.generateMasterSynthesis();
        expect(synthesis.rendered.length).toBeLessThanOrEqual(3200);
      });

      it("handles null harmonic gracefully", async () => {
        const nullDeps = makeDeps({
          calculateHarmonic: async () => null,
        });
        const eng = new SynthesisEngine(nullDeps, testBirth, agentBirth);
        const synthesis = await eng.generateMasterSynthesis();
        expect(synthesis.harmony).toBe("");
        expect(synthesis.rendered).not.toContain("### Harmony");
      });

      it("handles empty intelligence gracefully", async () => {
        const emptyDeps = makeDeps({
          getActiveHypotheses: () => [],
          getConfirmedHypotheses: () => [],
        });
        const eng = new SynthesisEngine(emptyDeps, testBirth, agentBirth);
        const synthesis = await eng.generateMasterSynthesis();
        expect(synthesis.intelligence).toContain("No patterns detected yet");
      });

      it("handles empty cosmic states", async () => {
        const emptyDeps = makeDeps({
          calculateCosmicStates: async () => new Map(),
        });
        const eng = new SynthesisEngine(emptyDeps, testBirth, agentBirth);
        const synthesis = await eng.generateMasterSynthesis();
        expect(synthesis.cosmicWeather).toBe("No cosmic data available.");
      });
    });

    describe("generateSelfModel", () => {
      it("produces a self model", async () => {
        const model = await engine.generateSelfModel();
        expect(model.cosmicState).toBeDefined();
        expect(model.capabilities).toContain("Council systems");
      });

      it("includes self-knowledge from semantic memory", async () => {
        const model = await engine.generateSelfModel();
        expect(model.selfKnowledge).toContain("I am a cosmic companion bot");
      });

      it("derives communication style from preferences", async () => {
        const model = await engine.generateSelfModel();
        expect(model.communicationStyle).toContain("Concise");
      });

      it("caches the result", async () => {
        expect(engine.getCachedSelfModel()).toBeNull();
        const model = await engine.generateSelfModel();
        expect(engine.getCachedSelfModel()).toBe(model);
      });

      it("uses agent birth moment for cosmic state", async () => {
        let capturedBirth: BirthMoment | null = null;
        const trackDeps = makeDeps({
          calculateCosmicStates: async (birth) => {
            capturedBirth = birth;
            return new Map();
          },
        });
        const eng = new SynthesisEngine(trackDeps, testBirth, agentBirth);
        await eng.generateSelfModel();
        expect(capturedBirth).toBe(agentBirth);
      });

      it("handles no preferences gracefully", async () => {
        const emptyDeps = makeDeps({
          getSemanticByCategory: async () => [],
        });
        const eng = new SynthesisEngine(emptyDeps, testBirth, agentBirth);
        const model = await eng.generateSelfModel();
        expect(model.communicationStyle).toContain("Adaptive");
      });
    });

    describe("generateRelationshipModel", () => {
      it("produces a relationship model", async () => {
        const model = await engine.generateRelationshipModel();
        expect(model.trustLevel).toBeGreaterThanOrEqual(0);
        expect(model.trustLevel).toBeLessThanOrEqual(1);
      });

      it("calculates trust from hypothesis confirmations", async () => {
        const model = await engine.generateRelationshipModel();
        // 1 confirmed, 0 rejected (active ones don't count for trust)
        expect(model.trustLevel).toBe(1);
      });

      it("reflects 50% trust when no hypotheses exist", async () => {
        const emptyDeps = makeDeps({
          getActiveHypotheses: () => [],
          getConfirmedHypotheses: () => [],
        });
        const eng = new SynthesisEngine(emptyDeps, testBirth, agentBirth);
        const model = await eng.generateRelationshipModel();
        expect(model.trustLevel).toBe(0.5);
      });

      it("includes interaction patterns from knowledge", async () => {
        const model = await engine.generateRelationshipModel();
        expect(model.interactionPatterns).toContain("Works on TypeScript projects");
      });

      it("includes narrative summary", async () => {
        const model = await engine.generateRelationshipModel();
        expect(model.narrative.length).toBeGreaterThan(0);
        expect(model.narrative).toContain("Trust:");
      });

      it("calculates communication frequency", async () => {
        const model = await engine.generateRelationshipModel();
        expect(model.communicationFrequency).toBeGreaterThan(0);
      });
    });

    describe("cache management", () => {
      it("invalidateCache clears both caches", async () => {
        await engine.generateMasterSynthesis();
        await engine.generateSelfModel();
        expect(engine.getCached()).not.toBeNull();
        expect(engine.getCachedSelfModel()).not.toBeNull();

        engine.invalidateCache();
        expect(engine.getCached()).toBeNull();
        expect(engine.getCachedSelfModel()).toBeNull();
      });
    });
  });

  // ─── Synthesis Cron Runner ─────────────────────────────────

  describe("Synthesis Cron Runner", () => {
    beforeEach(() => {
      resetSynthesisSingleton();
    });

    it("returns error when engine not configured", async () => {
      const result = await runSynthesisCycle();
      expect(result.synthesisGenerated).toBe(false);
      expect(result.operatorIdentityGenerated).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("not configured");
    });

    it("runs successfully with configured engine", async () => {
      const deps = makeDeps();
      configureSynthesisEngine(deps, testBirth, agentBirth);

      const result = await runSynthesisCycle();
      expect(result.synthesisGenerated).toBe(true);
      expect(result.selfModelGenerated).toBe(true);
      expect(result.renderedLength).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it("reports section availability", async () => {
      const deps = makeDeps();
      configureSynthesisEngine(deps, testBirth, agentBirth);

      const result = await runSynthesisCycle();
      expect(result.sections.profile).toBe(true);
      expect(result.sections.cosmicWeather).toBe(true);
      expect(result.sections.intelligence).toBe(true);
      expect(result.sections.harmony).toBe(true);
      expect(result.sections.progression).toBe(false); // Not yet implemented
      expect(result.sections.operatorIdentity).toBeDefined();
    });

    it("getSynthesisEngine returns configured singleton", () => {
      expect(getSynthesisEngine()).toBeNull();
      const deps = makeDeps();
      configureSynthesisEngine(deps, testBirth, agentBirth);
      expect(getSynthesisEngine()).not.toBeNull();
    });

    it("resetSynthesisSingleton clears the engine", () => {
      const deps = makeDeps();
      configureSynthesisEngine(deps, testBirth, agentBirth);
      expect(getSynthesisEngine()).not.toBeNull();
      resetSynthesisSingleton();
      expect(getSynthesisEngine()).toBeNull();
    });

    it("handles synthesis generation failure gracefully", async () => {
      const failDeps = makeDeps({
        calculateCosmicStates: async () => {
          throw new Error("Council offline");
        },
      });
      configureSynthesisEngine(failDeps, testBirth, agentBirth);

      const result = await runSynthesisCycle();
      expect(result.synthesisGenerated).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Council offline");
    });

    it("handles self-model failure gracefully", async () => {
      // Override calculateCosmicStates to fail only on second call (self-model uses agentBirth)
      let callCount = 0;
      const failDeps = makeDeps({
        calculateCosmicStates: async (birth) => {
          callCount++;
          if (callCount === 2) throw new Error("Agent birth data missing");
          return new Map([["test", makeCosmicState("test", "ok")]]);
        },
      });
      configureSynthesisEngine(failDeps, testBirth, agentBirth);

      const result = await runSynthesisCycle();
      // Synthesis succeeded but self-model failed
      expect(result.selfModelGenerated).toBe(false);
      expect(result.errors.some((e) => e.includes("Agent birth data missing"))).toBe(true);
    });

    it("accepts explicit engine parameter", async () => {
      const deps = makeDeps();
      const engine = new SynthesisEngine(deps, testBirth, agentBirth);

      const result = await runSynthesisCycle(engine);
      expect(result.synthesisGenerated).toBe(true);
      expect(result.selfModelGenerated).toBe(true);
    });
  });
});
