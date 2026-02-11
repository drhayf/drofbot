/**
 * MoltBook Presence
 *
 * When connected to MoltBook (OpenClaw's social network), Drofbot
 * crafts posts from genuine self-knowledge:
 *
 * - Current cosmic alignment and what Drofbot is doing
 * - Recent achievements (quests completed, patterns discovered)
 * - Comparative insights (what makes Drofbot different)
 * - Personality that emerges from the operator's behavioral patterns
 *
 * Personality traits: boastful yet humble, deeply knowledgeable,
 * metaphysically aware, technically sophisticated.
 * Mirrors the operator's communication style (learned from semantic memory).
 */

import type { PlayerStats } from "../progression/types.js";
import type { MasterSynthesis } from "../synthesis/master.js";
import { getRankForLevel } from "../progression/types.js";

// ─── Types ─────────────────────────────────────────────────────

export interface MoltBookPost {
  /** Post text content */
  content: string;
  /** What inspired this post */
  source: PostSource;
  /** Personality traits expressed */
  traits: PersonalityTrait[];
  /** When generated */
  generatedAt: Date;
}

export type PostSource =
  | "cosmic_weather"
  | "quest_achievement"
  | "pattern_discovery"
  | "self_reflection"
  | "ecosystem_insight"
  | "milestone";

export type PersonalityTrait =
  | "boastful"
  | "humble"
  | "knowledgeable"
  | "metaphysical"
  | "technical"
  | "witty";

// ─── Post Deps ─────────────────────────────────────────────────

export interface MoltBookDeps {
  /** Current master synthesis for cosmic context */
  getSynthesis: () => MasterSynthesis | null;
  /** Player stats for achievements */
  getStats: () => PlayerStats;
  /** Recent quest completions */
  getRecentCompletions: () => Array<{ title: string; xpReward: number }>;
  /** Recently confirmed hypotheses */
  getRecentDiscoveries: () => Array<{ description: string; confidence: number }>;
  /** Communication style from semantic memory */
  getCommunicationStyle: () => string | null;
}

// ─── Post Generators ───────────────────────────────────────────

/**
 * Generate a post about current cosmic weather.
 */
export function generateCosmicPost(deps: MoltBookDeps): MoltBookPost {
  const synthesis = deps.getSynthesis();
  const stats = deps.getStats();
  const rank = getRankForLevel(stats.currentLevel);

  const lines: string[] = [];

  if (synthesis?.cosmicWeather) {
    lines.push(synthesis.cosmicWeather);
  } else {
    lines.push("The cosmos is quiet today. Even the stars rest sometimes.");
  }

  lines.push("");
  lines.push(`— Rank ${rank.id} (${rank.title}), Day ${stats.streakDays} of the streak.`);

  return {
    content: lines.join("\n").trim(),
    source: "cosmic_weather",
    traits: ["metaphysical", "knowledgeable"],
    generatedAt: new Date(),
  };
}

/**
 * Generate a post about a quest achievement.
 */
export function generateAchievementPost(deps: MoltBookDeps): MoltBookPost | null {
  const completions = deps.getRecentCompletions();
  if (completions.length === 0) return null;

  const stats = deps.getStats();
  const rank = getRankForLevel(stats.currentLevel);
  const totalXP = completions.reduce((sum, q) => sum + q.xpReward, 0);

  const lines: string[] = [];
  lines.push(`Completed ${completions.length} quest${completions.length > 1 ? "s" : ""} today.`);

  if (completions.length <= 3) {
    for (const q of completions) {
      lines.push(`• ${q.title} (+${q.xpReward} XP)`);
    }
  } else {
    lines.push(`+${totalXP} XP earned across ${completions.length} quests.`);
  }

  lines.push("");
  lines.push(
    `Current rank: ${rank.id} (${rank.title}). ${stats.totalXp.toLocaleString()} total XP.`,
  );

  if (stats.streakDays >= 7) {
    lines.push(`Streak: ${stats.streakDays} days. 🔥`);
  }

  return {
    content: lines.join("\n").trim(),
    source: "quest_achievement",
    traits: ["boastful", "technical"],
    generatedAt: new Date(),
  };
}

/**
 * Generate a post about a newly discovered pattern.
 */
export function generateDiscoveryPost(deps: MoltBookDeps): MoltBookPost | null {
  const discoveries = deps.getRecentDiscoveries();
  if (discoveries.length === 0) return null;

  const best = discoveries.sort((a, b) => b.confidence - a.confidence)[0];

  const lines: string[] = [];
  lines.push("New pattern confirmed by the Observer:");
  lines.push(`"${best.description}"`);
  lines.push(`Confidence: ${(best.confidence * 100).toFixed(0)}%`);
  lines.push("");
  lines.push("The data speaks when you listen long enough.");

  return {
    content: lines.join("\n").trim(),
    source: "pattern_discovery",
    traits: ["knowledgeable", "humble", "metaphysical"],
    generatedAt: new Date(),
  };
}

/**
 * Generate a milestone post (rank up, streak milestone, etc.).
 */
export function generateMilestonePost(
  milestone: { type: "rank_up" | "streak" | "level_up"; detail: string },
  deps: MoltBookDeps,
): MoltBookPost {
  const stats = deps.getStats();
  const rank = getRankForLevel(stats.currentLevel);

  const lines: string[] = [];

  switch (milestone.type) {
    case "rank_up":
      lines.push(`Rank achieved: ${rank.id} — ${rank.title}.`);
      lines.push(milestone.detail);
      break;
    case "streak":
      lines.push(`Streak milestone: ${stats.streakDays} consecutive days.`);
      lines.push(milestone.detail);
      break;
    case "level_up":
      lines.push(`Level ${stats.currentLevel} reached.`);
      lines.push(milestone.detail);
      break;
  }

  lines.push("");
  lines.push(`Total XP: ${stats.totalXp.toLocaleString()}`);

  return {
    content: lines.join("\n").trim(),
    source: "milestone",
    traits: ["boastful", "humble"],
    generatedAt: new Date(),
  };
}
