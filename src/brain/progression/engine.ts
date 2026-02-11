/**
 * Progression Engine
 *
 * Manages player stats, XP, levels, ranks, quests, and sync rate.
 * Self-contained logic module — no database dependency.
 * Storage is handled by whoever calls this engine.
 *
 * Formulas faithfully ported from GUTTERS:
 * - XP threshold: level × 1000 × 1.5^(level - 1)
 * - Sync rate WMA: (daily × 0.4) + (prev × 0.6)
 * - Streak: +1 on activity, reset on miss
 * - Rank: level-based tiers (E through SS)
 */

import type {
  PlayerStats,
  Quest,
  QuestDifficulty,
  QuestStatus,
  QuestType,
  QuestSource,
  RankId,
  SyncHistoryEntry,
} from "./types.js";
import {
  calculateQuestXP,
  calculateSyncRate,
  getRankForLevel,
  updateStreak,
  xpThresholdForLevel,
  xpToNextLevel,
} from "./types.js";

// ─── XP Gain Result ────────────────────────────────────────────

export interface XPGainResult {
  xpAdded: number;
  totalXp: number;
  previousLevel: number;
  newLevel: number;
  previousRank: RankId;
  newRank: RankId;
  leveledUp: boolean;
  rankChanged: boolean;
}

// ─── Quest Completion Result ───────────────────────────────────

export interface QuestCompletionResult {
  quest: Quest;
  xpGain: XPGainResult;
  newSyncRate: number;
  newStreak: number;
}

// ─── Daily Reset Result ────────────────────────────────────────

export interface DailyResetResult {
  date: string;
  completedQuests: number;
  totalQuests: number;
  newSyncRate: number;
  newStreak: number;
  expiredQuests: string[];
}

// ─── Progression Engine ────────────────────────────────────────

export class ProgressionEngine {
  private stats: PlayerStats;
  private quests: Map<string, Quest> = new Map();

  constructor(stats?: PlayerStats) {
    this.stats = stats ?? createDefaultStats();
  }

  // ─── XP & Leveling ──────────────────────────────────────────

  /**
   * Add XP and process level-ups.
   * GUTTERS formula: while xp >= level × 1000 × 1.5^(level - 1), level++
   */
  addXP(amount: number, reason?: string): XPGainResult {
    const previousLevel = this.stats.currentLevel;
    const previousRank = this.stats.currentRank;

    this.stats.totalXp += amount;

    // Level-up loop (GUTTERS §engine.py)
    while (this.stats.totalXp >= xpThresholdForLevel(this.stats.currentLevel)) {
      this.stats.currentLevel++;
    }

    // Update rank
    const newRankDef = getRankForLevel(this.stats.currentLevel);
    this.stats.currentRank = newRankDef.id;

    return {
      xpAdded: amount,
      totalXp: this.stats.totalXp,
      previousLevel,
      newLevel: this.stats.currentLevel,
      previousRank,
      newRank: this.stats.currentRank,
      leveledUp: this.stats.currentLevel > previousLevel,
      rankChanged: this.stats.currentRank !== previousRank,
    };
  }

  /**
   * Get XP needed to reach the next level.
   */
  getXPToNextLevel(): number {
    return xpToNextLevel(this.stats.totalXp, this.stats.currentLevel);
  }

  /**
   * Get level progress as a percentage (0-1).
   */
  getLevelProgress(): number {
    const threshold = xpThresholdForLevel(this.stats.currentLevel);
    const prevThreshold =
      this.stats.currentLevel > 1 ? xpThresholdForLevel(this.stats.currentLevel - 1) : 0;
    const range = threshold - prevThreshold;
    if (range <= 0) return 0;
    return Math.min(1, (this.stats.totalXp - prevThreshold) / range);
  }

  // ─── Quest Management ───────────────────────────────────────

  /**
   * Add a quest to the engine.
   */
  addQuest(quest: Quest): void {
    this.quests.set(quest.id, quest);
  }

  /**
   * Create and add a quest.
   */
  createQuest(params: {
    title: string;
    description: string;
    questType: QuestType;
    difficulty: QuestDifficulty;
    source?: QuestSource;
    cosmicAlignment?: number;
    insightId?: string;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  }): Quest {
    const quest: Quest = {
      id: generateId(),
      title: params.title,
      description: params.description,
      questType: params.questType,
      difficulty: params.difficulty,
      xpReward: calculateQuestXP(params.difficulty, {
        insightLinked: !!params.insightId,
      }),
      status: "active",
      cosmicAlignment: params.cosmicAlignment ?? null,
      insightId: params.insightId ?? null,
      source: params.source ?? "agent",
      assignedAt: new Date(),
      completedAt: null,
      expiresAt: params.expiresAt ?? null,
      metadata: params.metadata ?? {},
    };

    this.quests.set(quest.id, quest);
    return quest;
  }

  /**
   * Complete a quest. Awards XP and updates sync rate.
   */
  completeQuest(questId: string): QuestCompletionResult | null {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== "active") return null;

    quest.status = "completed";
    quest.completedAt = new Date();

    // Award XP
    const xpGain = this.addXP(quest.xpReward);

    // Update sync rate with this completion
    const activeCount = this.getActiveQuests().length;
    const completedToday = this.getCompletedToday().length;
    const totalToday = activeCount + completedToday;
    const newSyncRate = calculateSyncRate(completedToday, totalToday, this.stats.syncRate);
    this.stats.syncRate = Math.round(newSyncRate * 1000) / 1000;

