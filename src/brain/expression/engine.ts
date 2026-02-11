/**
 * Expression Engine
 * Phase: 6
 *
 * The core evaluator that decides when Drofbot has something worth
 * saying, composes it in its authentic voice, and delivers it at
 * the right moment.
 *
 * This is NOT a notification system — it's spontaneous thought.
 * Drofbot genuinely finding something interesting and wanting to share it.
 *
 * Flow:
 * 1. Scan intelligence sources for potential expressions
 * 2. Score each for significance
 * 3. Filter by throttle (rate limit, quiet hours, deduplication)
 * 4. Compose the highest-scoring expression
 * 5. Deliver via configured channel
 */

import type {
  ExpressionDeps,
  ExpressionTrigger,
  ScoredExpression,
  ComposedExpression,
  DeliveredExpression,
  ThrottleConfig,
} from "./types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { composeExpression, adaptLength, type ComposeContext } from "./composer.js";
import { scoreExpression, meetsThreshold } from "./significance.js";
import { checkThrottle, isTopicInCooldown } from "./throttle.js";
import { DEFAULT_THROTTLE_CONFIG, SIGNIFICANCE_THRESHOLD } from "./types.js";

const log = createSubsystemLogger("expression/engine");

// ─── Engine ────────────────────────────────────────────────────

export interface EvaluationResult {
  /** Total potential expressions scanned */
  scanned: number;
  /** Expressions that passed significance threshold */
  significant: number;
  /** Whether an expression was composed and delivered */
  delivered: boolean;
  /** The delivered expression (if any) */
  expression?: DeliveredExpression;
  /** Throttle reason (if blocked) */
  throttleReason?: string;
  /** Errors encountered */
  errors: string[];
}

/**
 * Run a full expression evaluation cycle.
 *
 * Scans all intelligence sources, scores potential expressions,
 * selects the best one, composes it, and delivers it if appropriate.
 *
 * @param deps Injected dependencies
 * @param config Throttle configuration
 * @param channel Delivery channel (default: "telegram")
 * @returns Evaluation result summary
 */
