/**
 * Hypothesis Engine — Theory Generation & Testing
 *
 * Ported from GUTTERS `intelligence/hypothesis/` (§6, §8).
 *
 * Lifecycle:
 * 1. GENERATION: Observer detects a pattern → Engine creates a hypothesis
 *    "D is electromagnetically sensitive" (initial confidence: 0.30)
 *
 * 2. EVIDENCE COLLECTION: As new experiences arrive, the engine tests
 *    them against active hypotheses. Each matching piece is evidence.
 *
 * 3. CONFIDENCE UPDATE: Weighted Confidence Calculator updates the score.
 *
 * 4. RESOLUTION:
 *    - Confidence > 0.85 → CONFIRMED, promoted to core identity (semantic memory)
 *    - Confidence < 0.20 → ARCHIVED (with contradiction evidence)
 *    - 60 days without evidence → STALE
 *    - Otherwise → ACTIVE, continues collecting evidence
 *
 * Storage: Hypotheses are serializable and stored in semantic memory
 * with category "hypothesis".
 */

import type { Pattern } from "./observer.js";
import {
  type EvidenceRecord,
  type ConfidenceResult,
  EvidenceType,
  calculateConfidence,
  calculateInitialConfidence,
  createEvidenceRecord,
  recalculateConfidence,
  THRESHOLDS,
  STALE_DAYS,
  SOURCE_RELIABILITY,
} from "./confidence.js";

// ─── Hypothesis Types (GUTTERS §6.1) ───────────────────────────

export enum HypothesisType {
  COSMIC_SENSITIVITY = "COSMIC_SENSITIVITY",
  TEMPORAL_PATTERN = "TEMPORAL_PATTERN",
  TRANSIT_EFFECT = "TRANSIT_EFFECT",
  THEME_CORRELATION = "THEME_CORRELATION",
  CYCLICAL_PATTERN = "CYCLICAL_PATTERN",
  BEHAVIORAL = "BEHAVIORAL",
  GATE_CORRELATION = "GATE_CORRELATION",
}

export enum HypothesisStatus {
  FORMING = "FORMING", // confidence < 0.60
  TESTING = "TESTING", // 0.60 ≤ confidence ≤ 0.85
  CONFIRMED = "CONFIRMED", // confidence > 0.85
  REJECTED = "REJECTED", // confidence < 0.20 with contradictions
  STALE = "STALE", // 60 days without new evidence
}

// ─── Pattern → Hypothesis Type Mapping (GUTTERS §8.1) ──────────

import { PatternType } from "./observer.js";

const PATTERN_TO_HYPOTHESIS: Record<PatternType, HypothesisType> = {
  [PatternType.PERIOD_SPECIFIC_SYMPTOM]: HypothesisType.CYCLICAL_PATTERN,
  [PatternType.INTER_PERIOD_MOOD_VARIANCE]: HypothesisType.CYCLICAL_PATTERN,
  [PatternType.INTER_PERIOD_ENERGY_VARIANCE]: HypothesisType.CYCLICAL_PATTERN,
  [PatternType.THEME_ALIGNMENT]: HypothesisType.THEME_CORRELATION,
  [PatternType.CROSS_YEAR_EVOLUTION]: HypothesisType.CYCLICAL_PATTERN,
  [PatternType.SOLAR_CORRELATION]: HypothesisType.COSMIC_SENSITIVITY,
  [PatternType.LUNAR_CORRELATION]: HypothesisType.COSMIC_SENSITIVITY,
  [PatternType.TIME_OF_DAY]: HypothesisType.TEMPORAL_PATTERN,
  [PatternType.DAY_OF_WEEK]: HypothesisType.TEMPORAL_PATTERN,
  [PatternType.GATE_SPECIFIC_SYMPTOM]: HypothesisType.GATE_CORRELATION,
  [PatternType.INTER_GATE_MOOD_VARIANCE]: HypothesisType.GATE_CORRELATION,
  [PatternType.GATE_LINE_CORRELATION]: HypothesisType.GATE_CORRELATION,
};

// ─── Hypothesis Model (GUTTERS §6.2) ───────────────────────────

export interface Hypothesis {
  id: string;
  type: HypothesisType;
  status: HypothesisStatus;
  statement: string;
  category: string;
  confidence: number;
  evidenceRecords: EvidenceRecord[];
  confidenceHistory: ConfidenceSnapshot[];
  /** Magi period evidence counts (planet → count) */
  periodEvidenceCount: Record<string, number>;
  /** I-Ching gate evidence counts (gate → count) */
  gateEvidenceCount: Record<number, number>;
  createdAt: Date;
  updatedAt: Date;
  lastEvidenceAt: Date;
}

