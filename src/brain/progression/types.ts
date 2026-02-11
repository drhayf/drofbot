/**
 * Progression System — Types
 *
 * Ranks, quests, XP, sync rate — the gamification layer.
 * All constants and formulas ported faithfully from GUTTERS.
 */

// ─── Rank System (GUTTERS §progression.py L46-56) ──────────────

export type RankId = "E" | "D" | "C" | "B" | "A" | "S" | "SS";

export interface RankDefinition {
  id: RankId;
  minLevel: number;
  title: string;
}

/**
 * Rank thresholds from GUTTERS.
 * Determined by level tiers, not raw XP.
 */
export const RANKS: RankDefinition[] = [
  { id: "SS", minLevel: 51, title: "Sovereign" },
  { id: "S", minLevel: 41, title: "Transcending" },
  { id: "A", minLevel: 31, title: "Mastering" },
  { id: "B", minLevel: 21, title: "Integrating" },
  { id: "C", minLevel: 11, title: "Aligning" },
  { id: "D", minLevel: 6, title: "Seeking" },
  { id: "E", minLevel: 1, title: "Awakening" },
];

/**
 * Get rank for a given level.
 * Walks the RANKS table from highest to lowest.
 */
export function getRankForLevel(level: number): RankDefinition {
  for (const rank of RANKS) {
    if (level >= rank.minLevel) return rank;
  }
  return RANKS[RANKS.length - 1]; // E is fallback
}

// ─── XP System (GUTTERS §progression.py L59-62) ────────────────

/**
 * XP threshold to reach the next level.
 * Formula: level × 1000 × 1.5^(level - 1)
 */
export function xpThresholdForLevel(level: number): number {
  return Math.floor(level * 1000 * Math.pow(1.5, level - 1));
}

/**
 * XP remaining to reach the next level.
 */
export function xpToNextLevel(currentXp: number, currentLevel: number): number {
  return Math.max(0, xpThresholdForLevel(currentLevel) - currentXp);
}

// ─── Quest Difficulty & XP Rewards (GUTTERS §manager.py L27-32) ─

export type QuestDifficulty = "easy" | "medium" | "hard" | "elite";
export type QuestType = "daily" | "cosmic" | "growth" | "personal" | "weekly";
export type QuestStatus = "active" | "completed" | "expired" | "abandoned";
export type QuestSource = "agent" | "user";

/**
 * Base XP rewards by difficulty (from GUTTERS XP_MAP).
 */
export const XP_REWARDS: Record<QuestDifficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 50,
  elite: 100,
};

/**
 * XP multiplier for insight-linked quests (GUTTERS §manager.py L145).
 */
export const INSIGHT_LINKED_MULTIPLIER = 1.5;

/**
 * Calculate the actual XP reward for a quest.
 */
export function calculateQuestXP(
  difficulty: QuestDifficulty,
  options?: { insightLinked?: boolean },
): number {
  let xp = XP_REWARDS[difficulty];
  if (options?.insightLinked) {
    xp = Math.floor(xp * INSIGHT_LINKED_MULTIPLIER);
  }
  return xp;
}

// ─── Sync Rate (GUTTERS §scheduler.py L260-262) ────────────────

/**
 * Sync rate weights for weighted moving average.
 * New day: 40%, previous: 60%.
 */
export const SYNC_WEIGHT_NEW = 0.4;
export const SYNC_WEIGHT_PREV = 0.6;

export interface SyncHistoryEntry {
  date: string; // ISO date string YYYY-MM-DD
  score: number; // 0-1
}

/**
 * Calculate new sync rate.
 * Formula: (dailySync × 0.4) + (previousSyncRate × 0.6)
 * Where dailySync = completed / total (or 1.0 if no quests).
 */
export function calculateSyncRate(
  completedQuests: number,
  totalQuests: number,
  previousSyncRate: number,
): number {
  const dailySync = totalQuests > 0 ? completedQuests / totalQuests : 1.0;
  return dailySync * SYNC_WEIGHT_NEW + previousSyncRate * SYNC_WEIGHT_PREV;
}

// ─── Quest Interface ───────────────────────────────────────────

export interface Quest {
  id: string;
  title: string;
  description: string;
  questType: QuestType;
  difficulty: QuestDifficulty;
  xpReward: number;
  status: QuestStatus;
  cosmicAlignment: number | null;
  insightId: string | null;
  source: QuestSource;
  assignedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
}

// ─── Player Stats Interface ────────────────────────────────────

export interface PlayerStats {
  id: string;
  operatorId: string;
  totalXp: number;
  currentLevel: number;
  currentRank: RankId;
  syncRate: number;
  streakDays: number;
  syncHistory: SyncHistoryEntry[];
  lastActive: string | null; // ISO date
}

// ─── Streak Logic (GUTTERS §scheduler.py L269-273) ─────────────

/**
 * Update streak based on daily activity.
 */
export function updateStreak(currentStreak: number, hadActivity: boolean): number {
  return hadActivity ? currentStreak + 1 : 0;
}