export async function evaluateExpressions(
  deps: ExpressionDeps,
  config: ThrottleConfig = DEFAULT_THROTTLE_CONFIG,
  channel: string = "telegram",
): Promise<EvaluationResult> {
  const now = deps.now?.() ?? new Date();
  const nowMs = now.getTime();
  const nowHour = now.getHours();
  const errors: string[] = [];

  // ── 1. Check throttle first (early exit) ──
  let recentExpressions: DeliveredExpression[] = [];
  try {
    recentExpressions = await deps.getRecentExpressions(
      Math.max(config.cooldownMs, config.topicCooldownMs, 24 * 60 * 60 * 1000),
    );
  } catch (err) {
    errors.push(
      `Failed to get recent expressions: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const throttle = checkThrottle(recentExpressions, nowMs, config);
  if (!throttle.allowed) {
    log.debug(`Expression throttled: ${throttle.reason}`);
    return {
      scanned: 0,
      significant: 0,
      delivered: false,
      throttleReason: throttle.reason,
      errors,
    };
  }

  // ── 2. Scan for potential triggers ──
  const triggers = await scanTriggers(deps, errors);

  if (triggers.length === 0) {
    log.debug("No expression triggers found");
    return { scanned: 0, significant: 0, delivered: false, errors };
  }

  // ── 3. Get operator preferences for scoring ──
  let activeHoursStart = 7;
  let activeHoursEnd = 23;
  try {
    const prefs = await deps.getInteractionPreferences();
    activeHoursStart = prefs.activeHours.start;
    activeHoursEnd = prefs.activeHours.end;
  } catch {
    // Use defaults
  }

  // ── 4. Score each potential expression ──
  const scored: ScoredExpression[] = [];
  for (const group of triggers) {
    const s = scoreExpression(
      group.topic,
      group.triggers,
      recentExpressions,
      nowMs,
      nowHour,
      activeHoursStart,
      activeHoursEnd,
      config.topicCooldownMs,
    );
    scored.push(s);
  }

  // ── 5. Filter by threshold ──
  const significant = scored.filter((s) => meetsThreshold(s.score));

  if (significant.length === 0) {
    log.debug(`No expressions met threshold (scanned ${scored.length})`);
    return { scanned: scored.length, significant: 0, delivered: false, errors };
  }

  // ── 6. Select the best (highest score) ──
  significant.sort((a, b) => b.score - a.score);
  let selected = significant[0];

  // Check topic cooldown
  for (const candidate of significant) {
    if (!isTopicInCooldown(candidate.topic, recentExpressions, nowMs, config.topicCooldownMs)) {
      selected = candidate;
      break;
    }
  }

  if (isTopicInCooldown(selected.topic, recentExpressions, nowMs, config.topicCooldownMs)) {
    log.debug("Best expression topic in cooldown");
    return { scanned: scored.length, significant: significant.length, delivered: false, errors };
  }

  // ── 7. Compose ──
  let composed: ComposedExpression;
  try {
    const context = await buildComposeContext(deps, nowHour);
    composed = composeExpression(selected, context);

    // Adapt length to operator style
    composed = {
      ...composed,
      content: adaptLength(composed.content, context.voiceProfile),
    };
  } catch (err) {
    errors.push(`Composition failed: ${err instanceof Error ? err.message : String(err)}`);
    return { scanned: scored.length, significant: significant.length, delivered: false, errors };
  }

  // ── 8. Deliver ──
  let deliverySuccess = false;
  try {
    deliverySuccess = await deps.deliver(composed.content, channel);
  } catch (err) {
    errors.push(`Delivery failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!deliverySuccess) {
    return { scanned: scored.length, significant: significant.length, delivered: false, errors };
  }

  // ── 9. Record ──
  const delivered: DeliveredExpression = {
    id: crypto.randomUUID(),
    content: composed.content,
    significanceScore: composed.significanceScore,
    triggers: composed.triggers,
    deliveredAt: now.toISOString(),
    channel,
    engagement: null,
  };

  try {
    await deps.storeExpression(delivered);
  } catch (err) {
    errors.push(`Failed to store expression: ${err instanceof Error ? err.message : String(err)}`);
  }

  log.info(
    `Expression delivered: score=${composed.significanceScore.toFixed(2)}, ` +
      `topic="${composed.topic}", channel=${channel}`,
  );

  return {
    scanned: scored.length,
    significant: significant.length,
    delivered: true,
    expression: delivered,
    errors,
  };
}

// ─── Trigger Scanning ──────────────────────────────────────────

interface TriggerGroup {
  topic: string;
  triggers: ExpressionTrigger[];
}

/**
 * Scan all intelligence sources for potential expression triggers.
 */
async function scanTriggers(deps: ExpressionDeps, errors: string[]): Promise<TriggerGroup[]> {
  const groups: TriggerGroup[] = [];

  // ── Cosmic shifts ──
  try {
    const states = await deps.getCosmicStates();
    for (const [system, state] of states) {
      if (state.summary && state.summary.length > 10) {
        groups.push({
          topic: `${system} cosmic state`,
          triggers: [
            {
              kind: "cosmic_shift",
              description: state.summary,
              source: system,
              data: state.data,
            },
          ],
        });
      }
    }
  } catch (err) {
    errors.push(`Cosmic scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Hypothesis updates ──
  try {
    const active = deps.getActiveHypotheses();
    for (const hyp of active) {
      if (hyp.confidence >= 0.6) {
        groups.push({
          topic: `hypothesis: ${hyp.description}`,
          triggers: [
            {
              kind: "hypothesis_update",
              description: hyp.description,
              source: "intelligence",
              data: { confidence: hyp.confidence, category: hyp.category, status: hyp.status },
            },
          ],
        });
      }
    }
  } catch (err) {
    errors.push(`Hypothesis scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Pattern insights ──
  try {
    const insight = deps.getRecentInsight();
    if (insight) {
      groups.push({
        topic: `pattern insight`,
        triggers: [
          {
            kind: "pattern_detection",
            description: insight,
            source: "observer",
          },
        ],
      });
    }
  } catch (err) {
    errors.push(`Insight scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Merge convergent triggers ──
  // If multiple triggers share related topics, merge them for higher convergence score
  return mergeConvergentTriggers(groups);
}

/**
 * Merge trigger groups that reference overlapping concepts.
 * Convergent triggers score higher on the convergence factor.
 */
function mergeConvergentTriggers(groups: TriggerGroup[]): TriggerGroup[] {
  if (groups.length <= 1) return groups;

  const merged: TriggerGroup[] = [];
  const used = new Set<number>();

  for (let i = 0; i < groups.length; i++) {
    if (used.has(i)) continue;

    const current = { ...groups[i], triggers: [...groups[i].triggers] };

    for (let j = i + 1; j < groups.length; j++) {
      if (used.has(j)) continue;

      // Simple overlap check: different sources but related
      const iSources = new Set(current.triggers.map((t) => t.source));
      const jSources = new Set(groups[j].triggers.map((t) => t.source));

      let sourceOverlap = false;
      for (const s of jSources) {
        if (iSources.has(s)) {
          sourceOverlap = true;
          break;
        }
      }

      // Different sources = potential convergence (merge)
      if (!sourceOverlap && current.triggers.length < 4) {
        current.triggers.push(...groups[j].triggers);
        current.topic = `${current.topic} + ${groups[j].topic}`;
        used.add(j);
      }
    }

    merged.push(current);
    used.add(i);
  }

  return merged;
}

// ─── Context Building ──────────────────────────────────────────

async function buildComposeContext(
  deps: ExpressionDeps,
  hourOfDay: number,
): Promise<ComposeContext> {
  const [voiceProfile, preferences, identitySynthesis] = await Promise.all([
    deps.getVoiceProfile(),
    deps.getInteractionPreferences(),
    deps.getOperatorSynthesis(),
  ]);

  return {
    voiceProfile,
    preferences,
    identitySynthesis,
    hourOfDay,
  };
}
