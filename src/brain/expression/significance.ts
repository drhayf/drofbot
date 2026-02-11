/**
 * Significance Scorer
 * Phase: 6
 *
 * Evaluates potential expressions for significance.
 * Only expressions scoring above the threshold (0.7) get composed.
 * This keeps the bar high — every message should feel earned.
 */

import type {
  ExpressionTrigger,
  SignificanceFactors,
  ScoredExpression,
  DeliveredExpression,
} from "./types.js";
import { SIGNIFICANCE_THRESHOLD } from "./types.js";

// ─── Factor Weights ────────────────────────────────────────────

/**
 * How much each factor contributes to the final score.
 * Total weights = 1.0
 */
const WEIGHTS: Record<keyof SignificanceFactors, number> = {
  novelty: 0.25,
  relevance: 0.2,
  cosmicWeight: 0.15,
  convergence: 0.15,
  timeSensitivity: 0.1,
  operatorReceptivity: 0.15,
};

// ─── Scoring ───────────────────────────────────────────────────

/**
 * Calculate the overall significance score from individual factors.
 * Returns a weighted sum clamped to [0, 1].
 */
export function calculateScore(factors: SignificanceFactors): number {
  let score = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const value = factors[key as keyof SignificanceFactors];
    score += value * weight;
  }
  return Math.max(0, Math.min(1, score));
}

/**
 * Check if a score exceeds the delivery threshold.
 */
export function meetsThreshold(score: number): boolean {
  return score >= SIGNIFICANCE_THRESHOLD;
}

// ─── Novelty Assessment ────────────────────────────────────────

/**
 * Assess novelty of a topic against recent expression history.
 * Score decays the more recently a similar topic was discussed.
 *
 * @param topic The current topic
 * @param recentExpressions Recent delivered expressions
 * @param nowMs Current time in ms
 * @param topicCooldownMs How long before a topic can be repeated
 * @returns Novelty score (0 = just said this, 1 = completely fresh)
 */
export function assessNovelty(
  topic: string,
  recentExpressions: DeliveredExpression[],
  nowMs: number,
  topicCooldownMs: number,
): number {
  if (recentExpressions.length === 0) return 1.0;

  const topicLower = topic.toLowerCase();
  const topicWords = new Set(topicLower.split(/\s+/).filter((w) => w.length > 3));

  let minAge = Number.POSITIVE_INFINITY;

  for (const expr of recentExpressions) {
    // Check topic similarity via word overlap
    const exprWords = new Set(
      (expr.content + " " + expr.triggers.map((t) => t.description).join(" "))
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );

    const overlap = intersection(topicWords, exprWords);
    const similarity = topicWords.size > 0 ? overlap / topicWords.size : 0;

    if (similarity > 0.3) {
      const age = nowMs - new Date(expr.deliveredAt).getTime();
      minAge = Math.min(minAge, age);
    }
  }

  if (minAge === Number.POSITIVE_INFINITY) return 1.0;

  // Linear decay: 0 at time 0, 1 at topicCooldownMs
  return Math.min(1.0, minAge / topicCooldownMs);
}

/**
 * Assess cosmic weight of a trigger.
 * Rare or notable events score higher.
 */
export function assessCosmicWeight(triggers: ExpressionTrigger[]): number {
  let maxWeight = 0;

  for (const trigger of triggers) {
    const data = trigger.data ?? {};

    switch (trigger.kind) {
      case "cosmic_shift": {
        // KP index storms are rare
        const kp = typeof data.kpIndex === "number" ? data.kpIndex : 0;
        if (kp >= 7) maxWeight = Math.max(maxWeight, 0.95);
        else if (kp >= 5) maxWeight = Math.max(maxWeight, 0.7);
        else if (kp >= 3) maxWeight = Math.max(maxWeight, 0.4);

        // Gate changes, card periods
        if (data.isGateChange) maxWeight = Math.max(maxWeight, 0.6);
        if (data.isCardPeriodTransition) maxWeight = Math.max(maxWeight, 0.5);
        if (data.isLunarPhase) maxWeight = Math.max(maxWeight, 0.4);
        break;
      }
      case "hypothesis_update": {
        const confidence = typeof data.confidence === "number" ? data.confidence : 0;
        if (confidence >= 0.8) maxWeight = Math.max(maxWeight, 0.7);
        else if (confidence >= 0.6) maxWeight = Math.max(maxWeight, 0.5);
        break;
      }
      case "pattern_detection":
        maxWeight = Math.max(maxWeight, 0.5);
        break;
      case "operator_echo":
        maxWeight = Math.max(maxWeight, 0.6);
        break;
      case "curiosity_thread":
        maxWeight = Math.max(maxWeight, 0.4);
        break;
      case "serendipity":
        maxWeight = Math.max(maxWeight, 0.3);
        break;
      default:
        maxWeight = Math.max(maxWeight, 0.3);
    }
  }

  return maxWeight;
}

/**
 * Assess convergence — how many distinct systems/patterns are involved.
 */
export function assessConvergence(triggers: ExpressionTrigger[]): number {
  const systems = new Set(triggers.map((t) => t.source));
  const kinds = new Set(triggers.map((t) => t.kind));

  // More systems + more kinds = higher convergence
  const systemScore = Math.min(1.0, systems.size / 3);
  const kindScore = Math.min(1.0, kinds.size / 3);

  return (systemScore + kindScore) / 2;
}

/**
 * Assess operator receptivity based on time of day and preferences.
 */
export function assessReceptivity(
  nowHour: number,
  activeHoursStart: number,
  activeHoursEnd: number,
): number {
  // Outside active hours = very low receptivity
  if (activeHoursEnd > activeHoursStart) {
    // Normal range (e.g., 7-23)
    if (nowHour < activeHoursStart || nowHour >= activeHoursEnd) return 0.1;
  } else {
    // Wrapped range (e.g., 22-6)
    if (nowHour >= activeHoursEnd && nowHour < activeHoursStart) return 0.1;
  }

  // Peak receptivity mid-morning and late afternoon
  if (nowHour >= 9 && nowHour <= 11) return 0.9;
  if (nowHour >= 15 && nowHour <= 17) return 0.85;
  if (nowHour >= 19 && nowHour <= 21) return 0.7;

  return 0.5;
}

/**
 * Score a complete potential expression.
 */
export function scoreExpression(
  topic: string,
  triggers: ExpressionTrigger[],
  recentExpressions: DeliveredExpression[],
  nowMs: number,
  nowHour: number,
  activeHoursStart: number,
  activeHoursEnd: number,
  topicCooldownMs: number,
  /** Optional relevance override (from caller context, 0-1) */
  relevanceHint?: number,
): ScoredExpression {
  const novelty = assessNovelty(topic, recentExpressions, nowMs, topicCooldownMs);
  const cosmicWeight = assessCosmicWeight(triggers);
  const convergence = assessConvergence(triggers);
  const operatorReceptivity = assessReceptivity(nowHour, activeHoursStart, activeHoursEnd);
  const relevance = relevanceHint ?? 0.5;

  // Time sensitivity: cosmic shifts and hypothesis updates are time-sensitive
  const timeSensitivity = triggers.some(
    (t) => t.kind === "cosmic_shift" || t.kind === "hypothesis_update",
  )
    ? 0.7
    : 0.3;

  const factors: SignificanceFactors = {
    novelty,
    relevance,
    cosmicWeight,
    convergence,
    timeSensitivity,
    operatorReceptivity,
  };

  const score = calculateScore(factors);

  return { triggers, factors, score, topic };
}

// ─── Helpers ───────────────────────────────────────────────────

function intersection(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count++;
  }
  return count;
}