    // Update streak
    this.stats.streakDays = updateStreak(this.stats.streakDays, true);
    this.stats.lastActive = new Date().toISOString().split("T")[0];

    return {
      quest,
      xpGain,
      newSyncRate: this.stats.syncRate,
      newStreak: this.stats.streakDays,
    };
  }

  /**
   * Abandon a quest (no XP).
   */
  abandonQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest || quest.status !== "active") return false;
    quest.status = "abandoned";
    return true;
  }

  /**
   * Expire quests that have passed their expiration date.
   */
  expireQuests(now?: Date): string[] {
    const currentTime = now ?? new Date();
    const expired: string[] = [];

    for (const [id, quest] of this.quests) {
      if (quest.status === "active" && quest.expiresAt && quest.expiresAt <= currentTime) {
        quest.status = "expired";
        expired.push(id);
      }
    }

    return expired;
  }

  // ─── Daily Reset (GUTTERS §scheduler.py L260-273) ───────────

  /**
   * Process end-of-day: sync rate update, streak, expire quests.
   */
  dailyReset(date?: Date): DailyResetResult {
    const today = date ?? new Date();
    const dateStr = today.toISOString().split("T")[0];

    const completedToday = this.getCompletedToday(today).length;
    const totalToday = this.getTodayQuests(today).length;

    // Expire overdue quests
    const expiredQuestIds = this.expireQuests(today);

    // Sync rate WMA (GUTTERS formula)
    const newSyncRate = calculateSyncRate(completedToday, totalToday, this.stats.syncRate);
    this.stats.syncRate = Math.round(newSyncRate * 1000) / 1000;

    // Sync history (keep last 7)
    this.stats.syncHistory.push({ date: dateStr, score: newSyncRate });
    if (this.stats.syncHistory.length > 7) {
      this.stats.syncHistory = this.stats.syncHistory.slice(-7);
    }

    // Streak
    const hadActivity = completedToday > 0;
    this.stats.streakDays = updateStreak(this.stats.streakDays, hadActivity);

    if (hadActivity) {
      this.stats.lastActive = dateStr;
    }

    return {
      date: dateStr,
      completedQuests: completedToday,
      totalQuests: totalToday,
      newSyncRate: this.stats.syncRate,
      newStreak: this.stats.streakDays,
      expiredQuests: expiredQuestIds,
    };
  }

  // ─── Queries ─────────────────────────────────────────────────

  getStats(): PlayerStats {
    return { ...this.stats };
  }

  getActiveQuests(): Quest[] {
    return [...this.quests.values()].filter((q) => q.status === "active");
  }

  getCompletedQuests(): Quest[] {
    return [...this.quests.values()].filter((q) => q.status === "completed");
  }

  getQuest(id: string): Quest | undefined {
    return this.quests.get(id);
  }

  getAllQuests(): Quest[] {
    return [...this.quests.values()];
  }

  /**
   * Get quests completed today.
   */
  private getCompletedToday(now?: Date): Quest[] {
    const today = (now ?? new Date()).toISOString().split("T")[0];
    return [...this.quests.values()].filter(
      (q) =>
        q.status === "completed" &&
        q.completedAt &&
        q.completedAt.toISOString().split("T")[0] === today,
    );
  }

  /**
   * Get all quests assigned today (active + completed + expired today).
   */
  private getTodayQuests(now?: Date): Quest[] {
    const today = (now ?? new Date()).toISOString().split("T")[0];
    return [...this.quests.values()].filter(
      (q) => q.assignedAt.toISOString().split("T")[0] === today,
    );
  }

  // ─── Render for Synthesis ────────────────────────────────────

  /**
   * Render progression state for system prompt injection.
   */
  renderForSynthesis(): string {
    const rank = getRankForLevel(this.stats.currentLevel);
    const xpNeeded = this.getXPToNextLevel();
    const activeQuests = this.getActiveQuests();

    const parts: string[] = [];

    parts.push(
      `Rank: ${rank.id} (${rank.title}) | Level ${this.stats.currentLevel} | ` +
        `XP: ${this.stats.totalXp.toLocaleString()} | ` +
        `Next: ${xpNeeded.toLocaleString()} XP | ` +
        `Sync: ${(this.stats.syncRate * 100).toFixed(0)}% | ` +
        `Streak: ${this.stats.streakDays} days`,
    );

    if (activeQuests.length > 0) {
      parts.push("Active quests:");
      for (const q of activeQuests.slice(0, 5)) {
        const alignment =
          q.cosmicAlignment !== null
            ? ` (alignment: ${(q.cosmicAlignment * 100).toFixed(0)}%)`
            : "";
        parts.push(`  [${q.questType.toUpperCase()}] ${q.title} — ${q.xpReward} XP${alignment}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Load quests (for restoring state).
   */
  loadQuests(quests: Quest[]): void {
    for (const q of quests) {
      this.quests.set(q.id, q);
    }
  }
}

// ─── Factory ───────────────────────────────────────────────────

export function createDefaultStats(operatorId = "default"): PlayerStats {
  return {
    id: generateId(),
    operatorId,
    totalXp: 0,
    currentLevel: 1,
    currentRank: "E",
    syncRate: 0,
    streakDays: 0,
    syncHistory: [],
    lastActive: null,
  };
}

// ─── ID Generator ──────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
