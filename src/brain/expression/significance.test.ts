/**
 * Significance Scorer — Tests
 * Phase: 6
 *
 * Tests for:
 * 1. Score calculation from factors
 * 2. Threshold checking
 * 3. Novelty assessment
 * 4. Cosmic weight assessment
 * 5. Convergence assessment
 * 6. Receptivity assessment
 * 7. Full expression scoring
 */

import { describe, it, expect } from "vitest";
import type { SignificanceFactors, ExpressionTrigger, DeliveredExpression } from "./types.js";
import {
  calculateScore,
  meetsThreshold,
  assessNovelty,
  assessCosmicWeight,
  assessConvergence,
  assessReceptivity,
  scoreExpression,
} from "./significance.js";
import { SIGNIFICANCE_THRESHOLD } from "./types.js";

// ─── Helpers ───────────────────────────────────────────────────

function makeFactors(overrides?: Partial<SignificanceFactors>): SignificanceFactors {
  return {
    novelty: 0.5,
    relevance: 0.5,
    cosmicWeight: 0.5,
    convergence: 0.5,
    timeSensitivity: 0.5,
    operatorReceptivity: 0.5,
    ...overrides,
  };
}

function makeDelivered(overrides?: Partial<DeliveredExpression>): DeliveredExpression {
  return {
    id: crypto.randomUUID(),
    content: "A previous expression about patterns",
    significanceScore: 0.75,
    triggers: [
      {
        kind: "cosmic_shift",
        description: "Something about patterns and cosmic shifts",
        source: "test",
      },
    ],
    deliveredAt: new Date().toISOString(),
    channel: "telegram",
    engagement: null,
    ...overrides,
  };
}

function makeTrigger(overrides?: Partial<ExpressionTrigger>): ExpressionTrigger {
  return {
    kind: "cosmic_shift",
    description: "Notable cosmic event",
    source: "test-system",
    ...overrides,
  };
}

// ─── Score Calculation ─────────────────────────────────────────

describe("calculateScore", () => {
  it("returns weighted sum of factors", () => {
    const score = calculateScore(makeFactors());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns 0 for all-zero factors", () => {
    const score = calculateScore(
      makeFactors({
        novelty: 0,
        relevance: 0,
        cosmicWeight: 0,
        convergence: 0,
        timeSensitivity: 0,
        operatorReceptivity: 0,
      }),
    );
    expect(score).toBe(0);
  });

  it("returns 1 for all-max factors", () => {
    const score = calculateScore(
      makeFactors({
        novelty: 1,
        relevance: 1,
        cosmicWeight: 1,
        convergence: 1,
        timeSensitivity: 1,
        operatorReceptivity: 1,
      }),
    );
    expect(score).toBe(1);
  });

  it("novelty has the highest weight", () => {
    const highNovelty = calculateScore(makeFactors({ novelty: 1 }));
    const highRelevance = calculateScore(makeFactors({ relevance: 1 }));
    expect(highNovelty).toBeGreaterThanOrEqual(highRelevance);
  });
});

describe("meetsThreshold", () => {
  it("passes scores above threshold", () => {
    expect(meetsThreshold(SIGNIFICANCE_THRESHOLD)).toBe(true);
    expect(meetsThreshold(0.9)).toBe(true);
  });

  it("rejects scores below threshold", () => {
    expect(meetsThreshold(0.3)).toBe(false);
    expect(meetsThreshold(0.69)).toBe(false);
  });
});

// ─── Novelty Assessment ───────────────────────────────────────

describe("assessNovelty", () => {
  it("returns 1.0 for no recent expressions", () => {
    const score = assessNovelty("new topic", [], Date.now(), 48 * 3600000);
    expect(score).toBe(1.0);
  });

  it("returns low score for recently discussed similar topic", () => {
    const recent = [
      makeDelivered({
        content: "patterns cosmic shifts and their meaning",
        deliveredAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      }),
    ];
    const score = assessNovelty(
      "patterns cosmic shifts observed",
      recent,
      Date.now(),
      48 * 3600000,
    );
    expect(score).toBeLessThan(0.5);
  });

  it("returns high score for old similar topic", () => {
    const recent = [
      makeDelivered({
        content: "patterns and cosmic meaning",
        deliveredAt: new Date(Date.now() - 72 * 3600000).toISOString(), // 72 hours ago
      }),
    ];
    const score = assessNovelty("patterns cosmic meaning today", recent, Date.now(), 48 * 3600000);
    expect(score).toBe(1.0);
  });

  it("returns 1.0 for unrelated topics", () => {
    const recent = [
      makeDelivered({
        content: "The weather is beautiful today",
        deliveredAt: new Date(Date.now() - 3600000).toISOString(),
      }),
    ];
    const score = assessNovelty("quantum mechanics implications", recent, Date.now(), 48 * 3600000);
    expect(score).toBe(1.0);
  });
});

