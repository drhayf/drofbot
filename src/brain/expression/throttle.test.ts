/**
 * Expression Throttle — Tests
 * Phase: 6
 *
 * Tests for:
 * 1. Quiet hours detection (normal and wrap-around)
 * 2. Daily limit enforcement
 * 3. Cooldown enforcement
 * 4. Topic cooldown (deduplication)
 * 5. Engagement feedback (reduce if ignored)
 * 6. Engagement classification
 */

import { describe, it, expect } from "vitest";
import type { DeliveredExpression, ThrottleConfig } from "./types.js";
import { checkThrottle, isTopicInCooldown, isQuietHours, classifyEngagement } from "./throttle.js";

// ─── Helpers ───────────────────────────────────────────────────

const HOUR = 3600000;
const DAY = 24 * HOUR;

function makeConfig(overrides?: Partial<ThrottleConfig>): ThrottleConfig {
  return {
    maxPerDay: 3,
    cooldownMs: 3 * HOUR,
    quietHoursStart: 23,
    quietHoursEnd: 7,
    topicCooldownMs: 48 * HOUR,
    ...overrides,
  };
}

function makeExpr(overrides?: Partial<DeliveredExpression>): DeliveredExpression {
  return {
    id: crypto.randomUUID(),
    content: "test expression",
    significanceScore: 0.8,
    triggers: [{ kind: "cosmic_shift", description: "test", source: "test" }],
    deliveredAt: new Date().toISOString(),
    channel: "telegram",
    engagement: null,
    ...overrides,
  };
}

/**
 * Create a Date with a specific hour for tests.
 */
function dateAtHour(hour: number, minutesAgo = 0): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (minutesAgo > 0) {
    d.setTime(d.getTime() - minutesAgo * 60000);
  }
  return d;
}

// ─── Quiet Hours ───────────────────────────────────────────────

describe("isQuietHours", () => {
  it("detects quiet hours in normal range", () => {
    // 1-6 quiet
    expect(isQuietHours(3, 1, 6)).toBe(true);
    expect(isQuietHours(0, 1, 6)).toBe(false);
    expect(isQuietHours(6, 1, 6)).toBe(false);
  });

  it("detects quiet hours in wrap-around range", () => {
    // 23-7 quiet
    expect(isQuietHours(0, 23, 7)).toBe(true);
    expect(isQuietHours(23, 23, 7)).toBe(true);
    expect(isQuietHours(3, 23, 7)).toBe(true);
    expect(isQuietHours(7, 23, 7)).toBe(false);
    expect(isQuietHours(12, 23, 7)).toBe(false);
  });

  it("returns false when start equals end", () => {
    expect(isQuietHours(12, 7, 7)).toBe(false);
  });
});

// ─── Throttle Decision ────────────────────────────────────────

describe("checkThrottle", () => {
  it("allows when no recent expressions", () => {
    const now = dateAtHour(10);
    const result = checkThrottle([], now.getTime(), makeConfig());
    expect(result.allowed).toBe(true);
  });

  it("blocks during quiet hours", () => {
    const now = dateAtHour(2); // 2 AM
    const result = checkThrottle([], now.getTime(), makeConfig());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Quiet hours");
  });

  it("blocks when daily limit reached", () => {
    const now = dateAtHour(14);
    const today = new Date(now);
    today.setHours(8, 0, 0, 0);

    const expressions = [
      makeExpr({ deliveredAt: new Date(today.getTime() + 1 * HOUR).toISOString() }),
      makeExpr({ deliveredAt: new Date(today.getTime() + 3 * HOUR).toISOString() }),
      makeExpr({ deliveredAt: new Date(today.getTime() + 5 * HOUR).toISOString() }),
    ];

    const result = checkThrottle(expressions, now.getTime(), makeConfig({ maxPerDay: 3 }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Daily limit");
  });

  it("blocks when within cooldown period", () => {
    const now = dateAtHour(14);
    const expressions = [
      makeExpr({
        deliveredAt: new Date(now.getTime() - 30 * 60000).toISOString(), // 30 min ago
      }),
    ];

    const result = checkThrottle(expressions, now.getTime(), makeConfig({ cooldownMs: 3 * HOUR }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Cooldown");
  });

  it("allows when cooldown has elapsed", () => {
    const now = dateAtHour(14);
    const expressions = [
      makeExpr({
        deliveredAt: new Date(now.getTime() - 4 * HOUR).toISOString(), // 4 hours ago
      }),
    ];

    const result = checkThrottle(expressions, now.getTime(), makeConfig({ cooldownMs: 3 * HOUR }));
    expect(result.allowed).toBe(true);
  });

  it("reduces frequency when operator ignores messages", () => {
    const now = dateAtHour(14);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 6 ignored expressions spread across previous days (not today)
    const expressions: DeliveredExpression[] = [];
    for (let i = 0; i < 6; i++) {
      expressions.push(
        makeExpr({
          deliveredAt: new Date(now.getTime() - (i + 1) * DAY - HOUR).toISOString(),
          engagement: "ignored",
        }),
      );
    }
    // Add exactly 1 today (under the maxPerDay=3 limit, but engagement reduction kicks in at 1)
    expressions.push(
      makeExpr({
        deliveredAt: new Date(todayStart.getTime() + 1 * HOUR).toISOString(),
        engagement: "ignored",
      }),
    );

    const result = checkThrottle(expressions, now.getTime(), makeConfig({ cooldownMs: 0 }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Reduced frequency");
  });
});

// ─── Topic Cooldown ────────────────────────────────────────────

describe("isTopicInCooldown", () => {
  it("detects recently discussed similar topic", () => {
    const now = Date.now();
    const expressions = [
      makeExpr({
        content: "cosmic convergence patterns shifting alignment today",
        deliveredAt: new Date(now - 12 * HOUR).toISOString(),
      }),
    ];

    const result = isTopicInCooldown(
      "cosmic convergence patterns today",
      expressions,
      now,
      48 * HOUR,
    );
    expect(result).toBe(true);
  });

  it("allows unrelated topics", () => {
    const now = Date.now();
    const expressions = [
      makeExpr({
        content: "The weather is beautiful outside",
        deliveredAt: new Date(now - 1 * HOUR).toISOString(),
      }),
    ];

    const result = isTopicInCooldown("quantum mechanics implications", expressions, now, 48 * HOUR);
    expect(result).toBe(false);
  });

  it("allows topic after cooldown expires", () => {
    const now = Date.now();
    const expressions = [
      makeExpr({
        content: "cosmic convergence patterns shifting alignment",
        deliveredAt: new Date(now - 72 * HOUR).toISOString(), // 72 hours ago
      }),
    ];

    const result = isTopicInCooldown("cosmic convergence patterns", expressions, now, 48 * HOUR);
    expect(result).toBe(false);
  });
});

// ─── Engagement Classification ─────────────────────────────────

describe("classifyEngagement", () => {
  it("returns 'replied' when operator replied", () => {
    expect(classifyEngagement(true, false)).toBe("replied");
  });

  it("returns 'reacted' when operator reacted", () => {
    expect(classifyEngagement(false, true)).toBe("reacted");
  });

  it("prefers 'replied' over 'reacted'", () => {
    expect(classifyEngagement(true, true)).toBe("replied");
  });

  it("returns 'ignored' when no interaction", () => {
    expect(classifyEngagement(false, false)).toBe("ignored");
  });
});
