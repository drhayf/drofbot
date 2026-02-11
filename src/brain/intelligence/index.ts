/**
 * Intelligence Module — Public API
 *
 * Re-exports the core intelligence components:
 * - Weighted Confidence Calculator (§7)
 * - Observer Pattern Detection Engine (§4-§5)
 * - Hypothesis Engine (§6, §8)
 * - Observer Cron Runner
 * - Post-Turn Integration
 */

// Confidence Calculator
export {
  EvidenceType,
  BASE_WEIGHTS,
  SOURCE_RELIABILITY,
  HALF_LIFE_DAYS,
  RECENCY_FLOOR,
  BASE_CONFIDENCE,
  CONFIDENCE_SCALE,
  SIGMOID_STEEPNESS,
  SIGMOID_CENTER,
  STALE_DAYS,
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
  type ConfidenceResult,
} from "./confidence.js";

// Observer
export {
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
  type Pattern,
  type ObservationResult,
  type ObservableEntry,
} from "./observer.js";

// Hypothesis Engine
export {
  HypothesisEngine,
  HypothesisType,
  HypothesisStatus,
  resolveStatus,
  type Hypothesis,
  type ConfidenceSnapshot,
  type HypothesisUpdate,
} from "./hypothesis.js";

// Observer Runner
export {
  runObserverCycle,
  getObserver,
  getHypothesisEngine,
  resetIntelligenceSingletons,
  type EntryLoader,
  type ObserverRunResult,
} from "./observer-runner.js";

// Post-Turn Integration
export {
  extractEvidenceFromExchange,
  testExchangeAgainstHypotheses,
  type ExtractedEvidence,
} from "./integration.js";
