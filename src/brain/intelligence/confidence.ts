/**
 * Weighted Confidence Calculator
 *
 * Ported from GUTTERS `intelligence/hypothesis/confidence.py` (§7).
 *
 * Master formula:
 *   effectiveWeight = baseWeight × sourceReliability × recencyMultiplier × positionFactor
 *   (contradictions: baseWeight × sourceReliability × 2.0)
 *
 *   confidence = sigmoid(5 × (0.20 + Σ effectiveWeights × 0.12 − 0.5))
 *
 * Recency decay: exponential with 30-day half-life, floor 0.10.
 * Position factor: 1 / (1 + 0.1 × position) — diminishing returns.
 *
 * Confidence thresholds (GUTTERS §7.8):
 *   CONFIRMED: > 0.85
 *   TESTING:   0.60–0.85
 *   FORMING:   < 0.60
 *   REJECTED:  < 0.20 (with contradiction evidence)
 *   STALE:     60 days without evidence
 */

// ─── Evidence Types & Base Weights (GUTTERS §7.1) ───────────────

export enum EvidenceType {
  // Tier 1: Direct User Input (0.90–1.00)
  USER_CONFIRMATION = "USER_CONFIRMATION",
  USER_EXPLICIT_FEEDBACK = "USER_EXPLICIT_FEEDBACK",
  BIRTH_DATA_PROVIDED = "BIRTH_DATA_PROVIDED",

  // Tier 2: Observable Data (0.65–0.80)
  JOURNAL_ENTRY = "JOURNAL_ENTRY",
  TRACKING_DATA_MATCH = "TRACKING_DATA_MATCH",
  MOOD_SCORE_ALIGNMENT = "MOOD_SCORE_ALIGNMENT",
  SYMPTOM_REPORT = "SYMPTOM_REPORT",

  // Tier 3: System Analysis (0.45–0.60)
  OBSERVER_PATTERN = "OBSERVER_PATTERN",
  COSMIC_CORRELATION = "COSMIC_CORRELATION",
  TRANSIT_ALIGNMENT = "TRANSIT_ALIGNMENT",
  THEME_ALIGNMENT = "THEME_ALIGNMENT",
  CYCLICAL_PATTERN = "CYCLICAL_PATTERN",

  // Tier 4: Computed Suggestions (0.25–0.40)
  MODULE_SUGGESTION = "MODULE_SUGGESTION",
  COSMIC_CALCULATION = "COSMIC_CALCULATION",
  GENESIS_REFINEMENT = "GENESIS_REFINEMENT",

  // Contradictions (negative)
  USER_REJECTION = "USER_REJECTION",
  COUNTER_PATTERN = "COUNTER_PATTERN",
  MISMATCH_EVIDENCE = "MISMATCH_EVIDENCE",
}

export const BASE_WEIGHTS: Record<EvidenceType, number> = {
  [EvidenceType.USER_CONFIRMATION]: 1.0,
  [EvidenceType.USER_EXPLICIT_FEEDBACK]: 0.95,
  [EvidenceType.BIRTH_DATA_PROVIDED]: 1.0,
  [EvidenceType.JOURNAL_ENTRY]: 0.75,
  [EvidenceType.TRACKING_DATA_MATCH]: 0.7,
  [EvidenceType.MOOD_SCORE_ALIGNMENT]: 0.72,
  [EvidenceType.SYMPTOM_REPORT]: 0.68,
  [EvidenceType.OBSERVER_PATTERN]: 0.55,
  [EvidenceType.COSMIC_CORRELATION]: 0.5,
  [EvidenceType.TRANSIT_ALIGNMENT]: 0.52,
  [EvidenceType.THEME_ALIGNMENT]: 0.48,
  [EvidenceType.CYCLICAL_PATTERN]: 0.58,
  [EvidenceType.MODULE_SUGGESTION]: 0.35,
  [EvidenceType.COSMIC_CALCULATION]: 0.3,
  [EvidenceType.GENESIS_REFINEMENT]: 0.4,
  [EvidenceType.USER_REJECTION]: -1.5,
  [EvidenceType.COUNTER_PATTERN]: -0.8,
  [EvidenceType.MISMATCH_EVIDENCE]: -0.5,
};

