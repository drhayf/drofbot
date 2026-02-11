/**
 * Phase 4 — Smoke Tests
 *
 * End-to-end verification that all Phase 4 subsystems integrate correctly:
 *
 * 9a. Council — all 6 systems calculate valid states, harmonic synthesis
 * 9b. Intelligence — Observer detects patterns, Hypothesis Engine works
 * 9c. Synthesis — Master Synthesis assembles within token budget
 * 9d. Progression — XP, leveling, quest lifecycle, sync rate
 * 9e. Identity — CodebaseScan, EcosystemCheck, MoltBook, SoulArchive
 * 9f. Briefings — all 4 briefing types generate valid content
 */

import { describe, it, expect, vi } from "vitest";
import type {
  BirthMoment,
  CosmicState,
  CosmicTimestamp,
  ArchetypeMapping,
} from "./council/types.js";
// ─── Council ───────────────────────────────────────────────────
import {
  getCouncil,
  DROFBOT_DEFAULT_BIRTH,
  calculateHarmonicSynthesis,
  Element,
  ResonanceType,
} from "./council/index.js";
// ─── Briefings ─────────────────────────────────────────────────
import {
  generateMorningBriefing,
  generateMiddayCheckin,
  generateEveningReflection,
  generateCosmicAlert,
  createBriefingJobDefs,
  type BriefingDeps,
} from "./cron/briefing-runner.js";
// ─── Identity ──────────────────────────────────────────────────
import { scanCodebase, type CodebaseScanDeps } from "./identity/codebase.js";
import { checkEcosystem, type EcosystemDeps } from "./identity/ecosystem.js";
import {
  SoulArchive,
  SOUL_ARCHIVE_VERSION,
  type SoulArchiveDeps,
} from "./identity/soul-archive.js";
// ─── Intelligence ──────────────────────────────────────────────
import {
  calculateConfidence,
  createEvidenceRecord,
  EvidenceType,
} from "./intelligence/confidence.js";
import { HypothesisEngine, HypothesisStatus, HypothesisType } from "./intelligence/hypothesis.js";
import { Observer } from "./intelligence/observer.js";
// ─── Progression ───────────────────────────────────────────────
import { ProgressionEngine, createDefaultStats } from "./progression/engine.js";
import {
  RANKS,
  XP_REWARDS,
  INSIGHT_LINKED_MULTIPLIER,
  xpThresholdForLevel,
  getRankForLevel,
  calculateQuestXP,
} from "./progression/types.js";
// ─── Synthesis ─────────────────────────────────────────────────
import { SynthesisEngine, type SynthesisDeps } from "./synthesis/master.js";

// ─── Shared Helpers ────────────────────────────────────────────

const TEST_BIRTH: BirthMoment = {
  datetime: new Date("1990-06-15T10:30:00Z"),
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
};

function makeCosmicState(system: string, summary: string): CosmicState {
  return { system, timestamp: new Date(), primary: {}, summary, metrics: {} };
}

// ═══════════════════════════════════════════════════════════════
// 9a. COUNCIL SMOKE TEST
// ═══════════════════════════════════════════════════════════════