export interface ConfidenceSnapshot {
  value: number;
  source: string;
  timestamp: Date;
}

// ─── Hypothesis Update Result ──────────────────────────────────

export interface HypothesisUpdate {
  hypothesisId: string;
  previousConfidence: number;
  newConfidence: number;
  previousStatus: HypothesisStatus;
  newStatus: HypothesisStatus;
  evidenceAdded: EvidenceRecord;
}

// ─── Status Resolution (GUTTERS §6.1, §7.8) ───────────────────

export function resolveStatus(
  confidence: number,
  hasContradictions: boolean,
  daysSinceEvidence: number,
): HypothesisStatus {
  if (daysSinceEvidence >= STALE_DAYS) return HypothesisStatus.STALE;
  if (confidence > THRESHOLDS.CONFIRMED) return HypothesisStatus.CONFIRMED;
  if (confidence < THRESHOLDS.REJECTED && hasContradictions) return HypothesisStatus.REJECTED;
  if (confidence >= THRESHOLDS.TESTING) return HypothesisStatus.TESTING;
  return HypothesisStatus.FORMING;
}

// ─── Hypothesis Engine ─────────────────────────────────────────

let _nextHypId = 0;

export class HypothesisEngine {
  private hypotheses: Map<string, Hypothesis> = new Map();

  /**
   * Generate hypotheses from Observer patterns (GUTTERS §8).
   * Each pattern becomes a hypothesis unless an equivalent one already exists.
   */
  generateFromPatterns(patterns: Pattern[]): Hypothesis[] {
    const now = new Date();
    const generated: Hypothesis[] = [];

    for (const pattern of patterns) {
      // Check for duplicate: same type + description
      const existing = [...this.hypotheses.values()].find(
        (h) =>
          h.type === PATTERN_TO_HYPOTHESIS[pattern.type] &&
          h.statement === pattern.description &&
          h.status !== HypothesisStatus.REJECTED,
      );
      if (existing) continue;

      const hypothesisType = PATTERN_TO_HYPOTHESIS[pattern.type];
      const category = this.categoryFromType(hypothesisType);

      // Initial confidence from observer data (GUTTERS §7.7)
      const initialConfidence = calculateInitialConfidence(
        0.55, // observer base weight
        SOURCE_RELIABILITY.observer,
        10, // typical observer data point count
        pattern.effectSize,
      );

      // Create initial evidence record from the pattern
      const evidence = createEvidenceRecord(
        pattern.evidenceType,
        "observer",
        pattern.description,
        0, // first evidence
        now,
      );

      const id = `hyp-${Date.now()}-${++_nextHypId}`;
      const hypothesis: Hypothesis = {
        id,
        type: hypothesisType,
        status: HypothesisStatus.FORMING,
        statement: pattern.description,
        category,
        confidence: initialConfidence,
        evidenceRecords: [evidence],
        confidenceHistory: [
          { value: initialConfidence, source: "observer_creation", timestamp: now },
        ],
        periodEvidenceCount: pattern.planet ? { [pattern.planet]: 1 } : {},
        gateEvidenceCount: pattern.sunGate != null ? { [pattern.sunGate]: 1 } : {},
        createdAt: now,
        updatedAt: now,
        lastEvidenceAt: now,
      };

      // Set status from initial confidence
      hypothesis.status = resolveStatus(hypothesis.confidence, false, 0);

      this.hypotheses.set(id, hypothesis);
      generated.push(hypothesis);
    }

    return generated;
  }