// ─── Source Reliability (GUTTERS §7.2) ──────────────────────────

export const SOURCE_RELIABILITY: Record<string, number> = {
  user: 1.0,
  user_tracking: 0.95,
  journal_analysis: 0.85,
  observer: 0.8,
  observer_cyclical: 0.82,
  cosmic_module: 0.75,
  cardology_module: 0.7,
  genesis: 0.65,
  system: 0.6,
  unknown: 0.5,
};

// ─── Constants (GUTTERS §7.4, §7.5, §7.6) ──────────────────────

/** Exponential decay half-life in days */
export const HALF_LIFE_DAYS = 30;

/** Minimum recency multiplier (floor) */
export const RECENCY_FLOOR = 0.1;

/** Base confidence for the sigmoid formula */
export const BASE_CONFIDENCE = 0.2;

/** Scale factor for total evidence weight */
export const CONFIDENCE_SCALE = 0.12;

/** Sigmoid steepness */
export const SIGMOID_STEEPNESS = 5;

/** Sigmoid center */
export const SIGMOID_CENTER = 0.5;

/** Days without evidence before a hypothesis goes stale */
export const STALE_DAYS = 60;

// ─── Confidence Thresholds (GUTTERS §7.8) ───────────────────────

export const THRESHOLDS = {
  CONFIRMED: 0.85,
  TESTING: 0.6,
  FORMING: 0.6, // below this = FORMING (alias)
  REJECTED: 0.2,
  STALE_DAYS: 60,
} as const;

export enum ConfidenceBand {
  HIGH = "HIGH", // > 0.80
  MODERATE = "MODERATE", // 0.60 – 0.80
  LOW = "LOW", // < 0.60
}

export function getConfidenceBand(confidence: number): ConfidenceBand {
  if (confidence > 0.8) return ConfidenceBand.HIGH;
  if (confidence >= 0.6) return ConfidenceBand.MODERATE;
  return ConfidenceBand.LOW;
}

// ─── Evidence Record (GUTTERS §7.3) ─────────────────────────────

export interface EvidenceRecord {
  id: string;
  evidenceType: EvidenceType;
  source: string;
  description: string;
  timestamp: Date;
  baseWeight: number;
  sourceReliability: number;
  recencyMultiplier: number;
  positionFactor: number;
  effectiveWeight: number;
}

// ─── Recency Decay (GUTTERS §7.4) ──────────────────────────────

/**
 * Exponential decay with 30-day half-life, floor at 0.10.
 *
 * | Age (days) | Multiplier |
 * |------------|-----------|
 * | 0          | 1.000     |
 * | 15         | 0.707     |
 * | 30         | 0.500     |
 * | 60         | 0.250     |
 * | 90         | 0.125     |
 * | 120+       | 0.100     |
 */
export function calculateRecencyMultiplier(evidenceDate: Date, now: Date): number {
  const ageDays = (now.getTime() - evidenceDate.getTime()) / 86_400_000;
  if (ageDays <= 0) return 1.0;

  const lambda = Math.LN2 / HALF_LIFE_DAYS; // ln(2) / 30
  const multiplier = Math.exp(-lambda * ageDays);
  return Math.max(multiplier, RECENCY_FLOOR);
}

// ─── Position Factor / Diminishing Returns (GUTTERS §7.5) ──────

/**
 * Diminishing returns for evidence position in the list.
 *
 * | Position | Factor |
 * |----------|--------|
 * | 0        | 1.000  |
 * | 1        | 0.909  |
 * | 5        | 0.667  |
 * | 10       | 0.500  |
 * | 20       | 0.333  |
 */
export function calculatePositionFactor(position: number): number {
  return 1 / (1 + 0.1 * position);
}

// ─── Evidence Record Factory (GUTTERS §7.3) ─────────────────────

let _nextId = 0;

