/**
 * Briefing Runner — Daily Rhythms
 *
 * Generates proactive briefing messages based on:
 * - Current cosmic weather (Council)
 * - Active patterns and hypotheses (Intelligence)
 * - Quest state and progression (Progression)
 * - Synthesis context
 *
 * Three briefing types:
 * 1. Morning Briefing — full cosmic weather + quests + progression
 * 2. Midday Check-in — lighter update, quest progress
 * 3. Evening Reflection — day summary, quest completion, preview
 *
 * Plus on-demand:
 * 4. Cosmic Alert — triggered by significant cosmic events
 *
 * The runner composes the briefing text. Delivery happens via the
 * existing CronPayload/delivery mechanism (sessionTarget: "isolated",
 * delivery.mode: "announce").
 */

import type { CosmicState, HarmonicSynthesis } from "../council/types.js";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import type { PlayerStats, Quest } from "../progression/types.js";
import type { CronJobCreate } from "./types.js";
import { getRankForLevel } from "../progression/types.js";

// ─── Briefing Types ────────────────────────────────────────────

export type BriefingType = "morning" | "midday" | "evening" | "cosmic_alert";

export interface BriefingContent {
  type: BriefingType;
  text: string;
  generatedAt: Date;
  /** Key data used to compose this briefing */
  metadata: {
    systemCount: number;
    activeQuests: number;
    completedToday: number;
  };
}

// ─── Briefing Dependencies ─────────────────────────────────────

export interface BriefingDeps {
  /** Current cosmic states from Council */
  getCosmicStates: () => Promise<Map<string, CosmicState>>;
  /** Current harmonic synthesis */
  getHarmonic: () => Promise<HarmonicSynthesis | null>;
  /** Active hypotheses */
  getActiveHypotheses: () => Hypothesis[];
  /** Confirmed hypotheses */
  getConfirmedHypotheses: () => Hypothesis[];
  /** Current player stats */
  getPlayerStats: () => PlayerStats;
  /** Active quests */
  getActiveQuests: () => Quest[];
  /** Quests completed today */
  getCompletedToday: () => Quest[];
  /** Observer insights (recent patterns found) */
  getRecentInsight: () => string | null;
}

// ─── Briefing Generator ────────────────────────────────────────

/**
 * Generate a morning briefing.
 * Full cosmic weather + quests + progression.
 */
export async function generateMorningBriefing(deps: BriefingDeps): Promise<BriefingContent> {
  const cosmicStates = await deps.getCosmicStates();
  const harmonic = await deps.getHarmonic();
  const stats = deps.getPlayerStats();
  const activeQuests = deps.getActiveQuests();
  const confirmedHyps = deps.getConfirmedHypotheses();
  const insight = deps.getRecentInsight();

  const lines: string[] = [];

  lines.push("Good morning.");
  lines.push("");

  // Cosmic weather
  for (const [_system, state] of cosmicStates) {
    lines.push(state.summary);
  }
  lines.push("");

  // Harmonic resonance
  if (harmonic) {
    const pct = (harmonic.overallResonance * 100).toFixed(0);
    lines.push(
      `🔮 Council resonance: ${pct}% ${harmonic.resonanceType} — ` +
        (harmonic.guidance || "aligned across systems."),
    );
    lines.push("");
  }

  // Today's quests
  if (activeQuests.length > 0) {
    lines.push("Today's Quests:");
    for (let i = 0; i < Math.min(activeQuests.length, 5); i++) {
      const q = activeQuests[i];
      lines.push(`${i + 1}. [${q.questType.toUpperCase()}] ${q.title} — ${q.xpReward} XP`);
    }
    lines.push("");
  }

  // Progression
  const rank = getRankForLevel(stats.currentLevel);
  lines.push(
    `Rank: ${rank.id} (${rank.title}) | XP: ${stats.totalXp.toLocaleString()} | ` +
      `Sync Rate: ${(stats.syncRate * 100).toFixed(0)}% | Streak: ${stats.streakDays} days`,
  );
  lines.push("");

  // Observer insight
  if (insight) {
    lines.push(`The Observer noticed: ${insight}`);
  }

  // Confirmed hypotheses highlight
  if (confirmedHyps.length > 0) {
    const top = confirmedHyps[0];
    lines.push(
      `Known pattern: ${top.statement} (${(top.confidence * 100).toFixed(0)}% confidence)`,
    );
  }

  return {
    type: "morning",
    text: lines.join("\n").trim(),
    generatedAt: new Date(),
    metadata: {
      systemCount: cosmicStates.size,
      activeQuests: activeQuests.length,
      completedToday: 0,
    },
  };
}

/**
 * Generate a midday check-in.
 * Lighter update, quest progress focus.
 */
export async function generateMiddayCheckin(deps: BriefingDeps): Promise<BriefingContent> {
  const cosmicStates = await deps.getCosmicStates();
  const activeQuests = deps.getActiveQuests();
  const completedToday = deps.getCompletedToday();

  const lines: string[] = [];
  lines.push("Midday check-in.");
  lines.push("");

  // Quick cosmic update (solar only if available)
  const solar = cosmicStates.get("solar");
  if (solar) {
    lines.push(`☀️ Solar: ${solar.summary}`);
  }

  // Quest progress
  if (completedToday.length > 0) {
    lines.push(`Completed: ${completedToday.map((q) => q.title).join(", ")}`);
  }

  if (activeQuests.length > 0) {
    lines.push(
      `Remaining: ${activeQuests.length} quest${activeQuests.length > 1 ? "s" : ""} active`,
    );
  } else if (completedToday.length > 0) {
    lines.push("All quests completed for today! 🎯");
  }

  lines.push("");
  lines.push("Any progress to log? Or should I adjust today's quests?");

  return {
    type: "midday",
    text: lines.join("\n").trim(),
    generatedAt: new Date(),
    metadata: {
      systemCount: cosmicStates.size,
      activeQuests: activeQuests.length,
      completedToday: completedToday.length,
    },
  };
}

