/**
 * Expression Engine — Barrel Export
 * Phase: 6
 */

export type {
  ExpressionTriggerKind,
  ExpressionTrigger,
  SignificanceFactors,
  ScoredExpression,
  ComposedExpression,
  DeliveredExpression,
  ExpressionEngagement,
  ThrottleConfig,
  ExpressionDeps,
} from "./types.js";

export { SIGNIFICANCE_THRESHOLD, DEFAULT_THROTTLE_CONFIG } from "./types.js";

export {
  calculateScore,
  meetsThreshold,
  assessNovelty,
  assessCosmicWeight,
  assessConvergence,
  assessReceptivity,
  scoreExpression,
} from "./significance.js";

export { composeExpression, adaptLength, type ComposeContext } from "./composer.js";

export {
  checkThrottle,
  isTopicInCooldown,
  isQuietHours,
  classifyEngagement,
  type ThrottleDecision,
} from "./throttle.js";

export { evaluateExpressions, type EvaluationResult } from "./engine.js";