export function createEvidenceRecord(
  type: EvidenceType,
  source: string,
  description: string,
  position: number,
  now: Date,
  evidenceDate?: Date,
): EvidenceRecord {
  const baseWeight = BASE_WEIGHTS[type];
  const reliability = SOURCE_RELIABILITY[source] ?? SOURCE_RELIABILITY.unknown;
  const recency = calculateRecencyMultiplier(evidenceDate ?? now, now);
  const posFactor = calculatePositionFactor(position);

  let effectiveWeight: number;
  if (baseWeight < 0) {
    // Contradictions: doubled impact, no recency/position modifiers
    effectiveWeight = baseWeight * reliability * 2.0;
  } else {
    effectiveWeight = baseWeight * reliability * recency * posFactor;
  }

  return {
    id: `ev-${Date.now()}-${++_nextId}`,
    evidenceType: type,
    source,
    description,
    timestamp: evidenceDate ?? now,
    baseWeight,
    sourceReliability: reliability,
    recencyMultiplier: recency,
    positionFactor: posFactor,
    effectiveWeight,
  };
}

// ─── Main Confidence Formula (GUTTERS §7.6) ────────────────────

export interface ConfidenceResult {
  confidence: number;
  band: ConfidenceBand;
  totalWeight: number;
  rawScore: number;
  evidenceCount: number;
  positiveCount: number;
  negativeCount: number;
}

/**
 * Calculate confidence from evidence records.
 *
 * Formula:
 *   raw = BASE_CONFIDENCE + (totalWeight × CONFIDENCE_SCALE)
 *   confidence = sigmoid(STEEPNESS × (raw − CENTER))
 *   where sigmoid(x) = 1 / (1 + e^(−x))
 */
export function calculateConfidence(evidenceRecords: EvidenceRecord[]): ConfidenceResult {
  const totalWeight = evidenceRecords.reduce((sum, r) => sum + r.effectiveWeight, 0);

  const positiveCount = evidenceRecords.filter((r) => r.effectiveWeight >= 0).length;
  const negativeCount = evidenceRecords.filter((r) => r.effectiveWeight < 0).length;

  // Raw confidence
  const rawScore = BASE_CONFIDENCE + totalWeight * CONFIDENCE_SCALE;

  // Sigmoid normalization to [0, 1]
  const sigmoid = 1 / (1 + Math.exp(-SIGMOID_STEEPNESS * (rawScore - SIGMOID_CENTER)));
  const confidence = Math.max(0, Math.min(1, sigmoid));

  return {
    confidence,
    band: getConfidenceBand(confidence),
    totalWeight,
    rawScore,
    evidenceCount: evidenceRecords.length,
    positiveCount,
    negativeCount,
  };
}

// ─── Initial Confidence (GUTTERS §7.7) ─────────────────────────

/**
 * Calculate initial confidence for a new hypothesis.
 *
 * Formula:
 *   raw = 0.20 + baseWeight × reliability × (log(1+n)/log(11)) × |r| × 0.5
 *   capped at 0.75
 */
export function calculateInitialConfidence(
  baseWeight: number,
  reliability: number,
  dataPoints: number,
  correlationStrength: number,
): number {
  const raw =
    BASE_CONFIDENCE +
    baseWeight *
      reliability *
      (Math.log(1 + dataPoints) / Math.log(11)) *
      Math.abs(correlationStrength) *
      0.5;

  return Math.min(raw, 0.75);
}

// ─── Recalculate with Recency Refresh ───────────────────────────

/**
 * Recalculate confidence from a list of evidence records, refreshing
 * recency multipliers relative to `now`. Returns updated records and
 * the new confidence result.
 */
export function recalculateConfidence(
  records: EvidenceRecord[],
  now: Date,
): { records: EvidenceRecord[]; result: ConfidenceResult } {
  const updated = records.map((r, idx) => {
    const recency = calculateRecencyMultiplier(r.timestamp, now);
    const posFactor = calculatePositionFactor(idx);
    let effectiveWeight: number;
    if (r.baseWeight < 0) {
      effectiveWeight = r.baseWeight * r.sourceReliability * 2.0;
    } else {
      effectiveWeight = r.baseWeight * r.sourceReliability * recency * posFactor;
    }
    return { ...r, recencyMultiplier: recency, positionFactor: posFactor, effectiveWeight };
  });

  return { records: updated, result: calculateConfidence(updated) };
}
