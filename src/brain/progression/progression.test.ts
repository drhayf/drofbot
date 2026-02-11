/**
 * Progression Module — Comprehensive Tests
 *
 * Tests for:
 * 1. Type-level functions (ranks, XP thresholds, sync rate, streaks)
 * 2. Progression Engine (XP, leveling, quest completion, daily reset)
 * 3. Quest Generator (cosmic, growth, daily quests)
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { CosmicState, HarmonicSynthesis } from "../council/types.js";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import { Element, ResonanceType } from "../council/types.js";
import { HypothesisStatus, HypothesisType } from "../intelligence/hypothesis.js";
import { ProgressionEngine, createDefaultStats } from "./engine.js";
import {
  generateCosmicQuests,
  generateGrowthQuests,
  generateDailyQuests,
  questFromTemplate,
} from "./quest-generator.js";
import {
  RANKS,
  XP_REWARDS,
  INSIGHT_LINKED_MULTIPLIER,
  getRankForLevel,
  xpThresholdForLevel,
  xpToNextLevel,
  calculateQuestXP,
  calculateSyncRate,
  updateStreak,
  SYNC_WEIGHT_NEW,
  SYNC_WEIGHT_PREV,
} from "./types.js";

// ─── Test Helpers ──────────────────────────────────────────────

function makeCosmicState(system: string, summary: string): CosmicState {
  return {
    system,
    timestamp: new Date("2025-06-01T12:00:00Z"),
    primary: {},
    summary,
    metrics: {},
  };
}

function makeHarmonic(resonance = 0.82): HarmonicSynthesis {
  return {
    overallResonance: resonance,
    resonanceType: ResonanceType.HARMONIC,
    pairwise: [],
    dominantElements: [Element.FIRE],
    elementalBalance: {
      [Element.FIRE]: 0.5,
      [Element.WATER]: 0.1,
      [Element.AIR]: 0.2,
      [Element.EARTH]: 0.1,
      [Element.ETHER]: 0.1,
    },
    guidance: "Strong alignment.",
  };
}

function makeHypothesis(overrides?: Partial<Hypothesis>): Hypothesis {
  return {
    id: `hyp-${Math.random().toString(36).slice(2, 8)}`,
    statement: "Energy correlates with solar activity",
    type: HypothesisType.COSMIC_CORRELATION,
    category: "cosmic",
    status: HypothesisStatus.FORMING,
    confidence: 0.35,
    evidenceRecords: [
      {
        id: "e1",
        evidenceType: "OBSERVER_CORRELATION" as any,
        baseWeight: 0.4,
        effectiveWeight: 0.3,
        source: "observer",
        createdAt: new Date(),
        recencyMultiplier: 1,
        positionFactor: 1,
        sourceReliability: 0.7,
      },
    ],
    confidenceHistory: [{ confidence: 0.35, timestamp: new Date() }],
    firstDetectedAt: new Date(),
    lastEvidenceAt: new Date(),
    periodEvidenceCount: 0,
    gateEvidenceCount: 0,
    sourcePatterns: ["solar-correlation"],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Progression System", () => {
  // ─── Rank System ───────────────────────────────────────────

  describe("Rank System", () => {
    it("has 7 ranks from E to SS", () => {
      expect(RANKS).toHaveLength(7);
      expect(RANKS[0].id).toBe("SS");
      expect(RANKS[RANKS.length - 1].id).toBe("E");
    });

    it("getRankForLevel returns E for level 1", () => {
      expect(getRankForLevel(1).id).toBe("E");
      expect(getRankForLevel(1).title).toBe("Awakening");
    });

    it("getRankForLevel returns D for level 6", () => {
      expect(getRankForLevel(6).id).toBe("D");
    });

    it("getRankForLevel returns C for level 11", () => {
      expect(getRankForLevel(11).id).toBe("C");
    });

    it("getRankForLevel returns B for level 21", () => {
      expect(getRankForLevel(21).id).toBe("B");
    });

    it("getRankForLevel returns A for level 31", () => {
      expect(getRankForLevel(31).id).toBe("A");
    });

    it("getRankForLevel returns S for level 41", () => {
      expect(getRankForLevel(41).id).toBe("S");
    });

    it("getRankForLevel returns SS for level 51+", () => {
      expect(getRankForLevel(51).id).toBe("SS");
      expect(getRankForLevel(100).id).toBe("SS");
    });

    it("RANKS have titles matching GUTTERS spec", () => {
      const titles = RANKS.map((r) => r.title);
      expect(titles).toContain("Awakening");
      expect(titles).toContain("Seeking");
      expect(titles).toContain("Aligning");
      expect(titles).toContain("Integrating");
      expect(titles).toContain("Mastering");
      expect(titles).toContain("Transcending");
      expect(titles).toContain("Sovereign");
    });
  });

  // ─── XP Thresholds ────────────────────────────────────────

  describe("XP Thresholds", () => {
    it("level 1 threshold = 1000", () => {
      expect(xpThresholdForLevel(1)).toBe(1000);
    });

    it("level 2 threshold = 3000", () => {
      expect(xpThresholdForLevel(2)).toBe(3000);
    });

    it("thresholds increase superlinearly", () => {
      const t1 = xpThresholdForLevel(1);
      const t5 = xpThresholdForLevel(5);
      const t10 = xpThresholdForLevel(10);
      expect(t5).toBeGreaterThan(t1 * 5);
      expect(t10).toBeGreaterThan(t5 * 2);
    });

    it("xpToNextLevel returns correct remainder", () => {
      expect(xpToNextLevel(0, 1)).toBe(1000);
      expect(xpToNextLevel(500, 1)).toBe(500);
      expect(xpToNextLevel(1000, 1)).toBe(0);
    });

    it("xpToNextLevel floors at 0", () => {
      expect(xpToNextLevel(5000, 1)).toBe(0);
    });
  });

  // ─── Quest XP Rewards ─────────────────────────────────────

  describe("Quest XP Rewards", () => {
    it("has correct base rewards from GUTTERS XP_MAP", () => {
      expect(XP_REWARDS.easy).toBe(10);
      expect(XP_REWARDS.medium).toBe(25);
      expect(XP_REWARDS.hard).toBe(50);
      expect(XP_REWARDS.elite).toBe(100);
    });

    it("calculateQuestXP returns base for normal quest", () => {
      expect(calculateQuestXP("medium")).toBe(25);
    });

    it("calculateQuestXP applies 1.5x for insight-linked", () => {
      expect(calculateQuestXP("medium", { insightLinked: true })).toBe(37);
      expect(calculateQuestXP("hard", { insightLinked: true })).toBe(75);
    });

    it("insight multiplier matches GUTTERS constant", () => {
      expect(INSIGHT_LINKED_MULTIPLIER).toBe(1.5);
    });
  });

  // ─── Sync Rate ─────────────────────────────────────────────

  describe("Sync Rate", () => {
    it("uses GUTTERS WMA weights (0.4 new, 0.6 prev)", () => {
      expect(SYNC_WEIGHT_NEW).toBe(0.4);
      expect(SYNC_WEIGHT_PREV).toBe(0.6);
    });

    it("calculateSyncRate with all completed = moves toward 1.0", () => {
      const rate = calculateSyncRate(3, 3, 0.5);
      // (1.0 × 0.4) + (0.5 × 0.6) = 0.4 + 0.3 = 0.7
      expect(rate).toBeCloseTo(0.7, 5);
    });

    it("calculateSyncRate with none completed = moves toward 0", () => {
      const rate = calculateSyncRate(0, 3, 0.5);
      // (0.0 × 0.4) + (0.5 × 0.6) = 0 + 0.3 = 0.3
      expect(rate).toBeCloseTo(0.3, 5);
    });

    it("calculateSyncRate with no quests today defaults to 1.0", () => {
      const rate = calculateSyncRate(0, 0, 0.5);
      // (1.0 × 0.4) + (0.5 × 0.6) = 0.7
      expect(rate).toBeCloseTo(0.7, 5);
    });

    it("calculateSyncRate with partial completion", () => {
      const rate = calculateSyncRate(1, 3, 0.5);
      // (0.333 × 0.4) + (0.5 × 0.6) ≈ 0.133 + 0.3 = 0.433
      expect(rate).toBeCloseTo(0.433, 2);
    });
  });

  // ─── Streak ────────────────────────────────────────────────

  describe("Streak", () => {
    it("increments on activity", () => {
      expect(updateStreak(5, true)).toBe(6);
    });

    it("resets on miss", () => {
      expect(updateStreak(5, false)).toBe(0);
    });

    it("starts from 0", () => {
      expect(updateStreak(0, true)).toBe(1);
    });
  });

  // ─── Progression Engine ────────────────────────────────────

  describe("ProgressionEngine", () => {
    let engine: ProgressionEngine;

    beforeEach(() => {
      engine = new ProgressionEngine();
    });

    describe("initial state", () => {
      it("starts at level 1, rank E, 0 XP", () => {
        const stats = engine.getStats();
        expect(stats.currentLevel).toBe(1);
        expect(stats.currentRank).toBe("E");
        expect(stats.totalXp).toBe(0);
        expect(stats.syncRate).toBe(0);
        expect(stats.streakDays).toBe(0);
      });
    });

    describe("addXP", () => {
      it("adds XP without level-up", () => {
        const result = engine.addXP(500);
        expect(result.xpAdded).toBe(500);
        expect(result.totalXp).toBe(500);
        expect(result.leveledUp).toBe(false);
        expect(result.newLevel).toBe(1);
      });

      it("levels up when threshold reached", () => {
        const result = engine.addXP(1000);
        expect(result.leveledUp).toBe(true);
        expect(result.newLevel).toBe(2);
        expect(result.previousLevel).toBe(1);
      });

      it("handles multiple level-ups in one gain", () => {
        const result = engine.addXP(5000);
        expect(result.newLevel).toBeGreaterThan(2);
        expect(result.leveledUp).toBe(true);
      });

      it("updates rank on level change", () => {
        // Level 6+ = rank D
        engine.addXP(100000); // Enough for level 6+
        const stats = engine.getStats();
        expect(stats.currentRank).not.toBe("E");
      });

      it("reports rank changes", () => {
        const result = engine.addXP(100000);
        expect(result.rankChanged).toBe(true);
        expect(result.previousRank).toBe("E");
        expect(result.newRank).not.toBe("E");
      });
    });

    describe("getXPToNextLevel", () => {
      it("returns correct remaining XP", () => {
        expect(engine.getXPToNextLevel()).toBe(1000);
        engine.addXP(300);
        expect(engine.getXPToNextLevel()).toBe(700);
      });
    });

    describe("getLevelProgress", () => {
      it("returns 0 at start of level", () => {
        expect(engine.getLevelProgress()).toBe(0);
      });

      it("returns progress within level", () => {
        engine.addXP(500);
        expect(engine.getLevelProgress()).toBeCloseTo(0.5, 1);
      });
    });

    describe("quest management", () => {
      it("creates a quest with correct XP", () => {
        const quest = engine.createQuest({
          title: "Test quest",
          description: "Do the thing",
          questType: "daily",
          difficulty: "medium",
        });
        expect(quest.xpReward).toBe(25);
        expect(quest.status).toBe("active");
        expect(engine.getActiveQuests()).toHaveLength(1);
      });

      it("creates insight-linked quest with bonus XP", () => {
        const quest = engine.createQuest({
          title: "Insight quest",
          description: "Observe yourself",
          questType: "growth",
          difficulty: "medium",
          insightId: "hyp-123",
        });
        expect(quest.xpReward).toBe(37); // 25 × 1.5 = 37
        expect(quest.insightId).toBe("hyp-123");
      });

      it("completes a quest and awards XP", () => {
        const quest = engine.createQuest({
          title: "Easy quest",
          description: "Simple task",
          questType: "daily",
          difficulty: "easy",
        });

        const result = engine.completeQuest(quest.id);
        expect(result).not.toBeNull();
        expect(result!.xpGain.xpAdded).toBe(10);
        expect(result!.quest.status).toBe("completed");
      });

      it("cannot complete an already completed quest", () => {
        const quest = engine.createQuest({
          title: "Once",
          description: "Once only",
          questType: "daily",
          difficulty: "easy",
        });
        engine.completeQuest(quest.id);
        const result = engine.completeQuest(quest.id);
        expect(result).toBeNull();
      });

      it("returns null for unknown quest ID", () => {
        expect(engine.completeQuest("nonexistent")).toBeNull();
      });

      it("abandons a quest", () => {
        const quest = engine.createQuest({
          title: "Abandon me",
          description: "I'll be abandoned",
          questType: "daily",
          difficulty: "easy",
        });
        const success = engine.abandonQuest(quest.id);
        expect(success).toBe(true);
        expect(engine.getQuest(quest.id)!.status).toBe("abandoned");
        expect(engine.getActiveQuests()).toHaveLength(0);
      });

      it("cannot abandon non-active quest", () => {
        expect(engine.abandonQuest("nonexistent")).toBe(false);
      });

      it("expires overdue quests", () => {
        const past = new Date("2020-01-01T00:00:00Z");
        const quest = engine.createQuest({
          title: "Expired",
          description: "This expired",
          questType: "daily",
          difficulty: "easy",
          expiresAt: past,
        });
        const expired = engine.expireQuests();
        expect(expired).toContain(quest.id);
        expect(engine.getQuest(quest.id)!.status).toBe("expired");
      });
    });

    describe("dailyReset", () => {
      it("updates sync rate and streak", () => {
        engine.createQuest({
          title: "Today",
          description: "Today's quest",
          questType: "daily",
          difficulty: "easy",
        });
        // Don't complete → streak should reset

        const result = engine.dailyReset();
        expect(result.completedQuests).toBe(0);
        expect(result.newStreak).toBe(0);
        expect(result.newSyncRate).toBeDefined();
      });

      it("adds to sync history (max 7)", () => {
        for (let i = 0; i < 10; i++) {
          engine.dailyReset(new Date(`2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
        }
        expect(engine.getStats().syncHistory).toHaveLength(7);
      });
    });

    describe("renderForSynthesis", () => {
      it("renders rank, level, XP, sync rate", () => {
        const output = engine.renderForSynthesis();
        expect(output).toContain("Rank: E");
        expect(output).toContain("Awakening");
        expect(output).toContain("Level 1");
        expect(output).toContain("XP:");
        expect(output).toContain("Sync:");
        expect(output).toContain("Streak:");
      });

      it("includes active quests", () => {
        engine.createQuest({
          title: "Test quest",
          description: "Do it",
          questType: "cosmic",
          difficulty: "hard",
        });
        const output = engine.renderForSynthesis();
        expect(output).toContain("[COSMIC]");
        expect(output).toContain("Test quest");
        expect(output).toContain("50 XP");
      });
    });

    describe("loadQuests", () => {
      it("restores quest state", () => {
        const quest = engine.createQuest({
          title: "Saved",
          description: "Saved quest",
          questType: "daily",
          difficulty: "easy",
        });

        const engine2 = new ProgressionEngine();
        engine2.loadQuests([quest]);
        expect(engine2.getActiveQuests()).toHaveLength(1);
        expect(engine2.getQuest(quest.id)!.title).toBe("Saved");
      });
    });
  });

  // ─── createDefaultStats ────────────────────────────────────

  describe("createDefaultStats", () => {
    it("creates stats with defaults", () => {
      const stats = createDefaultStats();
      expect(stats.totalXp).toBe(0);
      expect(stats.currentLevel).toBe(1);
      expect(stats.currentRank).toBe("E");
      expect(stats.syncRate).toBe(0);
      expect(stats.streakDays).toBe(0);
      expect(stats.operatorId).toBe("default");
    });

    it("accepts custom operator ID", () => {
      const stats = createDefaultStats("custom-op");
      expect(stats.operatorId).toBe("custom-op");
    });
  });

  // ─── Quest Generator ──────────────────────────────────────

  describe("Quest Generator", () => {
    describe("generateCosmicQuests", () => {
      it("generates Mercury period quest from cardology", () => {
        const states = new Map<string, CosmicState>();
        states.set("cardology", makeCosmicState("cardology", "Mercury period, 7 of Clubs."));
        const quests = generateCosmicQuests(states, null);
        expect(quests.length).toBeGreaterThan(0);
        expect(quests[0].questType).toBe("cosmic");
        expect(quests[0].title.toLowerCase()).toContain("focus");
      });

      it("generates mastery quest from iching gate", () => {
        const states = new Map<string, CosmicState>();
        states.set("iching", makeCosmicState("iching", "Gate 48, depth and mastery"));
        const quests = generateCosmicQuests(states, null);
        expect(quests.length).toBeGreaterThan(0);
        expect(quests[0].title.toLowerCase()).toContain("mastery");
      });

      it("generates solar storm quest for high Kp", () => {
        const states = new Map<string, CosmicState>();
        states.set("solar", makeCosmicState("solar", "Kp 6, geomagnetic storm"));
        const quests = generateCosmicQuests(states, null);
        expect(quests.length).toBeGreaterThan(0);
        expect(quests[0].title.toLowerCase()).toContain("solar");
      });

      it("applies harmonic alignment to quests", () => {
        const states = new Map<string, CosmicState>();
        states.set("cardology", makeCosmicState("cardology", "Mercury period active"));
        const quests = generateCosmicQuests(states, makeHarmonic(0.85));
        expect(quests[0].cosmicAlignment).toBe(0.85);
      });

      it("returns empty for unremarkable cosmic state", () => {
        const states = new Map<string, CosmicState>();
        states.set("lunar", makeCosmicState("lunar", "Waning crescent in Pisces"));
        const quests = generateCosmicQuests(states, null);
        expect(quests).toHaveLength(0);
      });
    });

    describe("generateGrowthQuests", () => {
      it("generates quests for low-confidence hypotheses", () => {
        const hyps = [makeHypothesis({ confidence: 0.35 })];
        const quests = generateGrowthQuests(hyps);
        expect(quests.length).toBeGreaterThan(0);
        expect(quests[0].questType).toBe("growth");
        expect(quests[0].insightId).toBe(hyps[0].id);
      });

      it("skips confirmed hypotheses", () => {
        const hyps = [makeHypothesis({ status: HypothesisStatus.CONFIRMED, confidence: 0.92 })];
        const quests = generateGrowthQuests(hyps);
        expect(quests).toHaveLength(0);
      });

      it("skips rejected hypotheses", () => {
        const hyps = [makeHypothesis({ status: HypothesisStatus.REJECTED, confidence: 0.1 })];
        const quests = generateGrowthQuests(hyps);
        expect(quests).toHaveLength(0);
      });

      it("limits to 3 growth quests", () => {
        const hyps = Array.from({ length: 10 }, () => makeHypothesis({ confidence: 0.3 }));
        const quests = generateGrowthQuests(hyps);
        expect(quests.length).toBeLessThanOrEqual(3);
      });

      it("skips hypotheses with enough evidence", () => {
        const hyps = [
          makeHypothesis({
            confidence: 0.35,
            evidenceRecords: Array.from({ length: 6 }, () => ({
              id: "e",
              evidenceType: "OBSERVER_CORRELATION" as any,
              baseWeight: 0.4,
              effectiveWeight: 0.3,
              source: "observer",
              createdAt: new Date(),
              recencyMultiplier: 1,
              positionFactor: 1,
              sourceReliability: 0.7,
            })),
          }),
        ];
        const quests = generateGrowthQuests(hyps);
        expect(quests).toHaveLength(0);
      });
    });

    describe("generateDailyQuests", () => {
      it("returns morning and evening quests", () => {
        const quests = generateDailyQuests();
        expect(quests).toHaveLength(2);
        expect(quests[0].questType).toBe("daily");
        expect(quests[1].questType).toBe("daily");
        expect(quests[0].difficulty).toBe("easy");
      });
    });

    describe("questFromTemplate", () => {
      it("converts template to Quest with ID and dates", () => {
        const template = generateDailyQuests()[0];
        const quest = questFromTemplate(template);
        expect(quest.id).toBeTruthy();
        expect(quest.status).toBe("active");
        expect(quest.assignedAt).toBeInstanceOf(Date);
        expect(quest.xpReward).toBe(10); // easy = 10
      });

      it("sets expiration for daily quests", () => {
        const template = generateDailyQuests()[0];
        const quest = questFromTemplate(template);
        expect(quest.expiresAt).not.toBeNull();
      });

      it("applies insight XP multiplier", () => {
        const template = generateGrowthQuests([makeHypothesis()])[0];
        const quest = questFromTemplate(template);
        expect(quest.xpReward).toBe(15); // easy(10) × 1.5 = 15
        expect(quest.insightId).toBeTruthy();
      });
    });
  });
});
