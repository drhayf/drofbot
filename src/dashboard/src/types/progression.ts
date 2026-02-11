/**
 * Progression — Dashboard Type Definitions
 *
 * Derived from brain/progression/types.ts, adapted for the dashboard
 * API response contract.
 */

export type RankId = "E" | "D" | "C" | "B" | "A" | "S" | "SS";

export interface PlayerStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  rank: RankId;
  streakDays: number;
  syncRate: number;
  levelProgress: number;
  // Extended stats — optional, not always returned by API
  bestStreak?: number;
  totalEntries?: number;
  totalHypothesesConfirmed?: number;
  totalPatternsDetected?: number;
  xpHistory?: Array<{ date: string; xp: number }>;
  achievements?: Array<{ title: string; date: string; type: string }>;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  status: string;
  xpReward: number;
  createdAt: string;
  completedAt?: string;
}

export const RANK_TITLES: Record<RankId, string> = {
  E: "Awakening",
  D: "Seeking",
  C: "Aligning",
  B: "Integrating",
  A: "Mastering",
  S: "Transcending",
  SS: "Sovereign",
};
