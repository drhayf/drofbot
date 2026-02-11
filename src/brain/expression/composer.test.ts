/**
 * Expression Composer — Tests
 * Phase: 6
 *
 * Tests for:
 * 1. Archetype selection based on trigger kinds
 * 2. Expression composition with different archetypes
 * 3. Time-aware noticing
 * 4. Length adaptation
 */

import { describe, it, expect } from "vitest";
import type { VoiceProfile, InteractionPreferences } from "../identity/operator/types.js";
import type { ScoredExpression, ExpressionTrigger, SignificanceFactors } from "./types.js";
import { DEFAULT_VOICE_PROFILE, DEFAULT_INTERACTION_PREFS } from "../identity/operator/types.js";
import { composeExpression, adaptLength, type ComposeContext } from "./composer.js";

// ─── Helpers ───────────────────────────────────────────────────

function makeTrigger(overrides?: Partial<ExpressionTrigger>): ExpressionTrigger {
  return {
    kind: "cosmic_shift",
    description: "A notable shift in planetary alignment today",
    source: "cardology",
    ...overrides,
  };
}

function makeFactors(overrides?: Partial<SignificanceFactors>): SignificanceFactors {
  return {
    novelty: 0.8,
    relevance: 0.7,
    cosmicWeight: 0.6,
    convergence: 0.5,
    timeSensitivity: 0.5,
    operatorReceptivity: 0.8,
    ...overrides,
  };
}

function makeScored(overrides?: Partial<ScoredExpression>): ScoredExpression {
  return {
    triggers: [makeTrigger()],
    factors: makeFactors(),
    score: 0.75,
    topic: "planetary alignment",
    ...overrides,
  };
}

function makeContext(overrides?: Partial<ComposeContext>): ComposeContext {
  return {
    voiceProfile: { ...DEFAULT_VOICE_PROFILE },
    preferences: { ...DEFAULT_INTERACTION_PREFS },
    identitySynthesis: "",
    hourOfDay: 14,
    ...overrides,
  };
}

// ─── Archetype Selection ───────────────────────────────────────

describe("composeExpression — archetype selection", () => {
  it("selects question archetype for curiosity_thread", () => {
    const scored = makeScored({
      triggers: [
        makeTrigger({ kind: "curiosity_thread", description: "Something about identity" }),
      ],
    });
    const result = composeExpression(scored, makeContext());
    // Questions end with "?"
    expect(result.content).toContain("?");
  });

  it("selects reflection archetype for operator_echo", () => {
    const scored = makeScored({
      triggers: [
        makeTrigger({ kind: "operator_echo", description: "Your recurring mention of patterns" }),
      ],
    });
    const result = composeExpression(scored, makeContext());
    // Reflections mention "you" or "your"
    expect(result.content.toLowerCase()).toMatch(/you|mentioned|keep coming back/);
  });

  it("selects observation archetype for pattern_detection", () => {
    const scored = makeScored({
      triggers: [
        makeTrigger({
          kind: "pattern_detection",
          description: "A recurring theme in your questions",
        }),
      ],
    });
    const result = composeExpression(scored, makeContext());
    expect(result.content).toContain("noticed");
  });

  it("selects noticing archetype for cosmic_shift", () => {
    const scored = makeScored({
      triggers: [makeTrigger({ kind: "cosmic_shift", description: "Solar storm peaking" })],
    });
    const result = composeExpression(scored, makeContext());
    expect(result.content.toLowerCase()).toContain("solar storm peaking");
  });

  it("selects provocation for hypothesis_update", () => {
    const scored = makeScored({
      triggers: [
        makeTrigger({
          kind: "hypothesis_update",
          description: "Your approach shifts on Tuesdays",
        }),
      ],
    });
    const result = composeExpression(scored, makeContext());
    expect(result.content).toContain("perspective");
  });
});

// ─── Multi-Trigger Composition ─────────────────────────────────

describe("composeExpression — multi-trigger", () => {
  it("includes both trigger descriptions for observations", () => {
    const scored = makeScored({
      triggers: [
        makeTrigger({ kind: "pattern_detection", description: "A weekly cycle in energy" }),
        makeTrigger({ kind: "cosmic_shift", description: "A gate transition" }),
      ],
    });
    const result = composeExpression(scored, makeContext());
    expect(result.content).toContain("convergence");
  });

  it("produces resonance archetype for 3+ triggers from different sources", () => {
    const scored = makeScored({
      triggers: [
        makeTrigger({ source: "cardology", description: "Card cycle shifts" }),
        makeTrigger({ source: "iching", description: "Hexagram transition" }),
        makeTrigger({ source: "solar", description: "CME event" }),
      ],
    });
    const result = composeExpression(scored, makeContext());
    expect(result.content).toContain("direction");
  });
});

// ─── Time-Aware Composition ────────────────────────────────────

describe("composeExpression — time awareness", () => {
  it("uses evening language for late hour noticing", () => {
    const scored = makeScored({
      triggers: [makeTrigger({ kind: "cosmic_shift", description: "A calm settling in" })],
    });
    const result = composeExpression(scored, makeContext({ hourOfDay: 21 }));
    expect(result.content.toLowerCase()).toContain("evening");
  });

  it("uses morning language for early hour noticing", () => {
    const scored = makeScored({
      triggers: [makeTrigger({ kind: "cosmic_shift", description: "A fresh pattern emerging" })],
    });
    const result = composeExpression(scored, makeContext({ hourOfDay: 8 }));
    expect(result.content.toLowerCase()).toContain("day");
  });
});

// ─── Length Adaptation ─────────────────────────────────────────

describe("adaptLength", () => {
  const longMessage =
    "This is the first sentence. This is the second sentence. " +
    "This is the third sentence. This is the fourth sentence. " +
    "This is the fifth sentence.";

  it("caps at 4 sentences by default", () => {
    const result = adaptLength(longMessage, { ...DEFAULT_VOICE_PROFILE });
    const sentenceCount = result.split(/(?<=[.!?])\s+/).length;
    expect(sentenceCount).toBeLessThanOrEqual(4);
  });

  it("caps at 2 sentences for brief operators", () => {
    const briefProfile: VoiceProfile = {
      ...DEFAULT_VOICE_PROFILE,
      avgSentenceLength: 5,
      conversationsAnalyzed: 20,
    };
    const result = adaptLength(longMessage, briefProfile);
    const sentenceCount = result.split(/(?<=[.!?])\s+/).length;
    expect(sentenceCount).toBeLessThanOrEqual(2);
  });

  it("does not shorten for operators with insufficient data", () => {
    const briefButNew: VoiceProfile = {
      ...DEFAULT_VOICE_PROFILE,
      avgSentenceLength: 5,
      conversationsAnalyzed: 3, // too few
    };
    const result = adaptLength(longMessage, briefButNew);
    const sentenceCount = result.split(/(?<=[.!?])\s+/).length;
    expect(sentenceCount).toBeLessThanOrEqual(4); // still 4 max, not 2
    expect(sentenceCount).toBeGreaterThan(2);
  });
});

// ─── Output Shape ──────────────────────────────────────────────

describe("composeExpression — output shape", () => {
  it("returns a ComposedExpression with all fields", () => {
    const scored = makeScored();
    const result = composeExpression(scored, makeContext());

    expect(result.content).toBeTruthy();
    expect(result.triggers).toBe(scored.triggers);
    expect(result.significanceScore).toBe(scored.score);
    expect(result.topic).toBe(scored.topic);
    expect(result.composedAt).toBeTruthy();
  });
});
