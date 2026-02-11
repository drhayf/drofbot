/**
 * Expression Throttle
 * Phase: 6
 *
 * Rate limiting, quiet hours, repetition avoidance, and engagement
 * feedback for the spontaneous expression system.
 *
 * Rules:
 * - Maximum 3 spontaneous messages per day (configurable)
 * - Minimum 3 hours between messages (configurable)
 * - No messages during quiet hours (default 11pm-7am)
 * - Same topic can't be touched within 48 hours
 * - If operator ignores messages, reduce frequency
 */

import type { DeliveredExpression, ThrottleConfig } from "./types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { DEFAULT_THROTTLE_CONFIG } from "./types.js";

const log = createSubsystemLogger("expression/throttle");

// ─── Throttle Decision ────────────────────────────────────────

export interface ThrottleDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether a new expression can be delivered right now.
 *
 * @param recentExpressions Expressions from the rolling window
 * @param nowMs Current time in ms
 * @param config Throttle configuration
 * @returns Decision with reason if blocked
 */
export function checkThrottle(
  recentExpressions: DeliveredExpression[],
  nowMs: number,
  config: ThrottleConfig = DEFAULT_THROTTLE_CONFIG,
): ThrottleDecision {
  const now = new Date(nowMs);
  const nowHour = now.getHours();

  // ── Quiet hours ──
  if (isQuietHours(nowHour, config.quietHoursStart, config.quietHoursEnd)) {
    return {
      allowed: false,
      reason: `Quiet hours (${config.quietHoursStart}:00–${config.quietHoursEnd}:00)`,
    };
  }

  // ── Daily limit ──
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const todayCount = recentExpressions.filter(
    (e) => new Date(e.deliveredAt).getTime() >= todayMs,
  ).length;

  if (todayCount >= config.maxPerDay) {
    return {
      allowed: false,
      reason: `Daily limit reached (${todayCount}/${config.maxPerDay})`,
    };
  }

  // ── Cooldown ──
  if (recentExpressions.length > 0) {
    const mostRecent = recentExpressions.reduce((latest, e) => {
      const t = new Date(e.deliveredAt).getTime();
      return t > latest ? t : latest;
    }, 0);

    const elapsed = nowMs - mostRecent;
    if (elapsed < config.cooldownMs) {
      const remainingMin = Math.ceil((config.cooldownMs - elapsed) / 60_000);
      return {
        allowed: false,
        reason: `Cooldown: ${remainingMin} minutes remaining`,
      };
    }
  }

  // ── Engagement-based throttle ──
  const engagementPenalty = assessEngagement(recentExpressions);
  if (engagementPenalty === "reduce") {
    // Only allow 1 per day if operator ignores most messages
    if (todayCount >= 1) {
      return {
        allowed: false,
        reason: "Reduced frequency: operator hasn't engaged with recent expressions",
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if a specific topic is in cooldown.
 */
export function isTopicInCooldown(
  topic: string,
  recentExpressions: DeliveredExpression[],
  nowMs: number,
  topicCooldownMs: number = DEFAULT_THROTTLE_CONFIG.topicCooldownMs,
): boolean {
  const topicLower = topic.toLowerCase();
  const topicWords = new Set(topicLower.split(/\s+/).filter((w) => w.length > 3));

  for (const expr of recentExpressions) {
    const age = nowMs - new Date(expr.deliveredAt).getTime();
    if (age > topicCooldownMs) continue;

    // Check topic similarity
    const exprWords = new Set(
      expr.content
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );

    let overlap = 0;
    for (const w of topicWords) {
      if (exprWords.has(w)) overlap++;
    }

    const similarity = topicWords.size > 0 ? overlap / topicWords.size : 0;
    if (similarity > 0.4) {
      log.debug(`Topic "${topic}" in cooldown (${Math.round(age / 3600000)}h ago)`);
      return true;
    }
  }

  return false;
}

// ─── Quiet Hours ───────────────────────────────────────────────

/**
 * Check if the current hour falls within quiet hours.
 * Handles wrap-around (e.g., 23:00 to 07:00).
 */
export function isQuietHours(currentHour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) return false; // no quiet hours

  if (quietStart < quietEnd) {
    // Normal range: e.g., 1:00-6:00
    return currentHour >= quietStart && currentHour < quietEnd;
  }

  // Wrapped range: e.g., 23:00-7:00
  return currentHour >= quietStart || currentHour < quietEnd;
}

// ─── Engagement Assessment ─────────────────────────────────────

/**
 * Assess operator engagement with recent expressions.
 * If they consistently ignore messages, signal to reduce frequency.
 */
function assessEngagement(recentExpressions: DeliveredExpression[]): "normal" | "reduce" {
  // Need at least 5 expressions to judge
  if (recentExpressions.length < 5) return "normal";

  // Look at the last 10 expressions
  const recent = recentExpressions.slice(0, 10);
  const ignored = recent.filter((e) => e.engagement === "ignored").length;
  const total = recent.length;

  // If more than 70% ignored, reduce
  if (ignored / total > 0.7) {
    return "reduce";
  }

  return "normal";
}

/**
 * Update engagement on an existing expression.
 * Called when the operator replies or reacts to a spontaneous message.
 */
export function classifyEngagement(
  hasReply: boolean,
  hasReaction: boolean,
): "replied" | "reacted" | "ignored" {
  if (hasReply) return "replied";
  if (hasReaction) return "reacted";
  return "ignored";
}