  /**
   * Test a piece of evidence against all active hypotheses.
   * Returns the list of hypotheses that were updated.
   */
  testEvidence(
    evidenceType: EvidenceType,
    source: string,
    description: string,
    matchesHypothesis: (h: Hypothesis) => boolean,
    evidenceDate?: Date,
  ): HypothesisUpdate[] {
    const now = new Date();
    const updates: HypothesisUpdate[] = [];

    for (const hypothesis of this.hypotheses.values()) {
      // Only test active hypotheses (FORMING or TESTING)
      if (
        hypothesis.status !== HypothesisStatus.FORMING &&
        hypothesis.status !== HypothesisStatus.TESTING
      ) {
        continue;
      }

      if (!matchesHypothesis(hypothesis)) continue;

      const previousConfidence = hypothesis.confidence;
      const previousStatus = hypothesis.status;

      // Create evidence record
      const evidence = createEvidenceRecord(
        evidenceType,
        source,
        description,
        hypothesis.evidenceRecords.length,
        now,
        evidenceDate,
      );

      hypothesis.evidenceRecords.push(evidence);
      hypothesis.lastEvidenceAt = now;
      hypothesis.updatedAt = now;

      // Recalculate confidence with refreshed recency
      const { result } = recalculateConfidence(hypothesis.evidenceRecords, now);
      hypothesis.confidence = result.confidence;

      // Record history
      hypothesis.confidenceHistory.push({
        value: result.confidence,
        source,
        timestamp: now,
      });

      // Update status
      const hasContradictions = result.negativeCount > 0;
      const daysSinceEvidence = 0; // just got evidence
      hypothesis.status = resolveStatus(
        hypothesis.confidence,
        hasContradictions,
        daysSinceEvidence,
      );

      updates.push({
        hypothesisId: hypothesis.id,
        previousConfidence,
        newConfidence: hypothesis.confidence,
        previousStatus,
        newStatus: hypothesis.status,
        evidenceAdded: evidence,
      });
    }

    return updates;
  }

  /**
   * User confirms a hypothesis — add strong positive evidence.
   */
  userConfirm(hypothesisId: string): HypothesisUpdate | null {
    const hypothesis = this.hypotheses.get(hypothesisId);
    if (!hypothesis) return null;

    const updates = this.testEvidence(
      EvidenceType.USER_CONFIRMATION,
      "user",
      "User confirmed this hypothesis",
      (h) => h.id === hypothesisId,
    );

    return updates[0] ?? null;
  }

  /**
   * User rejects a hypothesis — add strong negative evidence.
   */
  userReject(hypothesisId: string): HypothesisUpdate | null {
    const hypothesis = this.hypotheses.get(hypothesisId);
    if (!hypothesis) return null;

    const updates = this.testEvidence(
      EvidenceType.USER_REJECTION,
      "user",
      "User rejected this hypothesis",
      (h) => h.id === hypothesisId,
    );

    return updates[0] ?? null;
  }

  /**
   * Get all active (FORMING or TESTING) hypotheses.
   */
  getActive(): Hypothesis[] {
    return [...this.hypotheses.values()].filter(
      (h) => h.status === HypothesisStatus.FORMING || h.status === HypothesisStatus.TESTING,
    );
  }

  /**
   * Get confirmed hypotheses — core identity insights.
   */
  getConfirmed(): Hypothesis[] {
    return [...this.hypotheses.values()].filter((h) => h.status === HypothesisStatus.CONFIRMED);
  }

  /**
   * Get all hypotheses regardless of status.
   */
  getAll(): Hypothesis[] {
    return [...this.hypotheses.values()];
  }

  /**
   * Refresh stale status on all hypotheses based on time.
   */
  refreshStaleStatus(): void {
    const now = new Date();
    for (const hypothesis of this.hypotheses.values()) {
      if (
        hypothesis.status === HypothesisStatus.FORMING ||
        hypothesis.status === HypothesisStatus.TESTING
      ) {
        const daysSinceEvidence =
          (now.getTime() - hypothesis.lastEvidenceAt.getTime()) / 86_400_000;
        const hasContradictions = hypothesis.evidenceRecords.some((r) => r.effectiveWeight < 0);
        hypothesis.status = resolveStatus(
          hypothesis.confidence,
          hasContradictions,
          daysSinceEvidence,
        );
      }
    }
  }

  /**
   * Load hypotheses from external storage (e.g., semantic memory).
   */
  loadHypotheses(hypotheses: Hypothesis[]): void {
    for (const h of hypotheses) {
      this.hypotheses.set(h.id, h);
    }
  }

  /**
   * Get a hypothesis by ID.
   */
  get(id: string): Hypothesis | undefined {
    return this.hypotheses.get(id);
  }

  // ─── Helpers ────────────────────────────────────────────────

  private categoryFromType(type: HypothesisType): string {
    switch (type) {
      case HypothesisType.COSMIC_SENSITIVITY:
        return "sensitivity";
      case HypothesisType.TEMPORAL_PATTERN:
        return "productivity";
      case HypothesisType.TRANSIT_EFFECT:
        return "cosmic";
      case HypothesisType.THEME_CORRELATION:
        return "personality";
      case HypothesisType.CYCLICAL_PATTERN:
        return "cyclical";
      case HypothesisType.BEHAVIORAL:
        return "behavioral";
      case HypothesisType.GATE_CORRELATION:
        return "cosmic";
      default:
        return "general";
    }
  }
}
