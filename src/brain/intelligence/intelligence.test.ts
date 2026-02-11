/**
 * Intelligence Module — Comprehensive Tests
 *
 * Tests for:
 * - Weighted Confidence Calculator (§7)
 * - Observer Pattern Detection Engine (§4-§5)
 * - Hypothesis Engine (§6, §8)
 * - Observer Cron Runner
 * - Post-Turn Integration
 *
 * All GUTTERS formulas are verified against known inputs.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  // Confidence Calculator
  EvidenceType,
  BASE_WEIGHTS,
  SOURCE_RELIABILITY,
  HALF_LIFE_DAYS,
  RECENCY_FLOOR,
  BASE_CONFIDENCE,
  CONFIDENCE_SCALE,
  THRESHOLDS,
  ConfidenceBand,
  getConfidenceBand,
  calculateRecencyMultiplier,
  calculatePositionFactor,
  createEvidenceRecord,
  calculateConfidence,
  calculateInitialConfidence,
  recalculateConfidence,
  type EvidenceRecord,
} from "./confidence.js";
import {
  // Hypothesis Engine
  HypothesisEngine,
  HypothesisType,
  HypothesisStatus,
  resolveStatus,
} from "./hypothesis.js";
import {
  // Post-Turn Integration
  extractEvidenceFromExchange,
  testExchangeAgainstHypotheses,
} from "./integration.js";
import {
  // Observer Runner
  runObserverCycle,
  getObserver,
  getHypothesisEngine,
  resetIntelligenceSingletons,
  type EntryLoader,
} from "./observer-runner.js";
import {
  // Observer
  Observer,
  PatternType,
  MIN_DATA_REQUIREMENTS,
  CYCLICAL_CONFIG,
  PLANET_THEMES,
  pearsonCorrelation,
  pearsonPValue,
  mean,
  stddev,
  oneWayAnovaP,
  type ObservableEntry,
} from "./observer.js";

// ═══════════════════════════════════════════════════════════════
// WEIGHTED CONFIDENCE CALCULATOR
// ═══════════════════════════════════════════════════════════════

describe("Weighted Confidence Calculator", () => {
  // ─── Base Weights (GUTTERS §7.1) ───────────────────────────

  describe("BASE_WEIGHTS", () => {
    it("has correct Tier 1 weights", () => {
      expect(BASE_WEIGHTS[EvidenceType.USER_CONFIRMATION]).toBe(1.0);
      expect(BASE_WEIGHTS[EvidenceType.USER_EXPLICIT_FEEDBACK]).toBe(0.95);
      expect(BASE_WEIGHTS[EvidenceType.BIRTH_DATA_PROVIDED]).toBe(1.0);
    });

    it("has correct Tier 2 weights", () => {
      expect(BASE_WEIGHTS[EvidenceType.JOURNAL_ENTRY]).toBe(0.75);
      expect(BASE_WEIGHTS[EvidenceType.TRACKING_DATA_MATCH]).toBe(0.7);
      expect(BASE_WEIGHTS[EvidenceType.MOOD_SCORE_ALIGNMENT]).toBe(0.72);
      expect(BASE_WEIGHTS[EvidenceType.SYMPTOM_REPORT]).toBe(0.68);
    });

    it("has correct Tier 3 weights", () => {
      expect(BASE_WEIGHTS[EvidenceType.OBSERVER_PATTERN]).toBe(0.55);
      expect(BASE_WEIGHTS[EvidenceType.COSMIC_CORRELATION]).toBe(0.5);
      expect(BASE_WEIGHTS[EvidenceType.TRANSIT_ALIGNMENT]).toBe(0.52);
      expect(BASE_WEIGHTS[EvidenceType.THEME_ALIGNMENT]).toBe(0.48);
      expect(BASE_WEIGHTS[EvidenceType.CYCLICAL_PATTERN]).toBe(0.58);
    });

    it("has correct Tier 4 weights", () => {
      expect(BASE_WEIGHTS[EvidenceType.MODULE_SUGGESTION]).toBe(0.35);
      expect(BASE_WEIGHTS[EvidenceType.COSMIC_CALCULATION]).toBe(0.3);
      expect(BASE_WEIGHTS[EvidenceType.GENESIS_REFINEMENT]).toBe(0.4);
    });

    it("has correct contradiction weights (negative)", () => {
      expect(BASE_WEIGHTS[EvidenceType.USER_REJECTION]).toBe(-1.5);
      expect(BASE_WEIGHTS[EvidenceType.COUNTER_PATTERN]).toBe(-0.8);
      expect(BASE_WEIGHTS[EvidenceType.MISMATCH_EVIDENCE]).toBe(-0.5);
    });
  });

  // ─── Source Reliability (GUTTERS §7.2) ─────────────────────

  describe("SOURCE_RELIABILITY", () => {
    it("user sources have highest reliability", () => {
      expect(SOURCE_RELIABILITY.user).toBe(1.0);
      expect(SOURCE_RELIABILITY.user_tracking).toBe(0.95);
    });

    it("system sources have lowest reliability", () => {
      expect(SOURCE_RELIABILITY.system).toBe(0.6);
      expect(SOURCE_RELIABILITY.unknown).toBe(0.5);
    });

    it("observer reliability between user and system", () => {
      expect(SOURCE_RELIABILITY.observer).toBe(0.8);
      expect(SOURCE_RELIABILITY.observer_cyclical).toBe(0.82);
    });
  });

  // ─── Recency Decay (GUTTERS §7.4) ─────────────────────────

  describe("calculateRecencyMultiplier", () => {
    const now = new Date("2025-06-15T12:00:00Z");

    it("returns 1.0 for evidence from now", () => {
      expect(calculateRecencyMultiplier(now, now)).toBe(1.0);
    });

    it("returns ~0.707 for evidence 15 days old", () => {
      const then = new Date(now.getTime() - 15 * 86_400_000);
      const result = calculateRecencyMultiplier(then, now);
      expect(result).toBeCloseTo(0.707, 2);
    });

    it("returns ~0.500 for evidence 30 days old (half-life)", () => {
      const then = new Date(now.getTime() - 30 * 86_400_000);
      const result = calculateRecencyMultiplier(then, now);
      expect(result).toBeCloseTo(0.5, 2);
    });

    it("returns ~0.250 for evidence 60 days old", () => {
      const then = new Date(now.getTime() - 60 * 86_400_000);
      const result = calculateRecencyMultiplier(then, now);
      expect(result).toBeCloseTo(0.25, 2);
    });

    it("returns ~0.125 for evidence 90 days old", () => {
      const then = new Date(now.getTime() - 90 * 86_400_000);
      const result = calculateRecencyMultiplier(then, now);
      expect(result).toBeCloseTo(0.125, 2);
    });

    it("floors at 0.10 for very old evidence (120+ days)", () => {
      const then = new Date(now.getTime() - 150 * 86_400_000);
      const result = calculateRecencyMultiplier(then, now);
      expect(result).toBe(RECENCY_FLOOR);
    });

    it("returns 1.0 for future evidence dates", () => {
      const future = new Date(now.getTime() + 10 * 86_400_000);
      expect(calculateRecencyMultiplier(future, now)).toBe(1.0);
    });
  });

  // ─── Position Factor (GUTTERS §7.5) ───────────────────────

  describe("calculatePositionFactor", () => {
    it("position 0 = 1.000", () => {
      expect(calculatePositionFactor(0)).toBeCloseTo(1.0, 3);
    });

    it("position 1 = 0.909", () => {
      expect(calculatePositionFactor(1)).toBeCloseTo(0.909, 2);
    });

    it("position 5 = 0.667", () => {
      expect(calculatePositionFactor(5)).toBeCloseTo(0.667, 2);
    });

    it("position 10 = 0.500", () => {
      expect(calculatePositionFactor(10)).toBeCloseTo(0.5, 3);
    });

    it("position 20 = 0.333", () => {
      expect(calculatePositionFactor(20)).toBeCloseTo(0.333, 2);
    });
  });

  // ─── Evidence Record Creation (GUTTERS §7.3) ──────────────

  describe("createEvidenceRecord", () => {
    const now = new Date("2025-06-15T12:00:00Z");

    it("creates record with correct base weight", () => {
      const record = createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "test", 0, now);
      expect(record.baseWeight).toBe(0.75);
      expect(record.sourceReliability).toBe(1.0);
      expect(record.recencyMultiplier).toBe(1.0);
      expect(record.positionFactor).toBe(1.0);
      expect(record.effectiveWeight).toBe(0.75); // 0.75 × 1.0 × 1.0 × 1.0
    });

    it("applies source reliability", () => {
      const record = createEvidenceRecord(
        EvidenceType.OBSERVER_PATTERN,
        "observer",
        "test",
        0,
        now,
      );
      expect(record.baseWeight).toBe(0.55);
      expect(record.sourceReliability).toBe(0.8);
      expect(record.effectiveWeight).toBeCloseTo(0.55 * 0.8, 4);
    });

    it("applies recency decay for old evidence", () => {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const record = createEvidenceRecord(
        EvidenceType.JOURNAL_ENTRY,
        "user",
        "test",
        0,
        now,
        thirtyDaysAgo,
      );
      expect(record.recencyMultiplier).toBeCloseTo(0.5, 2);
      expect(record.effectiveWeight).toBeCloseTo(0.75 * 1.0 * 0.5 * 1.0, 2);
    });

    it("applies position factor for later evidence", () => {
      const record = createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "test", 10, now);
      expect(record.positionFactor).toBeCloseTo(0.5, 3);
      expect(record.effectiveWeight).toBeCloseTo(0.75 * 1.0 * 1.0 * 0.5, 3);
    });

    it("doubles contradiction impact", () => {
      const record = createEvidenceRecord(EvidenceType.USER_REJECTION, "user", "test", 0, now);
      expect(record.baseWeight).toBe(-1.5);
      // Contradictions: baseWeight × reliability × 2.0
      expect(record.effectiveWeight).toBe(-1.5 * 1.0 * 2.0);
    });

    it("uses unknown reliability for unknown sources", () => {
      const record = createEvidenceRecord(
        EvidenceType.JOURNAL_ENTRY,
        "something_weird",
        "test",
        0,
        now,
      );
      expect(record.sourceReliability).toBe(0.5);
    });

    it("generates unique IDs", () => {
      const r1 = createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "a", 0, now);
      const r2 = createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "b", 1, now);
      expect(r1.id).not.toBe(r2.id);
    });
  });

  // ─── Main Confidence Formula (GUTTERS §7.6) ──────────────

  describe("calculateConfidence", () => {
    const now = new Date("2025-06-15T12:00:00Z");

    it("returns low confidence for no evidence", () => {
      const result = calculateConfidence([]);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.band).toBe(ConfidenceBand.LOW);
      expect(result.evidenceCount).toBe(0);
    });

    it("increases confidence with positive evidence", () => {
      const records = [
        createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "a", 0, now),
        createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "b", 1, now),
        createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "c", 2, now),
      ];
      const result = calculateConfidence(records);
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.positiveCount).toBe(3);
      expect(result.negativeCount).toBe(0);
    });

    it("decreases confidence with contradictions", () => {
      const positive = [createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "a", 0, now)];
      const withContradiction = [
        ...positive,
        createEvidenceRecord(EvidenceType.USER_REJECTION, "user", "nope", 1, now),
      ];

      const resultPositive = calculateConfidence(positive);
      const resultContradiction = calculateConfidence(withContradiction);

      expect(resultContradiction.confidence).toBeLessThan(resultPositive.confidence);
      expect(resultContradiction.negativeCount).toBe(1);
    });

    it("confidence is bounded between 0 and 1", () => {
      // Stack lots of positive evidence
      const records = Array.from({ length: 20 }, (_, i) =>
        createEvidenceRecord(EvidenceType.USER_CONFIRMATION, "user", `ev-${i}`, i, now),
      );
      const result = calculateConfidence(records);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it("strong user confirmation produces high confidence", () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        createEvidenceRecord(EvidenceType.USER_CONFIRMATION, "user", `confirm-${i}`, i, now),
      );
      const result = calculateConfidence(records);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.band).not.toBe(ConfidenceBand.LOW);
    });

    it("sigmoid formula matches GUTTERS spec", () => {
      // Manual calculation: 1 evidence with effective weight 0.75
      // totalWeight = 0.75
      // raw = 0.20 + 0.75 * 0.12 = 0.29
      // sigmoid = 1 / (1 + exp(-5 * (0.29 - 0.5)))
      // sigmoid = 1 / (1 + exp(-5 * -0.21))
      // sigmoid = 1 / (1 + exp(1.05))
      // sigmoid ≈ 1 / (1 + 2.858) ≈ 0.259
      const records = [createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "a", 0, now)];
      const result = calculateConfidence(records);
      const raw = BASE_CONFIDENCE + records[0].effectiveWeight * CONFIDENCE_SCALE;
      const expectedSigmoid = 1 / (1 + Math.exp(-5 * (raw - 0.5)));
      expect(result.confidence).toBeCloseTo(expectedSigmoid, 4);
    });
  });

  // ─── Confidence Bands ─────────────────────────────────────

  describe("getConfidenceBand", () => {
    it("HIGH for > 0.80", () => {
      expect(getConfidenceBand(0.85)).toBe(ConfidenceBand.HIGH);
      expect(getConfidenceBand(0.99)).toBe(ConfidenceBand.HIGH);
    });

    it("MODERATE for 0.60-0.80", () => {
      expect(getConfidenceBand(0.6)).toBe(ConfidenceBand.MODERATE);
      expect(getConfidenceBand(0.75)).toBe(ConfidenceBand.MODERATE);
      expect(getConfidenceBand(0.8)).toBe(ConfidenceBand.MODERATE);
    });

    it("LOW for < 0.60", () => {
      expect(getConfidenceBand(0.59)).toBe(ConfidenceBand.LOW);
      expect(getConfidenceBand(0.1)).toBe(ConfidenceBand.LOW);
    });
  });

  // ─── Initial Confidence (GUTTERS §7.7) ────────────────────

  describe("calculateInitialConfidence", () => {
    it("returns minimum BASE_CONFIDENCE with zero data", () => {
      const result = calculateInitialConfidence(0.55, 0.8, 0, 0);
      expect(result).toBe(BASE_CONFIDENCE);
    });

    it("caps at 0.75", () => {
      const result = calculateInitialConfidence(1.0, 1.0, 100, 1.0);
      expect(result).toBeLessThanOrEqual(0.75);
    });

    it("scales with data points logarithmically", () => {
      const few = calculateInitialConfidence(0.55, 0.8, 5, 0.7);
      const many = calculateInitialConfidence(0.55, 0.8, 50, 0.7);
      expect(many).toBeGreaterThan(few);
    });

    it("scales with correlation strength", () => {
      const weak = calculateInitialConfidence(0.55, 0.8, 10, 0.3);
      const strong = calculateInitialConfidence(0.55, 0.8, 10, 0.9);
      expect(strong).toBeGreaterThan(weak);
    });
  });

  // ─── Recalculate with Recency Refresh ─────────────────────

  describe("recalculateConfidence", () => {
    it("refreshes recency and returns updated records", () => {
      const past = new Date("2025-05-01T12:00:00Z");
      const now = new Date("2025-06-15T12:00:00Z");
      const records = [
        createEvidenceRecord(EvidenceType.JOURNAL_ENTRY, "user", "a", 0, past, past),
      ];

      const { records: updated, result } = recalculateConfidence(records, now);
      expect(updated[0].recencyMultiplier).toBeLessThan(1.0);
      expect(updated[0].recencyMultiplier).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// OBSERVER — PATTERN DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════

describe("Observer", () => {
  let observer: Observer;

  beforeEach(() => {
    observer = new Observer();
  });

  // ─── Statistics Helpers ────────────────────────────────────

  describe("pearsonCorrelation", () => {
    it("returns 1.0 for perfect positive correlation", () => {
      const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
      expect(r).toBeCloseTo(1.0, 4);
    });

    it("returns -1.0 for perfect negative correlation", () => {
      const r = pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
      expect(r).toBeCloseTo(-1.0, 4);
    });

    it("returns ~0 for uncorrelated data", () => {
      const r = pearsonCorrelation([1, 2, 3, 4, 5], [3, 5, 1, 4, 2]);
      expect(Math.abs(r)).toBeLessThan(0.5);
    });

    it("returns NaN for zero-variance input", () => {
      expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBeNaN();
    });

    it("returns NaN for too few data points", () => {
      expect(pearsonCorrelation([1, 2], [3, 4])).toBeNaN();
    });
  });

  describe("pearsonPValue", () => {
    it("returns low p-value for strong correlation with many points", () => {
      const p = pearsonPValue(0.95, 20);
      expect(p).toBeLessThan(0.01);
    });

    it("returns high p-value for weak correlation", () => {
      const p = pearsonPValue(0.1, 10);
      expect(p).toBeGreaterThan(0.1);
    });

    it("returns 1 for NaN r", () => {
      expect(pearsonPValue(NaN, 10)).toBe(1);
    });

    it("returns 0 for perfect correlation", () => {
      expect(pearsonPValue(1.0, 10)).toBe(0);
    });
  });

  describe("mean and stddev", () => {
    it("calculates mean correctly", () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it("returns 0 for empty array", () => {
      expect(mean([])).toBe(0);
    });

    it("calculates stddev correctly", () => {
      // Population stddev of [2,4,4,4,5,5,7,9] ≈ 2.14 (sample)
      expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    });

    it("returns 0 for single-element array", () => {
      expect(stddev([5])).toBe(0);
    });
  });

  describe("oneWayAnovaP", () => {
    it("returns low p for clearly different groups", () => {
      const groups = [
        [1, 2, 1, 2, 1],
        [8, 9, 8, 9, 8],
        [15, 16, 15, 16, 15],
      ];
      expect(oneWayAnovaP(groups)).toBeLessThan(0.05);
    });

    it("returns high p for similar groups", () => {
      const groups = [
        [5, 5, 5, 5, 5],
        [5, 5, 5, 5, 5],
        [5, 5, 5, 5, 5],
      ];
      // All identical → no between-group variance
      expect(oneWayAnovaP(groups)).toBe(1);
    });

    it("returns 1 for single group", () => {
      expect(oneWayAnovaP([[1, 2, 3]])).toBe(1);
    });
  });

  // ─── observe() ────────────────────────────────────────────

  describe("observe", () => {
    it("returns empty result for no entries", () => {
      const result = observer.observe([]);
      expect(result.entriesAnalyzed).toBe(0);
      expect(result.patterns).toHaveLength(0);
      expect(result.skippedReasons).toContain("no entries");
    });

    it("reports days covered", () => {
      const entries: ObservableEntry[] = [makeEntry({ daysAgo: 90 }), makeEntry({ daysAgo: 0 })];
      const result = observer.observe(entries);
      expect(result.daysCovered).toBeCloseTo(90, 0);
    });

    it("recovers from detection errors gracefully", () => {
      // Single entry with no cosmic data — should not crash
      const entries: ObservableEntry[] = [makeEntry({})];
      const result = observer.observe(entries);
      expect(result.entriesAnalyzed).toBe(1);
      // May or may not have patterns, but should not have thrown
    });
  });

  // ─── Cyclical Patterns ────────────────────────────────────

  describe("detectCyclicalPatterns", () => {
    it("returns empty for insufficient planets", () => {
      const entries = [
        makeEntry({ planet: "Mercury", mood: 5 }),
        makeEntry({ planet: "Venus", mood: 7 }),
      ];
      const result = observer.detectCyclicalPatterns(entries);
      expect(result).toHaveLength(0);
    });

    it("detects inter-period mood variance when significant", () => {
      // Create clearly different mood distributions per planet
      const entries: ObservableEntry[] = [];
      for (let i = 0; i < 8; i++) {
        entries.push(makeEntry({ planet: "Mercury", mood: 2 + Math.random() * 0.5 }));
        entries.push(makeEntry({ planet: "Venus", mood: 8 + Math.random() * 0.5 }));
        entries.push(makeEntry({ planet: "Mars", mood: 5 + Math.random() * 0.5 }));
      }

      const result = observer.detectCyclicalPatterns(entries);
      const moodPatterns = result.filter((p) => p.type === PatternType.INTER_PERIOD_MOOD_VARIANCE);

      // Should detect the significant variance
      expect(moodPatterns.length).toBeGreaterThanOrEqual(1);
      if (moodPatterns.length > 0) {
        expect(moodPatterns[0].confidence).toBeGreaterThan(0.5);
        expect(moodPatterns[0].effectSize).toBeGreaterThan(CYCLICAL_CONFIG.MIN_MOOD_DIFFERENCE);
      }
    });

    it("detects theme alignment", () => {
      // Mercury entries with communication keywords
      const entries: ObservableEntry[] = [];
      for (let i = 0; i < 6; i++) {
        entries.push(
          makeEntry({
            planet: "Mercury",
            content:
              "Had a great day of writing and communication, learning new ideas about messaging",
          }),
        );
      }
      // Other planets with neutral content
      for (let i = 0; i < 6; i++) {
        entries.push(makeEntry({ planet: "Venus", content: "went for a walk" }));
        entries.push(makeEntry({ planet: "Mars", content: "nothing special happened" }));
      }

      const result = observer.detectCyclicalPatterns(entries);
      const themes = result.filter((p) => p.type === PatternType.THEME_ALIGNMENT);

      // Mercury should show theme alignment
      const mercuryTheme = themes.find((p) => p.planet === "Mercury");
      expect(mercuryTheme).toBeDefined();
      if (mercuryTheme) {
        expect(mercuryTheme.confidence).toBeGreaterThan(0);
        expect(mercuryTheme.evidenceType).toBe(EvidenceType.THEME_ALIGNMENT);
      }
    });
  });

  // ─── Cosmic Correlations ──────────────────────────────────

  describe("detectCosmicCorrelations", () => {
    it("detects solar correlation when r >= 0.6", () => {
      // Create entries where mood positively correlates with Kp
      const entries: ObservableEntry[] = [];
      for (let i = 0; i < 15; i++) {
        const kp = 1 + i * 0.5;
        const mood = 2 + i * 0.5 + (Math.random() - 0.5) * 0.3; // strong positive correlation + noise
        entries.push(makeEntry({ kp, mood }));
      }

      const result = observer.detectCosmicCorrelations(entries);
      const solar = result.filter((p) => p.type === PatternType.SOLAR_CORRELATION);

      expect(solar.length).toBeGreaterThanOrEqual(1);
      if (solar.length > 0) {
        expect(solar[0].effectSize).toBeGreaterThanOrEqual(0.6);
        expect(solar[0].pValue).toBeLessThan(0.05);
      }
    });

    it("does not detect solar correlation with insufficient entries", () => {
      const entries = [makeEntry({ kp: 3, mood: 5 })];
      const result = observer.detectCosmicCorrelations(entries);
      expect(result.filter((p) => p.type === PatternType.SOLAR_CORRELATION)).toHaveLength(0);
    });

    it("detects lunar correlation when mood varies by phase", () => {
      const entries: ObservableEntry[] = [];
      // Full Moon = high mood, New Moon = low mood
      for (let i = 0; i < 8; i++) {
        entries.push(makeEntry({ moonPhase: "Full Moon", mood: 8 + Math.random() * 0.5 }));
        entries.push(makeEntry({ moonPhase: "New Moon", mood: 3 + Math.random() * 0.5 }));
        entries.push(makeEntry({ moonPhase: "First Quarter", mood: 5 + Math.random() * 0.5 }));
      }

      const result = observer.detectCosmicCorrelations(entries);
      const lunar = result.filter((p) => p.type === PatternType.LUNAR_CORRELATION);

      expect(lunar.length).toBeGreaterThanOrEqual(1);
      if (lunar.length > 0) {
        expect(lunar[0].moonPhase).toBe("Full Moon");
      }
    });
  });

  // ─── Temporal Patterns ────────────────────────────────────

  describe("detectTemporalPatterns", () => {
    it("requires minimum entries", () => {
      const entries = [makeEntry({ mood: 5 })];
      const result = observer.detectTemporalPatterns(entries);
      expect(result).toHaveLength(0);
    });

    it("detects time-of-day patterns", () => {
      const entries: ObservableEntry[] = [];
      // Night owl: high mood 8pm-12am, low mood 4-8am
      for (let i = 0; i < 15; i++) {
        entries.push(makeEntry({ mood: 8 + Math.random() * 0.3, hourOfDay: 22 }));
        entries.push(makeEntry({ mood: 3 + Math.random() * 0.3, hourOfDay: 6 }));
        entries.push(makeEntry({ mood: 5 + Math.random() * 0.3, hourOfDay: 14 }));
      }

      const result = observer.detectTemporalPatterns(entries);
      const timePatterns = result.filter((p) => p.type === PatternType.TIME_OF_DAY);

      expect(timePatterns.length).toBeGreaterThanOrEqual(1);
      if (timePatterns.length > 0) {
        // 22 → block 5 (8pm-12am) → hourOfDay = 20
        expect(timePatterns[0].hourOfDay).toBe(20);
      }
    });

    it("detects day-of-week patterns", () => {
      const entries: ObservableEntry[] = [];
      // Happy Fridays, sad Mondays
      for (let i = 0; i < 10; i++) {
        entries.push(makeEntry({ mood: 9 + Math.random() * 0.3, dayOfWeek: 5 })); // Friday
        entries.push(makeEntry({ mood: 2 + Math.random() * 0.3, dayOfWeek: 1 })); // Monday
        entries.push(makeEntry({ mood: 5 + Math.random() * 0.3, dayOfWeek: 3 })); // Wednesday
      }

      const result = observer.detectTemporalPatterns(entries);
      const dayPatterns = result.filter((p) => p.type === PatternType.DAY_OF_WEEK);

      expect(dayPatterns.length).toBeGreaterThanOrEqual(1);
      if (dayPatterns.length > 0) {
        expect(dayPatterns[0].dayOfWeek).toBe(5); // Friday
      }
    });
  });

  // ─── Gate Patterns ────────────────────────────────────────

  describe("detectGatePatterns", () => {
    it("returns empty for insufficient gate data", () => {
      const result = observer.detectGatePatterns([
        makeEntry({ sunGate: 1, mood: 5 }),
        makeEntry({ sunGate: 2, mood: 7 }),
      ]);
      expect(result).toHaveLength(0);
    });

    it("detects gate mood variance when significant", () => {
      const entries: ObservableEntry[] = [];
      // Gate 41 = high mood, Gate 3 = low mood
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({ sunGate: 41, mood: 9 + Math.random() * 0.3 }));
        entries.push(makeEntry({ sunGate: 3, mood: 2 + Math.random() * 0.3 }));
        entries.push(makeEntry({ sunGate: 22, mood: 5 + Math.random() * 0.3 }));
      }

      const result = observer.detectGatePatterns(entries);
      const gatePatterns = result.filter((p) => p.type === PatternType.INTER_GATE_MOOD_VARIANCE);

      expect(gatePatterns.length).toBeGreaterThanOrEqual(1);
      if (gatePatterns.length > 0) {
        expect(gatePatterns[0].sunGate).toBe(41);
        expect(gatePatterns[0].effectSize).toBeGreaterThanOrEqual(1.5);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// HYPOTHESIS ENGINE
// ═══════════════════════════════════════════════════════════════

describe("Hypothesis Engine", () => {
  let engine: HypothesisEngine;

  beforeEach(() => {
    engine = new HypothesisEngine();
  });

  // ─── Status Resolution ────────────────────────────────────

  describe("resolveStatus", () => {
    it("CONFIRMED when confidence > 0.85", () => {
      expect(resolveStatus(0.9, false, 0)).toBe(HypothesisStatus.CONFIRMED);
    });

    it("TESTING when 0.60 ≤ confidence ≤ 0.85", () => {
      expect(resolveStatus(0.7, false, 0)).toBe(HypothesisStatus.TESTING);
    });

    it("FORMING when confidence < 0.60", () => {
      expect(resolveStatus(0.4, false, 0)).toBe(HypothesisStatus.FORMING);
    });

    it("REJECTED when confidence < 0.20 with contradictions", () => {
      expect(resolveStatus(0.15, true, 0)).toBe(HypothesisStatus.REJECTED);
    });

    it("STALE when 60+ days without evidence", () => {
      expect(resolveStatus(0.5, false, 65)).toBe(HypothesisStatus.STALE);
    });

    it("STALE takes priority over other states", () => {
      // Even high confidence goes stale
      expect(resolveStatus(0.9, false, 65)).toBe(HypothesisStatus.STALE);
    });

    it("no REJECTED without contradictions", () => {
      // Low confidence but no contradictions → FORMING, not REJECTED
      expect(resolveStatus(0.15, false, 0)).toBe(HypothesisStatus.FORMING);
    });
  });

  // ─── Generate from Patterns ───────────────────────────────

  describe("generateFromPatterns", () => {
    it("creates hypotheses from pattern list", () => {
      const patterns = [
        makePattern(PatternType.SOLAR_CORRELATION, "Mood correlates with Kp"),
        makePattern(PatternType.TIME_OF_DAY, "Mood peaks at night"),
      ];

      const hypotheses = engine.generateFromPatterns(patterns);
      expect(hypotheses).toHaveLength(2);

      expect(hypotheses[0].type).toBe(HypothesisType.COSMIC_SENSITIVITY);
      expect(hypotheses[0].status).toBe(HypothesisStatus.FORMING);
      expect(hypotheses[0].confidence).toBeGreaterThan(0);
      expect(hypotheses[0].evidenceRecords).toHaveLength(1);
      expect(hypotheses[0].confidenceHistory).toHaveLength(1);

      expect(hypotheses[1].type).toBe(HypothesisType.TEMPORAL_PATTERN);
    });

    it("deduplicates identical patterns", () => {
      const pattern = makePattern(PatternType.SOLAR_CORRELATION, "same description");
      engine.generateFromPatterns([pattern]);
      const second = engine.generateFromPatterns([pattern]);
      expect(second).toHaveLength(0);
      expect(engine.getAll()).toHaveLength(1);
    });

    it("assigns correct categories", () => {
      const patterns = [
        makePattern(PatternType.THEME_ALIGNMENT, "theme"),
        makePattern(PatternType.INTER_GATE_MOOD_VARIANCE, "gate"),
        makePattern(PatternType.DAY_OF_WEEK, "day"),
      ];

      const hyps = engine.generateFromPatterns(patterns);
      expect(hyps[0].category).toBe("personality");
      expect(hyps[1].category).toBe("cosmic");
      expect(hyps[2].category).toBe("productivity");
    });

    it("records period evidence count for planet-related patterns", () => {
      const pattern = makePattern(PatternType.INTER_PERIOD_MOOD_VARIANCE, "test");
      pattern.planet = "Mercury";
      const hyps = engine.generateFromPatterns([pattern]);
      expect(hyps[0].periodEvidenceCount["Mercury"]).toBe(1);
    });

    it("records gate evidence count for gate-related patterns", () => {
      const pattern = makePattern(PatternType.INTER_GATE_MOOD_VARIANCE, "test");
      pattern.sunGate = 41;
      const hyps = engine.generateFromPatterns([pattern]);
      expect(hyps[0].gateEvidenceCount[41]).toBe(1);
    });
  });

  // ─── Test Evidence ────────────────────────────────────────

  describe("testEvidence", () => {
    it("updates matching hypotheses", () => {
      engine.generateFromPatterns([makePattern(PatternType.SOLAR_CORRELATION, "mood vs kp")]);

      const updates = engine.testEvidence(
        EvidenceType.JOURNAL_ENTRY,
        "journal_analysis",
        "User reports fatigue during storm",
        () => true,
      );

      expect(updates).toHaveLength(1);
      expect(updates[0].previousConfidence).not.toBe(updates[0].newConfidence);
      expect(updates[0].evidenceAdded.evidenceType).toBe(EvidenceType.JOURNAL_ENTRY);
    });

    it("does not update non-matching hypotheses", () => {
      engine.generateFromPatterns([makePattern(PatternType.SOLAR_CORRELATION, "mood vs kp")]);

      const updates = engine.testEvidence(
        EvidenceType.JOURNAL_ENTRY,
        "user",
        "irrelevant",
        () => false, // doesn't match
      );

      expect(updates).toHaveLength(0);
    });

    it("skips CONFIRMED and REJECTED hypotheses", () => {
      const hyps = engine.generateFromPatterns([
        makePattern(PatternType.SOLAR_CORRELATION, "test"),
      ]);

      // Force status to CONFIRMED
      const hyp = engine.get(hyps[0].id)!;
      hyp.status = HypothesisStatus.CONFIRMED;

      const updates = engine.testEvidence(
        EvidenceType.JOURNAL_ENTRY,
        "user",
        "evidence",
        () => true,
      );

      expect(updates).toHaveLength(0);
    });

    it("adds evidence to hypothesis record", () => {
      const hyps = engine.generateFromPatterns([makePattern(PatternType.TIME_OF_DAY, "night owl")]);

      engine.testEvidence(EvidenceType.JOURNAL_ENTRY, "user", "late night", () => true);
      engine.testEvidence(EvidenceType.JOURNAL_ENTRY, "user", "2am work", () => true);

      const hyp = engine.get(hyps[0].id)!;
      expect(hyp.evidenceRecords).toHaveLength(3); // initial + 2
      expect(hyp.confidenceHistory).toHaveLength(3);
    });
  });

  // ─── User Feedback ────────────────────────────────────────

  describe("user feedback", () => {
    it("userConfirm adds strong positive evidence", () => {
      const hyps = engine.generateFromPatterns([
        makePattern(PatternType.SOLAR_CORRELATION, "test"),
      ]);

      const update = engine.userConfirm(hyps[0].id);
      expect(update).not.toBeNull();
      // User confirmation adds a USER_CONFIRMATION evidence record
      expect(update!.evidenceAdded.evidenceType).toBe(EvidenceType.USER_CONFIRMATION);
      expect(update!.evidenceAdded.baseWeight).toBe(1.0);
      // Total evidence count should be 2 (initial + confirmation)
      const hyp = engine.get(hyps[0].id)!;
      expect(hyp.evidenceRecords).toHaveLength(2);
      expect(hyp.evidenceRecords[1].effectiveWeight).toBeGreaterThan(0);
    });

    it("userReject adds strong negative evidence", () => {
      const hyps = engine.generateFromPatterns([
        makePattern(PatternType.SOLAR_CORRELATION, "test"),
      ]);

      const update = engine.userReject(hyps[0].id);
      expect(update).not.toBeNull();
      expect(update!.newConfidence).toBeLessThan(update!.previousConfidence);
      expect(update!.evidenceAdded.evidenceType).toBe(EvidenceType.USER_REJECTION);
    });

    it("returns null for unknown hypothesis ID", () => {
      expect(engine.userConfirm("nonexistent")).toBeNull();
      expect(engine.userReject("nonexistent")).toBeNull();
    });
  });

  // ─── Queries ──────────────────────────────────────────────

  describe("queries", () => {
    it("getActive returns FORMING and TESTING hypotheses", () => {
      const hyps = engine.generateFromPatterns([
        makePattern(PatternType.SOLAR_CORRELATION, "a"),
        makePattern(PatternType.TIME_OF_DAY, "b"),
        makePattern(PatternType.LUNAR_CORRELATION, "c"),
      ]);

      // Force one to CONFIRMED
      engine.get(hyps[0].id)!.status = HypothesisStatus.CONFIRMED;

      expect(engine.getActive()).toHaveLength(2);
      expect(engine.getConfirmed()).toHaveLength(1);
      expect(engine.getAll()).toHaveLength(3);
    });
  });

  // ─── Stale Detection ─────────────────────────────────────

  describe("refreshStaleStatus", () => {
    it("marks hypotheses stale after 60 days without evidence", () => {
      const hyps = engine.generateFromPatterns([makePattern(PatternType.TIME_OF_DAY, "test")]);

      // Push lastEvidenceAt back 65 days
      const hyp = engine.get(hyps[0].id)!;
      hyp.lastEvidenceAt = new Date(Date.now() - 65 * 86_400_000);

      engine.refreshStaleStatus();
      expect(hyp.status).toBe(HypothesisStatus.STALE);
    });

    it("does not mark recent hypotheses stale", () => {
      const hyps = engine.generateFromPatterns([makePattern(PatternType.TIME_OF_DAY, "test")]);

      engine.refreshStaleStatus();
      expect(engine.get(hyps[0].id)!.status).not.toBe(HypothesisStatus.STALE);
    });
  });

  // ─── Load Hypotheses ──────────────────────────────────────

  describe("loadHypotheses", () => {
    it("loads external hypotheses for testing", () => {
      const external = engine.generateFromPatterns([
        makePattern(PatternType.SOLAR_CORRELATION, "loaded"),
      ]);

      const engine2 = new HypothesisEngine();
      engine2.loadHypotheses(external);

      expect(engine2.getAll()).toHaveLength(1);
      expect(engine2.getAll()[0].statement).toBe("loaded");
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// OBSERVER CRON RUNNER
// ═══════════════════════════════════════════════════════════════

describe("Observer Cron Runner", () => {
  beforeEach(() => {
    resetIntelligenceSingletons();
  });

  it("runs successfully with entries", async () => {
    const entries: ObservableEntry[] = [];
    for (let i = 0; i < 15; i++) {
      entries.push(makeEntry({ kp: 1 + i * 0.5, mood: 2 + i * 0.5, daysAgo: 90 - i * 6 }));
    }

    const loader: EntryLoader = {
      loadRecentEntries: async () => entries,
    };

    const result = await runObserverCycle(loader);
    expect(result.entriesAnalyzed).toBe(15);
    expect(result.daysCovered).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("handles loader errors gracefully", async () => {
    const loader: EntryLoader = {
      loadRecentEntries: async () => {
        throw new Error("DB connection failed");
      },
    };

    const result = await runObserverCycle(loader);
    expect(result.entriesAnalyzed).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("DB connection failed");
  });

  it("handles empty entries", async () => {
    const loader: EntryLoader = {
      loadRecentEntries: async () => [],
    };

    const result = await runObserverCycle(loader);
    expect(result.entriesAnalyzed).toBe(0);
    expect(result.patternsDetected).toBe(0);
  });

  it("singletons persist across runs", () => {
    const observer1 = getObserver();
    const observer2 = getObserver();
    expect(observer1).toBe(observer2);

    const engine1 = getHypothesisEngine();
    const engine2 = getHypothesisEngine();
    expect(engine1).toBe(engine2);
  });

  it("resetIntelligenceSingletons clears instances", () => {
    const observer1 = getObserver();
    resetIntelligenceSingletons();
    const observer2 = getObserver();
    expect(observer1).not.toBe(observer2);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST-TURN INTEGRATION
// ═══════════════════════════════════════════════════════════════

describe("Post-Turn Intelligence Integration", () => {
  beforeEach(() => {
    resetIntelligenceSingletons();
  });

  describe("extractEvidenceFromExchange", () => {
    it("detects positive mood reports", () => {
      const evs = extractEvidenceFromExchange("I'm feeling amazing today!", "Great to hear!");
      expect(evs.some((e) => e.description.includes("positive mood"))).toBe(true);
    });

    it("detects negative mood reports", () => {
      const evs = extractEvidenceFromExchange("Feeling terrible and down", "I'm sorry");
      expect(evs.some((e) => e.description.includes("negative mood"))).toBe(true);
    });

    it("detects anxiety/stress", () => {
      const evs = extractEvidenceFromExchange("I'm really anxious about work", "Tell me more");
      expect(evs.some((e) => e.description.includes("anxiety"))).toBe(true);
    });

    it("detects energy levels", () => {
      const high = extractEvidenceFromExchange("Feeling so energized and productive!", "Nice");
      expect(high.some((e) => e.description.includes("high energy"))).toBe(true);

      const low = extractEvidenceFromExchange("I'm exhausted and drained", "Rest up");
      expect(low.some((e) => e.description.includes("low energy"))).toBe(true);
    });

    it("detects user confirmation", () => {
      const evs = extractEvidenceFromExchange(
        "You're right, that's exactly how it is",
        "Glad it helps",
      );
      expect(evs.some((e) => e.type === EvidenceType.USER_EXPLICIT_FEEDBACK)).toBe(true);
    });

    it("detects user disagreement", () => {
      const evs = extractEvidenceFromExchange("That's wrong, I disagree with that", "I see");
      expect(evs.some((e) => e.type === EvidenceType.MISMATCH_EVIDENCE)).toBe(true);
    });

    it("returns empty for neutral conversation", () => {
      const evs = extractEvidenceFromExchange("What's the weather like?", "It's sunny today");
      expect(evs).toHaveLength(0);
    });
  });

  describe("testExchangeAgainstHypotheses", () => {
    it("returns empty when no active hypotheses", async () => {
      const updates = await testExchangeAgainstHypotheses("I'm feeling great!", "Wonderful!");
      expect(updates).toHaveLength(0);
    });

    it("updates hypotheses when evidence matches", async () => {
      // Seed an active hypothesis
      const engine = getHypothesisEngine();
      engine.generateFromPatterns([makePattern(PatternType.SOLAR_CORRELATION, "mood vs kp")]);
      expect(engine.getActive().length).toBeGreaterThan(0);

      const updates = await testExchangeAgainstHypotheses(
        "I'm feeling amazing today!",
        "Great to hear!",
      );

      expect(updates.length).toBeGreaterThan(0);
    });

    it("handles errors gracefully", async () => {
      // Should never throw
      const updates = await testExchangeAgainstHypotheses("test", "test");
      expect(Array.isArray(updates)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

let _entryId = 0;

function makeEntry(opts: {
  mood?: number;
  energy?: number;
  content?: string;
  planet?: string;
  kp?: number;
  moonPhase?: string;
  sunGate?: number;
  hourOfDay?: number;
  dayOfWeek?: number;
  daysAgo?: number;
  symptoms?: string[];
}): ObservableEntry {
  const daysAgo = opts.daysAgo ?? 0;
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000);

  // Override hour if specified
  if (opts.hourOfDay != null) {
    createdAt.setUTCHours(opts.hourOfDay, 0, 0, 0);
  }

  // Override day of week if specified — shift the date to match
  if (opts.dayOfWeek != null) {
    const currentDay = createdAt.getDay();
    const diff = opts.dayOfWeek - currentDay;
    createdAt.setDate(createdAt.getDate() + diff);
  }

  return {
    id: `test-entry-${++_entryId}`,
    content: opts.content ?? "test entry content",
    createdAt,
    mood: opts.mood,
    energy: opts.energy,
    symptoms: opts.symptoms,
    cosmic: {
      ts: createdAt.toISOString(),
      ...(opts.planet
        ? { card: { planet: opts.planet, card: "7♠", day: 10, suit: "SPADES" } }
        : undefined),
      ...(opts.kp != null
        ? { solar: { kp: opts.kp, storm: opts.kp >= 5 ? "storm" : "quiet" } }
        : undefined),
      ...(opts.moonPhase ? { moon: { phase: opts.moonPhase, illum: 0.5 } } : undefined),
      ...(opts.sunGate != null
        ? { gate: { sun: opts.sunGate, line: 3, earth: (opts.sunGate + 32) % 64 || 1 } }
        : undefined),
    },
  };
}

import type { Pattern } from "./observer.js";

function makePattern(type: PatternType, description: string): Pattern {
  return {
    type,
    confidence: 0.7,
    description,
    pValue: 0.03,
    effectSize: 0.65,
    evidenceType: EvidenceType.OBSERVER_PATTERN,
  };
}