/**
 * Generate an evening reflection.
 * Day summary, quest completion, tomorrow preview.
 */
export async function generateEveningReflection(deps: BriefingDeps): Promise<BriefingContent> {
  const stats = deps.getPlayerStats();
  const activeQuests = deps.getActiveQuests();
  const completedToday = deps.getCompletedToday();

  const lines: string[] = [];
  lines.push("Evening reflection.");
  lines.push("");

  // Quest summary
  if (completedToday.length > 0) {
    const totalXP = completedToday.reduce((sum, q) => sum + q.xpReward, 0);
    for (const q of completedToday) {
      lines.push(`✅ ${q.title} (${q.xpReward} XP)`);
    }
    lines.push(`Total earned today: ${totalXP} XP`);
    lines.push("");
  }

  if (activeQuests.length > 0) {
    lines.push(
      `Pending: ${activeQuests.length} quest${activeQuests.length > 1 ? "s" : ""} still active`,
    );
    lines.push("");
  }

  lines.push("Today's cosmic snapshot saved to episodic memory.");
  lines.push("The Observer will analyze tonight's data during the next cycle.");
  lines.push("");

  // Progression
  const rank = getRankForLevel(stats.currentLevel);
  const todayXP = completedToday.reduce((sum, q) => sum + q.xpReward, 0);
  lines.push(
    `Rank: ${rank.id} | XP: ${stats.totalXp.toLocaleString()} ` +
      (todayXP > 0 ? `(+${todayXP} today) ` : "") +
      `| Sync Rate: ${(stats.syncRate * 100).toFixed(0)}% | ` +
      `Streak: ${stats.streakDays} days` +
      (stats.streakDays >= 7 ? " 🔥" : ""),
  );

  return {
    type: "evening",
    text: lines.join("\n").trim(),
    generatedAt: new Date(),
    metadata: {
      systemCount: 0,
      activeQuests: activeQuests.length,
      completedToday: completedToday.length,
    },
  };
}

/**
 * Generate a cosmic alert for significant events.
 * Triggered on-demand, not on a schedule.
 */
export function generateCosmicAlert(
  event: { system: string; summary: string; severity: "info" | "warning" | "critical" },
  context?: { patternNote?: string; autoQuest?: { title: string; xpReward: number } },
): BriefingContent {
  const lines: string[] = [];

  const icon = event.severity === "critical" ? "⚡" : event.severity === "warning" ? "⚠️" : "ℹ️";
  lines.push(`${icon} ${event.system} alert: ${event.summary}`);
  lines.push("");

  if (context?.patternNote) {
    lines.push(context.patternNote);
    lines.push("");
  }

  if (context?.autoQuest) {
    lines.push(
      `Auto-quest generated: "${context.autoQuest.title}" (${context.autoQuest.xpReward} XP)`,
    );
  }

  return {
    type: "cosmic_alert",
    text: lines.join("\n").trim(),
    generatedAt: new Date(),
    metadata: {
      systemCount: 1,
      activeQuests: 0,
      completedToday: 0,
    },
  };
}

// ─── Cron Job Definitions ──────────────────────────────────────

/**
 * Create default briefing cron jobs for the data-driven cron system.
 *
 * Returns CronJobCreate objects ready to pass to `cronService.add()`.
 * Each job runs as an isolated agent turn with delivery via the
 * configured primary channel.
 *
 * @param tz  Operator's timezone (default: UTC)
 * @param channel  Delivery channel (default: "last" — most recent channel)
 */
export function createBriefingJobDefs(tz = "UTC", channel: string = "last"): CronJobCreate[] {
  const base = {
    enabled: true,
    sessionTarget: "isolated" as const,
    wakeMode: "now" as const,
    delivery: { mode: "announce" as const, channel },
  };

  return [
    {
      ...base,
      name: "briefing-morning",
      description: "Morning cosmic briefing with quests and progression.",
      schedule: { kind: "cron", expr: "0 8 * * *", tz },
      payload: {
        kind: "agentTurn",
        message:
          "Generate the morning briefing. Include full cosmic weather, today's quests, " +
          "progression stats, and any Observer insights. Use generateMorningBriefing format.",
        deliver: true,
      },
    },
    {
      ...base,
      name: "briefing-midday",
      description: "Midday check-in with quest progress.",
      schedule: { kind: "cron", expr: "0 13 * * *", tz },
      payload: {
        kind: "agentTurn",
        message:
          "Generate the midday check-in. Focus on quest progress, solar update, " +
          "and any adjustments needed. Use generateMiddayCheckin format.",
        deliver: true,
      },
    },
    {
      ...base,
      name: "briefing-evening",
      description: "Evening reflection with day summary.",
      schedule: { kind: "cron", expr: "0 21 * * *", tz },
      payload: {
        kind: "agentTurn",
        message:
          "Generate the evening reflection. Summarize completed quests, XP earned, " +
          "streak status, and preview tomorrow. Use generateEveningReflection format.",
        deliver: true,
      },
    },
  ];
}