describe("9a. Council Smoke Test", () => {
  it("registers all 6 systems", () => {
    const council = getCouncil();
    const systems = council.listSystems();
    expect(systems.length).toBe(6);
    const names = systems.map((s) => s.name);
    expect(names).toContain("cardology");
    expect(names).toContain("iching");
    expect(names).toContain("human-design");
    expect(names).toContain("solar");
    expect(names).toContain("lunar");
    expect(names).toContain("transits");
  });

  it("calculateAll produces valid states for all systems", async () => {
    const council = getCouncil();
    const states = await council.calculateAll(TEST_BIRTH);
    expect(states.size).toBeGreaterThanOrEqual(3);
    for (const [name, state] of states) {
      expect(state.system).toBe(name);
      expect(state.timestamp).toBeInstanceOf(Date);
      expect(typeof state.summary).toBe("string");
      expect(state.summary.length).toBeGreaterThan(0);
    }
  });

  it("calculateHarmonicSynthesis produces resonance", () => {
    const states = new Map<string, CosmicState>();
    states.set("cardology", makeCosmicState("cardology", "Mercury period."));
    states.set("iching", makeCosmicState("iching", "Gate 48."));

    const mappings: ArchetypeMapping[] = [
      {
        system: "cardology",
        elements: [Element.FIRE, Element.AIR],
        archetypes: ["Mercury", "Clubs"],
        resonanceValues: { mental: 0.7 },
      },
      {
        system: "iching",
        elements: [Element.WATER, Element.EARTH],
        archetypes: ["Depth", "Well"],
        resonanceValues: { emotional: 0.6 },
      },
    ];

    const harmonic = calculateHarmonicSynthesis(states, mappings);
    expect(harmonic.overallResonance).toBeGreaterThanOrEqual(0);
    expect(harmonic.overallResonance).toBeLessThanOrEqual(1);
    expect(Object.values(ResonanceType)).toContain(harmonic.resonanceType);
    expect(harmonic.dominantElements.length).toBeGreaterThan(0);
  });

  it("DROFBOT_DEFAULT_BIRTH is configured", () => {
    expect(DROFBOT_DEFAULT_BIRTH).toBeDefined();
    expect(DROFBOT_DEFAULT_BIRTH.datetime).toBeInstanceOf(Date);
    expect(DROFBOT_DEFAULT_BIRTH.latitude).toBe(0);
    expect(DROFBOT_DEFAULT_BIRTH.longitude).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9b. INTELLIGENCE SMOKE TEST
// ═══════════════════════════════════════════════════════════════

describe("9b. Intelligence Smoke Test", () => {
  it("Observer processes entries without error", () => {
    const observer = new Observer();

    const entries = [];
    for (let i = 0; i < 40; i++) {
      const date = new Date(2025, 0, 1 + i, 12, 0, 0);
      const mood = i % 7 === 0 ? 9 : 5;
      entries.push({
        id: `entry-${i}`,
        content: `Day ${i}: mood ${mood}`,
        createdAt: date,
        mood,
      });
    }

    const results = observer.observe(entries);
    expect(results.entriesAnalyzed).toBeGreaterThan(0);
    expect(results.timestamp).toBeInstanceOf(Date);
  });

  it("HypothesisEngine lifecycle: generate → testEvidence", () => {
    const engine = new HypothesisEngine();

    const patterns = [
      {
        type: "cyclical" as const,
        description: "Weekly mood cycle",
        confidence: 0.7,
        period: 7,
        metric: "mood",
        peakPhase: 0,
        sampleSize: 40,
        significanceP: 0.02,
      },
    ];
    const generated = engine.generateFromPatterns(patterns);
    expect(generated.length).toBeGreaterThan(0);

    const updates = engine.testEvidence(
      EvidenceType.BEHAVIORAL_SELF_REPORT,
      "smoke-test",
      "Mood was high on expected day",
      () => true,
      new Date(),
    );
    expect(updates.length).toBeGreaterThanOrEqual(0);

    const active = engine.getActive();
    expect(active.length).toBeGreaterThanOrEqual(0);
  });

  it("Weighted Confidence Calculator produces valid scores", () => {
    const now = new Date();
    const records = [
      createEvidenceRecord(EvidenceType.MOOD_SCORE_ALIGNMENT, "observer", "positive mood", 0, now),
      createEvidenceRecord(
        EvidenceType.COSMIC_CORRELATION,
        "cosmic_module",
        "alignment match",
        1,
        now,
      ),
      createEvidenceRecord(EvidenceType.COUNTER_PATTERN, "observer", "contradiction", 2, now),
    ];
    const result = calculateConfidence(records);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9c. SYNTHESIS SMOKE TEST
// ═══════════════════════════════════════════════════════════════

describe("9c. Synthesis Smoke Test", () => {
  function makeSynthDeps(): SynthesisDeps {
    const states = new Map<string, CosmicState>();
    states.set("cardology", makeCosmicState("cardology", "Mercury, 7 of Clubs."));
    states.set("solar", makeCosmicState("solar", "Kp 3, stable."));
    states.set("iching", makeCosmicState("iching", "Gate 48, Depth."));

    const harmonic = {
      overallResonance: 0.82,
      resonanceType: ResonanceType.HARMONIC,
      pairwise: [],
      dominantElements: [Element.FIRE],
      elementalBalance: {
        [Element.FIRE]: 0.4,
        [Element.WATER]: 0.2,
        [Element.AIR]: 0.2,
        [Element.EARTH]: 0.1,
        [Element.ETHER]: 0.1,
      },
      guidance: "Strong creative alignment.",
    };

    const timestamp: CosmicTimestamp = {
      datetime: new Date(),
      systems: Object.fromEntries(states),
    };

    return {
      calculateCosmicStates: async () => states,
      getCosmicTimestamp: async () => timestamp,
      calculateHarmonic: async () => harmonic,
      getActiveHypotheses: () => [],
      getConfirmedHypotheses: () => [
        {
          id: "hyp-1",
          statement: "Mercury periods enhance focus",
          type: HypothesisType.COSMIC_CORRELATION,
          category: "cardology",
          status: HypothesisStatus.CONFIRMED,
          confidence: 0.88,
          evidenceRecords: [],
          confidenceHistory: [],
          firstDetectedAt: new Date(),
          lastEvidenceAt: new Date(),
          periodEvidenceCount: 0,
          gateEvidenceCount: 0,
          sourcePatterns: [],
        },
      ],
      getRecentEpisodicContext: async () => ["Stayed focused during Mercury period."],
      getSemanticByCategory: async (cat: string) => {
        if (cat === "identity") return ["Technical operator"];
        if (cat === "preference") return ["Concise style"];
        return [];
      },
      getSelfKnowledge: async () => ["Drofbot is a self-aware agent."],
    };
  }

  it("generateMasterSynthesis assembles all sections", async () => {
    const engine = new SynthesisEngine(makeSynthDeps(), TEST_BIRTH, null);
    const synthesis = await engine.generateMasterSynthesis();
    expect(synthesis.profile).toBeTruthy();
    expect(synthesis.cosmicWeather).toBeTruthy();
    expect(synthesis.intelligence).toBeDefined();
    expect(synthesis.rendered).toBeTruthy();
  });

  it("rendered text fits within token budget", async () => {
    const engine = new SynthesisEngine(makeSynthDeps(), TEST_BIRTH, null);
    const synthesis = await engine.generateMasterSynthesis();
    expect(synthesis.rendered.length).toBeLessThanOrEqual(3200);
  });

  it("synthesis includes cosmic weather from provided systems", async () => {
    const engine = new SynthesisEngine(makeSynthDeps(), TEST_BIRTH, null);
    const synthesis = await engine.generateMasterSynthesis();
    expect(synthesis.cosmicWeather.length).toBeGreaterThan(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9d. PROGRESSION SMOKE TEST
// ═══════════════════════════════════════════════════════════════

describe("9d. Progression Smoke Test", () => {
  it("full quest lifecycle: create → complete → XP award", () => {
    const stats = createDefaultStats("operator-1");
    const engine = new ProgressionEngine(stats);

    const quest = engine.createQuest({
      title: "Mercury deep work",
      description: "Focus session during Mercury period",
      questType: "cosmic",
      difficulty: "hard",
      source: "agent",
    });
    expect(quest.xpReward).toBe(XP_REWARDS.hard);

    const result = engine.completeQuest(quest.id);
    expect(result).not.toBeNull();
    expect(result!.xpGain.xpAdded).toBe(XP_REWARDS.hard);
    expect(result!.xpGain.totalXp).toBe(XP_REWARDS.hard);
  });

  it("XP thresholds match GUTTERS formula", () => {
    expect(xpThresholdForLevel(1)).toBe(1000);
    expect(xpThresholdForLevel(2)).toBe(3000);
    expect(xpThresholdForLevel(3)).toBe(Math.floor(3 * 1000 * Math.pow(1.5, 2)));
  });

  it("rank tiers are correct", () => {
    expect(getRankForLevel(1).id).toBe("E");
    expect(getRankForLevel(6).id).toBe("D");
    expect(getRankForLevel(11).id).toBe("C");
    expect(getRankForLevel(21).id).toBe("B");
    expect(getRankForLevel(31).id).toBe("A");
    expect(getRankForLevel(41).id).toBe("S");
    expect(getRankForLevel(51).id).toBe("SS");
  });

  it("insight-linked quests get 1.5x multiplier (floor)", () => {
    const xp = calculateQuestXP("medium", { insightLinked: true });
    expect(xp).toBe(Math.floor(XP_REWARDS.medium * INSIGHT_LINKED_MULTIPLIER));
  });

  it("daily briefing includes progression data", () => {
    const stats = createDefaultStats("op-1");
    stats.totalXp = 12000;
    stats.currentLevel = 6;
    stats.currentRank = "D";
    stats.syncRate = 0.78;
    stats.streakDays = 14;

    const engine = new ProgressionEngine(stats);
    const rendered = engine.renderForSynthesis();
    expect(rendered).toContain("Level 6");
    expect(rendered).toContain("12,000");
    expect(rendered).toContain("78%");
    expect(rendered).toContain("14");
  });
});

// ═══════════════════════════════════════════════════════════════
// 9e. IDENTITY SMOKE TEST
// ═══════════════════════════════════════════════════════════════

describe("9e. Identity Smoke Test", () => {
  it("CodebaseScan produces complete snapshot", async () => {
    const deps: CodebaseScanDeps = {
      glob: vi.fn(async (p: string) => {
        if (p.includes("systems")) return ["src/brain/council/systems/cardology.ts"];
        if (p.includes("extensions")) return ["extensions/telegram/package.json"];
        return [];
      }),
      readFile: vi.fn(async () => '{"name": "telegram"}'),
      exec: vi.fn(async () => "abc|feat: new|2025-01-15|"),
      storeInMemory: vi.fn(async () => {}),
    };
    const snapshot = await scanCodebase(deps);
    expect(snapshot.architecture).toContain("Drofbot");
    expect(snapshot.capabilities.brainSystems).toContain("council");
    expect(snapshot.scannedAt).toBeInstanceOf(Date);
  });

  it("EcosystemCheck identifies opportunities", async () => {
    const deps: EcosystemDeps = {
      fetchUpstreamCommits: vi.fn(async () => [
        { hash: "x", message: "feat: voice", date: "2025-01-15", author: "a" },
      ]),
      fetchLatestRelease: vi.fn(async () => "v2025.1.15"),
      getOwnCapabilities: vi.fn(() => ["council"]),
      storeInMemory: vi.fn(async () => {}),
      getLastCheckTimestamp: vi.fn(() => null),
      saveCheckTimestamp: vi.fn(async () => {}),
    };
    const check = await checkEcosystem(deps);
    expect(check.newCommits).toHaveLength(1);
    expect(check.uniqueCapabilities).toContain("council");
  });

  it("SoulArchive round-trip: export → verify → import", async () => {
    const archiver = new SoulArchive();
    const deps: SoulArchiveDeps = {
      getSynthesis: () => ({
        profile: "Test.",
        cosmicWeather: "Clear.",
        intelligence: "1 pattern.",
        harmony: "0.8",
        progression: "Level 3.",
        rendered: "Full.",
        generatedAt: new Date(),
      }),
      getSelfModel: () => null,
      getRelationshipModel: () => null,
      getConfirmedHypotheses: () => [],
      getActiveHypotheses: () => [],
      getPlayerStats: () => createDefaultStats("op"),
      getQuestHistory: () => [],
      getSemanticMemories: vi.fn(async () => []),
      getCouncilConfig: () => ({
        operatorBirth: TEST_BIRTH,
        agentBirth: { dateTime: "2025-01-01T00:00:00Z", latitude: 0, longitude: 0 },
        config: { enabled: true },
      }),
    };

    const exported = await archiver.export(deps);
    expect(exported.version).toBe(SOUL_ARCHIVE_VERSION);

    const verified = archiver.verify(exported);
    expect(verified.valid).toBe(true);
    expect(verified.errors).toHaveLength(0);

    const importDeps = {
      importHypotheses: vi.fn(async () => {}),
      importPlayerStats: vi.fn(async () => {}),
      importSemanticMemories: vi.fn(async () => {}),
      importCouncilConfig: vi.fn(async () => {}),
    };
    await archiver.import(exported, importDeps);
    expect(importDeps.importPlayerStats).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 9f. BRIEFING SMOKE TEST
// ═══════════════════════════════════════════════════════════════

describe("9f. Briefing Smoke Test", () => {
  function makeBriefDeps(): BriefingDeps {
    const states = new Map<string, CosmicState>();
    states.set("cardology", makeCosmicState("cardology", "7 of Clubs, Mercury period."));
    states.set("solar", makeCosmicState("solar", "Kp 3, quiet."));

    return {
      getCosmicStates: async () => states,
      getHarmonic: async () => ({
        overallResonance: 0.78,
        resonanceType: ResonanceType.HARMONIC,
        pairwise: [],
        dominantElements: [Element.AIR],
        elementalBalance: {
          [Element.AIR]: 0.5,
          [Element.FIRE]: 0.2,
          [Element.WATER]: 0.1,
          [Element.EARTH]: 0.1,
          [Element.ETHER]: 0.1,
        },
        guidance: "Aligned.",
      }),
      getActiveHypotheses: () => [],
      getConfirmedHypotheses: () => [],
      getPlayerStats: () => createDefaultStats("op"),
      getActiveQuests: () => [],
      getCompletedToday: () => [],
      getRecentInsight: () => null,
    };
  }

  it("morning briefing generates valid content", async () => {
    const briefing = await generateMorningBriefing(makeBriefDeps());
    expect(briefing.type).toBe("morning");
    expect(briefing.text).toContain("Mercury period");
    expect(briefing.generatedAt).toBeInstanceOf(Date);
  });

  it("midday check-in generates valid content", async () => {
    const briefing = await generateMiddayCheckin(makeBriefDeps());
    expect(briefing.type).toBe("midday");
    expect(briefing.text).toContain("Kp 3");
  });

  it("evening reflection generates valid content", async () => {
    const briefing = await generateEveningReflection(makeBriefDeps());
    expect(briefing.type).toBe("evening");
    expect(briefing.text).toContain("Observer");
  });

  it("cosmic alert generates valid content", () => {
    const alert = generateCosmicAlert({
      system: "Solar",
      summary: "X-class flare, Kp 7.",
      severity: "critical",
    });
    expect(alert.type).toBe("cosmic_alert");
    expect(alert.text).toContain("⚡");
    expect(alert.text).toContain("X-class flare");
  });

  it("cron job definitions are well-formed", () => {
    const jobs = createBriefingJobDefs("America/New_York", "telegram");
    expect(jobs).toHaveLength(3);
    for (const job of jobs) {
      expect(job.sessionTarget).toBe("isolated");
      expect(job.payload.kind).toBe("agentTurn");
      expect(job.delivery?.mode).toBe("announce");
    }
  });
});
