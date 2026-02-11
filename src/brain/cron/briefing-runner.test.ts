/**
 * Briefing Runner — Comprehensive Tests
 *
 * Tests for:
 * 1. Morning Briefing generation
 * 2. Midday Check-in generation
 * 3. Evening Reflection generation
 * 4. Cosmic Alert generation
 */

import { describe, it, expect } from "vitest";
import type { CosmicState, HarmonicSynthesis } from "../council/types.js";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import type { PlayerStats, Quest } from "../progression/types.js";
import { Element, ResonanceType } from "../council/types.js";
import { HypothesisStatus, HypothesisType } from "../intelligence/hypothesis.js";
import {
  generateMorningBriefing,
  generateMiddayCheckin,
  generateEveningReflection,
  generateCosmicAlert,
  createBriefingJobDefs,
  type BriefingDeps,
} from "./briefing-runner.js";

// ─── Test Helpers ──────────────────────────────────────────────

function makeCosmicState(system: string, summary: string): CosmicState {
  return {
    system,
    timestamp: new Date(),
    primary: {},
    summary,
    metrics: {},
  };
}

function makeHarmonic(): HarmonicSynthesis {
  return {
    overallResonance: 0.82,
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
    guidance: "Strong creative alignment.",
  };
}

function makeQuest(overrides?: Partial<Quest>): Quest {
  return {
    id: `q-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test quest",
    description: "A test quest",
    questType: "daily",
    difficulty: "easy",
    xpReward: 10,
    status: "active",
    cosmicAlignment: null,
    insightId: null,
    source: "agent",
    assignedAt: new Date(),
    completedAt: null,
    expiresAt: null,
    metadata: {},
    ...overrides,
  };
}

function makeStats(overrides?: Partial<PlayerStats>): PlayerStats {
  return {
    id: "stats-1",
    operatorId: "default",
    totalXp: 5000,
    currentLevel: 3,
    currentRank: "E",
    syncRate: 0.75,
    streakDays: 5,
    syncHistory: [],
    lastActive: new Date().toISOString().split("T")[0],
    ...overrides,
  };
}

function makeDeps(overrides?: Partial<BriefingDeps>): BriefingDeps {
  const states = new Map<string, CosmicState>();
  states.set("cardology", makeCosmicState("cardology", "Mercury period, 7 of Clubs."));
  states.set("solar", makeCosmicState("solar", "Kp 2, quiet conditions."));
  states.set("iching", makeCosmicState("iching", "Gate 48, Line 3. Depth."));

  return {
    getCosmicStates: async () => states,
    getHarmonic: async () => makeHarmonic(),
    getActiveHypotheses: () => [],
    getConfirmedHypotheses: () => [
      {
        id: "hyp-1",
        statement: "Energy sensitivity to solar activity above Kp 5",
        type: HypothesisType.COSMIC_CORRELATION,
        category: "cosmic",
        status: HypothesisStatus.CONFIRMED,
        confidence: 0.91,
        evidenceRecords: [],
        confidenceHistory: [],
        firstDetectedAt: new Date(),
        lastEvidenceAt: new Date(),
        periodEvidenceCount: 0,
        gateEvidenceCount: 0,
        sourcePatterns: [],
      },
    ],
    getPlayerStats: () => makeStats(),
    getActiveQuests: () => [
      makeQuest({ title: "Deep work session", questType: "cosmic", xpReward: 50 }),
      makeQuest({ title: "Morning reflection", questType: "daily", xpReward: 10 }),
    ],
    getCompletedToday: () => [],
    getRecentInsight: () => "Your last 3 Mercury periods produced your best technical work.",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Briefing Runner", () => {
  describe("generateMorningBriefing", () => {
    it("includes cosmic weather from all systems", async () => {
      const briefing = await generateMorningBriefing(makeDeps());
      expect(briefing.text).toContain("Mercury period");
      expect(briefing.text).toContain("Kp 2");
      expect(briefing.text).toContain("Gate 48");
    });

    it("includes harmonic resonance", async () => {
      const briefing = await generateMorningBriefing(makeDeps());
      expect(briefing.text).toContain("82%");
      expect(briefing.text).toContain("HARMONIC");
    });

    it("includes active quests", async () => {
      const briefing = await generateMorningBriefing(makeDeps());
      expect(briefing.text).toContain("Today's Quests:");
      expect(briefing.text).toContain("Deep work session");
      expect(briefing.text).toContain("50 XP");
    });

    it("includes progression stats", async () => {
      const briefing = await generateMorningBriefing(makeDeps());
      expect(briefing.text).toContain("Rank:");
      expect(briefing.text).toContain("XP:");
      expect(briefing.text).toContain("Sync Rate:");
      expect(briefing.text).toContain("Streak:");
    });

    it("includes observer insight", async () => {
      const briefing = await generateMorningBriefing(makeDeps());
      expect(briefing.text).toContain("The Observer noticed:");
      expect(briefing.text).toContain("Mercury periods");
    });

    it("includes confirmed hypothesis", async () => {
      const briefing = await generateMorningBriefing(makeDeps());
      expect(briefing.text).toContain("Known pattern:");
      expect(briefing.text).toContain("solar activity");
    });

    it("returns correct type and metadata", async () => {
      const briefing = await generateMorningBriefing(makeDeps());
      expect(briefing.type).toBe("morning");
      expect(briefing.generatedAt).toBeInstanceOf(Date);
      expect(briefing.metadata.systemCount).toBe(3);
      expect(briefing.metadata.activeQuests).toBe(2);
    });

    it("handles no quests gracefully", async () => {
      const deps = makeDeps({ getActiveQuests: () => [] });
      const briefing = await generateMorningBriefing(deps);
      expect(briefing.text).not.toContain("Today's Quests:");
    });

    it("handles no harmonic gracefully", async () => {
      const deps = makeDeps({ getHarmonic: async () => null });
      const briefing = await generateMorningBriefing(deps);
      expect(briefing.text).not.toContain("🔮");
    });
  });

  describe("generateMiddayCheckin", () => {
    it("includes solar update", async () => {
      const briefing = await generateMiddayCheckin(makeDeps());
      expect(briefing.text).toContain("Solar:");
      expect(briefing.text).toContain("Kp 2");
    });

    it("shows remaining quests", async () => {
      const briefing = await generateMiddayCheckin(makeDeps());
      expect(briefing.text).toContain("2 quests active");
    });

    it("shows completed quests", async () => {
      const deps = makeDeps({
        getCompletedToday: () => [makeQuest({ title: "Done quest", status: "completed" })],
      });
      const briefing = await generateMiddayCheckin(deps);
      expect(briefing.text).toContain("Done quest");
    });

    it("celebrates all quests done", async () => {
      const deps = makeDeps({
        getActiveQuests: () => [],
        getCompletedToday: () => [makeQuest({ status: "completed" })],
      });
      const briefing = await generateMiddayCheckin(deps);
      expect(briefing.text).toContain("All quests completed");
    });

    it("includes call to action", async () => {
      const briefing = await generateMiddayCheckin(makeDeps());
      expect(briefing.text).toContain("progress to log");
    });

    it("returns correct type", async () => {
      const briefing = await generateMiddayCheckin(makeDeps());
      expect(briefing.type).toBe("midday");
    });
  });

  describe("generateEveningReflection", () => {
    it("shows completed quests with XP", async () => {
      const deps = makeDeps({
        getCompletedToday: () => [
          makeQuest({ title: "Deep work", xpReward: 50, status: "completed" }),
          makeQuest({ title: "Reflection", xpReward: 10, status: "completed" }),
        ],
      });
      const briefing = await generateEveningReflection(deps);
      expect(briefing.text).toContain("Deep work");
      expect(briefing.text).toContain("50 XP");
      expect(briefing.text).toContain("Total earned today: 60 XP");
    });

    it("shows pending quests", async () => {
      const briefing = await generateEveningReflection(makeDeps());
      expect(briefing.text).toContain("2 quests still active");
    });

    it("mentions Observer analysis", async () => {
      const briefing = await generateEveningReflection(makeDeps());
      expect(briefing.text).toContain("Observer will analyze");
    });

    it("includes progression with today's XP delta", async () => {
      const deps = makeDeps({
        getCompletedToday: () => [makeQuest({ xpReward: 50, status: "completed" })],
      });
      const briefing = await generateEveningReflection(deps);
      expect(briefing.text).toContain("+50 today");
    });

    it("shows streak fire emoji for 7+ days", async () => {
      const deps = makeDeps({
        getPlayerStats: () => makeStats({ streakDays: 10 }),
      });
      const briefing = await generateEveningReflection(deps);
      expect(briefing.text).toContain("🔥");
    });

    it("no fire emoji for short streak", async () => {
      const deps = makeDeps({
        getPlayerStats: () => makeStats({ streakDays: 3 }),
      });
      const briefing = await generateEveningReflection(deps);
      expect(briefing.text).not.toContain("🔥");
    });

    it("returns correct type", async () => {
      const briefing = await generateEveningReflection(makeDeps());
      expect(briefing.type).toBe("evening");
    });
  });

  describe("generateCosmicAlert", () => {
    it("generates critical alert with icon", () => {
      const alert = generateCosmicAlert({
        system: "Solar",
        summary: "X-class flare detected. Kp rising to 7.",
        severity: "critical",
      });
      expect(alert.text).toContain("⚡");
      expect(alert.text).toContain("X-class flare");
    });

    it("generates warning alert", () => {
      const alert = generateCosmicAlert({
        system: "Solar",
        summary: "Kp rising to 5.",
        severity: "warning",
      });
      expect(alert.text).toContain("⚠️");
    });

    it("generates info alert", () => {
      const alert = generateCosmicAlert({
        system: "Lunar",
        summary: "Full moon in Scorpio.",
        severity: "info",
      });
      expect(alert.text).toContain("ℹ️");
    });

    it("includes pattern context", () => {
      const alert = generateCosmicAlert(
        { system: "Solar", summary: "Kp 6", severity: "warning" },
        { patternNote: "You've shown energy sensitivity above Kp 5." },
      );
      expect(alert.text).toContain("energy sensitivity");
    });

    it("includes auto-generated quest", () => {
      const alert = generateCosmicAlert(
        { system: "Solar", summary: "Kp 6", severity: "warning" },
        { autoQuest: { title: "Note how you feel", xpReward: 50 } },
      );
      expect(alert.text).toContain("Auto-quest generated:");
      expect(alert.text).toContain("Note how you feel");
      expect(alert.text).toContain("50 XP");
    });

    it("returns correct type", () => {
      const alert = generateCosmicAlert({
        system: "Solar",
        summary: "Kp 6",
        severity: "info",
      });
      expect(alert.type).toBe("cosmic_alert");
    });
  });

  describe("createBriefingJobDefs", () => {
    it("returns 3 jobs: morning, midday, evening", () => {
      const jobs = createBriefingJobDefs();
      expect(jobs).toHaveLength(3);
      expect(jobs.map((j) => j.name)).toEqual([
        "briefing-morning",
        "briefing-midday",
        "briefing-evening",
      ]);
    });

    it("all jobs use isolated + announce delivery", () => {
      const jobs = createBriefingJobDefs();
      for (const job of jobs) {
        expect(job.sessionTarget).toBe("isolated");
        expect(job.delivery?.mode).toBe("announce");
      }
    });

    it("all payloads are agentTurn with deliver=true", () => {
      const jobs = createBriefingJobDefs();
      for (const job of jobs) {
        expect(job.payload.kind).toBe("agentTurn");
        if (job.payload.kind === "agentTurn") {
          expect(job.payload.deliver).toBe(true);
        }
      }
    });

    it("uses custom timezone", () => {
      const jobs = createBriefingJobDefs("America/New_York");
      for (const job of jobs) {
        if (job.schedule.kind === "cron") {
          expect(job.schedule.tz).toBe("America/New_York");
        }
      }
    });

    it("uses custom channel", () => {
      const jobs = createBriefingJobDefs("UTC", "telegram");
      for (const job of jobs) {
        expect(job.delivery?.channel).toBe("telegram");
      }
    });

    it("morning at 08:00, midday at 13:00, evening at 21:00", () => {
      const jobs = createBriefingJobDefs();
      const exprs = jobs.map((j) => (j.schedule.kind === "cron" ? j.schedule.expr : ""));
      expect(exprs).toEqual(["0 8 * * *", "0 13 * * *", "0 21 * * *"]);
    });
  });
});