// ─── Cosmic Weight ─────────────────────────────────────────────

describe("assessCosmicWeight", () => {
  it("scores high for strong KP storms", () => {
    const score = assessCosmicWeight([
      makeTrigger({
        kind: "cosmic_shift",
        data: { kpIndex: 8 },
      }),
    ]);
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it("scores moderate for gate changes", () => {
    const score = assessCosmicWeight([
      makeTrigger({
        kind: "cosmic_shift",
        data: { isGateChange: true },
      }),
    ]);
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  it("scores lower for serendipity triggers", () => {
    const score = assessCosmicWeight([makeTrigger({ kind: "serendipity" })]);
    expect(score).toBeLessThanOrEqual(0.5);
  });

  it("takes the max weight from multiple triggers", () => {
    const score = assessCosmicWeight([
      makeTrigger({ kind: "serendipity" }),
      makeTrigger({ kind: "cosmic_shift", data: { kpIndex: 7 } }),
    ]);
    expect(score).toBeGreaterThanOrEqual(0.9);
  });
});

// ─── Convergence ───────────────────────────────────────────────

describe("assessConvergence", () => {
  it("scores low for single trigger", () => {
    const score = assessConvergence([makeTrigger()]);
    expect(score).toBeLessThan(0.5);
  });

  it("scores higher for multiple systems", () => {
    const score = assessConvergence([
      makeTrigger({ source: "cardology", kind: "cosmic_shift" }),
      makeTrigger({ source: "iching", kind: "pattern_detection" }),
      makeTrigger({ source: "solar", kind: "cosmic_shift" }),
    ]);
    expect(score).toBeGreaterThan(0.5);
  });
});

// ─── Receptivity ───────────────────────────────────────────────

describe("assessReceptivity", () => {
  it("scores high during mid-morning", () => {
    const score = assessReceptivity(10, 7, 23);
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it("scores low outside active hours", () => {
    const score = assessReceptivity(3, 7, 23);
    expect(score).toBeLessThanOrEqual(0.2);
  });

  it("handles wrapped active hours", () => {
    // Active hours 22-6 (night owl schedule)
    // Hour 10 is outside 22-6, should get low receptivity
    const score = assessReceptivity(10, 22, 6);
    expect(score).toBeLessThanOrEqual(0.2);

    // Hour 2 is inside 22-6 active window
    const scoreInside = assessReceptivity(2, 22, 6);
    expect(scoreInside).toBeGreaterThanOrEqual(0.5);
  });
});

// ─── Full Expression Scoring ───────────────────────────────────

describe("scoreExpression", () => {
  it("produces a scored expression", () => {
    const result = scoreExpression(
      "cosmic convergence today",
      [
        makeTrigger({ source: "cardology", kind: "cosmic_shift" }),
        makeTrigger({ source: "solar", kind: "cosmic_shift", data: { kpIndex: 6 } }),
      ],
      [],
      Date.now(),
      10,
      7,
      23,
      48 * 3600000,
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.topic).toBe("cosmic convergence today");
    expect(result.factors.novelty).toBe(1.0); // no recent expressions
  });

  it("penalizes recently discussed topics", () => {
    const nowMs = Date.now();
    const recent = [
      makeDelivered({
        content: "cosmic convergence patterns today happening",
        deliveredAt: new Date(nowMs - 2 * 3600000).toISOString(),
      }),
    ];

    const result = scoreExpression(
      "cosmic convergence patterns today",
      [makeTrigger()],
      recent,
      nowMs,
      10,
      7,
      23,
      48 * 3600000,
    );

    expect(result.factors.novelty).toBeLessThan(0.5);
  });
});
