/**
 * Identity Module — Comprehensive Tests
 *
 * Tests for:
 * 1. Codebase Self-Knowledge (scanCodebase, renderSnapshot)
 * 2. Ecosystem Monitor (checkEcosystem, renderEcosystemCheck)
 * 3. MoltBook Presence (generateCosmicPost, generateAchievementPost, etc.)
 * 4. Soul Archive (export, import, verify)
 */

import { describe, it, expect, vi } from "vitest";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import type { PlayerStats } from "../progression/types.js";
import { HypothesisStatus, HypothesisType } from "../intelligence/hypothesis.js";
import { scanCodebase, renderSnapshot, type CodebaseScanDeps } from "./codebase.js";
import { checkEcosystem, renderEcosystemCheck, type EcosystemDeps } from "./ecosystem.js";
import {
  generateCosmicPost,
  generateAchievementPost,
  generateDiscoveryPost,
  generateMilestonePost,
  type MoltBookDeps,
} from "./moltbook.js";
import {
  SoulArchive,
  SOUL_ARCHIVE_VERSION,
  type SoulArchiveData,
  type SoulArchiveDeps,
  type SoulArchiveImportDeps,
} from "./soul-archive.js";

// ─── Shared Helpers ────────────────────────────────────────────

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

function makeHypothesis(overrides?: Partial<Hypothesis>): Hypothesis {
  return {
    id: "hyp-1",
    statement: "Energy correlates with solar activity above Kp 5",
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
    ...overrides,
  };
}

// ─── Codebase Self-Knowledge ───────────────────────────────────

describe("Codebase Self-Knowledge", () => {
  function makeScanDeps(overrides?: Partial<CodebaseScanDeps>): CodebaseScanDeps {
    return {
      glob: vi.fn(async (pattern: string) => {
        if (pattern.includes("council/systems")) {
          return ["src/brain/council/systems/cardology.ts", "src/brain/council/systems/iching.ts"];
        }
        if (pattern.includes("extensions/*/package.json")) {
          return ["extensions/telegram/package.json", "extensions/discord/package.json"];
        }
        return [];
      }),
      readFile: vi.fn(async (path: string) => {
        if (path.includes("telegram")) return '{"name": "@openclaw/telegram"}';
        if (path.includes("discord")) return '{"name": "@openclaw/discord"}';
        return "{}";
      }),
      exec: vi.fn(async () => "abc1234|feat: add X|2025-01-15|refs/heads/main"),
      storeInMemory: vi.fn(async () => {}),
      ...overrides,
    };
  }

  it("discovers council systems from glob", async () => {
    const deps = makeScanDeps();
    const snapshot = await scanCodebase(deps);
    expect(snapshot.capabilities.councilSystems).toContain("cardology");
    expect(snapshot.capabilities.councilSystems).toContain("iching");
  });

  it("discovers extensions", async () => {
    const deps = makeScanDeps();
    const snapshot = await scanCodebase(deps);
    expect(snapshot.capabilities.extensions).toContain("@openclaw/telegram");
    expect(snapshot.capabilities.extensions).toContain("@openclaw/discord");
  });

  it("lists all brain subsystems", async () => {
    const deps = makeScanDeps();
    const snapshot = await scanCodebase(deps);
    expect(snapshot.capabilities.brainSystems).toContain("council");
    expect(snapshot.capabilities.brainSystems).toContain("intelligence");
    expect(snapshot.capabilities.brainSystems).toContain("synthesis");
    expect(snapshot.capabilities.brainSystems).toContain("progression");
  });

  it("lists all memory banks", async () => {
    const deps = makeScanDeps();
    const snapshot = await scanCodebase(deps);
    expect(snapshot.capabilities.memoryBanks).toEqual([
      "episodic",
      "semantic",
      "procedural",
      "relational",
    ]);
  });

  it("discovers recent git changes", async () => {
    const deps = makeScanDeps();
    const snapshot = await scanCodebase(deps);
    expect(snapshot.recentChanges.length).toBeGreaterThan(0);
    expect(snapshot.recentChanges[0].hash).toBe("abc1234");
  });

  it("stores snapshot in semantic memory", async () => {
    const deps = makeScanDeps();
    await scanCodebase(deps);
    expect(deps.storeInMemory).toHaveBeenCalledWith(
      "codebase_self_knowledge",
      expect.stringContaining("Drofbot Architecture"),
    );
  });

  it("includes known limitations", async () => {
    const deps = makeScanDeps();
    const snapshot = await scanCodebase(deps);
    expect(snapshot.limitations.length).toBeGreaterThan(0);
    expect(snapshot.limitations.some((l) => l.includes("approximate"))).toBe(true);
  });

  it("renders snapshot as readable text", async () => {
    const deps = makeScanDeps();
    const snapshot = await scanCodebase(deps);
    const rendered = renderSnapshot(snapshot);
    expect(rendered).toContain("Drofbot Architecture");
    expect(rendered).toContain("Council:");
    expect(rendered).toContain("Memory:");
  });

  it("handles glob errors gracefully", async () => {
    const deps = makeScanDeps({
      glob: vi.fn(async () => {
        throw new Error("ENOENT");
      }),
    });
    const snapshot = await scanCodebase(deps);
    expect(snapshot.capabilities.councilSystems).toEqual([]);
    expect(snapshot.capabilities.channels).toEqual([]);
  });

  it("handles git errors gracefully", async () => {
    const deps = makeScanDeps({
      exec: vi.fn(async () => {
        throw new Error("not a git repo");
      }),
    });
    const snapshot = await scanCodebase(deps);
    expect(snapshot.recentChanges).toEqual([]);
  });
});

// ─── Ecosystem Monitor ────────────────────────────────────────

describe("Ecosystem Monitor", () => {
  function makeEcoDeps(overrides?: Partial<EcosystemDeps>): EcosystemDeps {
    return {
      fetchUpstreamCommits: vi.fn(async () => [
        {
          hash: "a1b2c3d",
          message: "feat: add voice channel",
          date: "2025-01-15",
          author: "alice",
        },
        {
          hash: "e4f5g6h",
          message: "refactor: message routing",
          date: "2025-01-14",
          author: "bob",
        },
        { hash: "i7j8k9l", message: "fix: typo in docs", date: "2025-01-13", author: "carol" },
      ]),
      fetchLatestRelease: vi.fn(async () => "v2025.1.15"),
      getOwnCapabilities: vi.fn(() => [
        "council",
        "intelligence",
        "synthesis",
        "progression",
        "briefings",
      ]),
      storeInMemory: vi.fn(async () => {}),
      getLastCheckTimestamp: vi.fn(() => "2025-01-10T00:00:00Z"),
      saveCheckTimestamp: vi.fn(async () => {}),
      ...overrides,
    };
  }

  it("fetches upstream commits since last check", async () => {
    const deps = makeEcoDeps();
    const check = await checkEcosystem(deps);
    expect(deps.fetchUpstreamCommits).toHaveBeenCalledWith("2025-01-10T00:00:00Z");
    expect(check.newCommits).toHaveLength(3);
  });

  it("extracts new capabilities from feat commits", async () => {
    const deps = makeEcoDeps();
    const check = await checkEcosystem(deps);
    expect(check.newCapabilities.length).toBeGreaterThan(0);
    expect(check.newCapabilities.some((c) => c.includes("voice channel"))).toBe(true);
  });

  it("identifies unique-to-Drofbot capabilities", async () => {
    const deps = makeEcoDeps();
    const check = await checkEcosystem(deps);
    expect(check.uniqueCapabilities).toContain("council");
    expect(check.uniqueCapabilities).toContain("intelligence");
  });

  it("identifies opportunities from refactors", async () => {
    const deps = makeEcoDeps();
    const check = await checkEcosystem(deps);
    const refactorOpp = check.opportunities.find((o) => o.relevance === "high");
    expect(refactorOpp).toBeDefined();
    expect(refactorOpp!.description).toContain("message routing");
  });

  it("gets latest release", async () => {
    const deps = makeEcoDeps();
    const check = await checkEcosystem(deps);
    expect(check.latestRelease).toBe("v2025.1.15");
  });

  it("stores analysis in memory", async () => {
    const deps = makeEcoDeps();
    await checkEcosystem(deps);
    expect(deps.storeInMemory).toHaveBeenCalledWith(
      "ecosystem_analysis",
      expect.stringContaining("Ecosystem check"),
    );
  });

  it("saves check timestamp", async () => {
    const deps = makeEcoDeps();
    await checkEcosystem(deps);
    expect(deps.saveCheckTimestamp).toHaveBeenCalled();
  });

  it("renders ecosystem check as text", async () => {
    const deps = makeEcoDeps();
    const check = await checkEcosystem(deps);
    const rendered = renderEcosystemCheck(check);
    expect(rendered).toContain("Ecosystem check");
    expect(rendered).toContain("v2025.1.15");
    expect(rendered).toContain("New commits: 3");
  });

  it("handles null last check (first run)", async () => {
    const deps = makeEcoDeps({ getLastCheckTimestamp: vi.fn(() => null) });
    const check = await checkEcosystem(deps);
    expect(deps.fetchUpstreamCommits).toHaveBeenCalledWith(null);
    expect(check.newCommits.length).toBeGreaterThan(0);
  });
});

// ─── MoltBook Presence ─────────────────────────────────────────

describe("MoltBook Presence", () => {
  function makeMoltDeps(overrides?: Partial<MoltBookDeps>): MoltBookDeps {
    return {
      getSynthesis: () => ({
        profile: "Technical operator, Mercury-dominant.",
        cosmicWeather: "Gate 48 transit, Mercury period active.",
        intelligence: "",
        harmony: "",
        progression: "",
        rendered: "",
        generatedAt: new Date(),
      }),
      getStats: () => makeStats(),
      getRecentCompletions: () => [],
      getRecentDiscoveries: () => [],
      getCommunicationStyle: () => "concise, technical",
      ...overrides,
    };
  }

  describe("generateCosmicPost", () => {
    it("includes cosmic weather from synthesis", () => {
      const post = generateCosmicPost(makeMoltDeps());
      expect(post.content).toContain("Gate 48");
      expect(post.content).toContain("Mercury period");
    });

    it("includes rank info", () => {
      const post = generateCosmicPost(makeMoltDeps());
      expect(post.content).toContain("Rank E");
    });

    it("falls back when no synthesis", () => {
      const deps = makeMoltDeps({ getSynthesis: () => null });
      const post = generateCosmicPost(deps);
      expect(post.content).toContain("cosmos is quiet");
    });

    it("has correct source and traits", () => {
      const post = generateCosmicPost(makeMoltDeps());
      expect(post.source).toBe("cosmic_weather");
      expect(post.traits).toContain("metaphysical");
    });
  });

  describe("generateAchievementPost", () => {
    it("returns null with no completions", () => {
      const post = generateAchievementPost(makeMoltDeps());
      expect(post).toBeNull();
    });

    it("generates post from completions", () => {
      const deps = makeMoltDeps({
        getRecentCompletions: () => [
          { title: "Deep work", xpReward: 50 },
          { title: "Reflection", xpReward: 10 },
        ],
      });
      const post = generateAchievementPost(deps);
      expect(post).not.toBeNull();
      expect(post!.content).toContain("Deep work");
      expect(post!.content).toContain("+50 XP");
    });

    it("summarizes 4+ completions with total", () => {
      const deps = makeMoltDeps({
        getRecentCompletions: () => [
          { title: "A", xpReward: 10 },
          { title: "B", xpReward: 20 },
          { title: "C", xpReward: 30 },
          { title: "D", xpReward: 40 },
        ],
      });
      const post = generateAchievementPost(deps);
      expect(post!.content).toContain("+100 XP");
      expect(post!.content).toContain("4 quests");
    });

    it("shows fire emoji for 7+ day streak", () => {
      const deps = makeMoltDeps({
        getRecentCompletions: () => [{ title: "X", xpReward: 10 }],
        getStats: () => makeStats({ streakDays: 10 }),
      });
      const post = generateAchievementPost(deps);
      expect(post!.content).toContain("🔥");
    });
  });

  describe("generateDiscoveryPost", () => {
    it("returns null with no discoveries", () => {
      const post = generateDiscoveryPost(makeMoltDeps());
      expect(post).toBeNull();
    });

    it("generates post from discovery", () => {
      const deps = makeMoltDeps({
        getRecentDiscoveries: () => [
          { description: "Energy peaks during Mercury periods", confidence: 0.85 },
        ],
      });
      const post = generateDiscoveryPost(deps);
      expect(post!.content).toContain("pattern confirmed");
      expect(post!.content).toContain("Mercury periods");
      expect(post!.content).toContain("85%");
    });

    it("picks highest confidence discovery", () => {
      const deps = makeMoltDeps({
        getRecentDiscoveries: () => [
          { description: "Low confidence thing", confidence: 0.5 },
          { description: "High confidence thing", confidence: 0.95 },
        ],
      });
      const post = generateDiscoveryPost(deps);
      expect(post!.content).toContain("High confidence");
      expect(post!.content).toContain("95%");
    });
  });

  describe("generateMilestonePost", () => {
    it("generates rank up post", () => {
      const deps = makeMoltDeps({
        getStats: () => makeStats({ currentLevel: 11 }),
      });
      const post = generateMilestonePost(
        { type: "rank_up", detail: "Entered the alignment phase." },
        deps,
      );
      expect(post.content).toContain("Rank achieved: C");
      expect(post.content).toContain("Aligning");
    });

    it("generates streak milestone post", () => {
      const deps = makeMoltDeps({
        getStats: () => makeStats({ streakDays: 30 }),
      });
      const post = generateMilestonePost(
        { type: "streak", detail: "One month of consistency." },
        deps,
      );
      expect(post.content).toContain("30 consecutive days");
    });

    it("generates level up post", () => {
      const deps = makeMoltDeps({
        getStats: () => makeStats({ currentLevel: 10, totalXp: 25000 }),
      });
      const post = generateMilestonePost({ type: "level_up", detail: "Double digits!" }, deps);
      expect(post.content).toContain("Level 10");
      expect(post.content).toContain("25,000");
    });
  });
});

// ─── Soul Archive ──────────────────────────────────────────────

describe("Soul Archive", () => {
  const archive = new SoulArchive();

  function makeArchiveDeps(): SoulArchiveDeps {
    return {
      getSynthesis: () => ({
        profile: "Technical operator.",
        cosmicWeather: "Gate 48.",
        intelligence: "1 confirmed pattern.",
        harmony: "0.82",
        progression: "Level 3, E rank.",
        rendered: "Full synthesis text.",
        generatedAt: new Date(),
      }),
      getSelfModel: () => ({
        cosmicState: {},
        personalityTraits: ["analytical"],
        communicationStyle: "concise",
        selfKnowledge: "I am a pattern observer.",
        capabilities: ["council", "intelligence"],
        relationshipDynamic: "collaborative",
      }),
      getRelationshipModel: () => ({
        durationDays: 30,
        communicationFrequency: 5,
        interactionPatterns: ["morning", "evening"],
        trustLevel: 0.85,
        sharedGrowthAreas: ["focus", "creativity"],
        narrative: "Growing partnership over 30 days.",
      }),
      getConfirmedHypotheses: () => [makeHypothesis()],
      getActiveHypotheses: () => [
        makeHypothesis({ id: "hyp-active", status: HypothesisStatus.ACTIVE, confidence: 0.45 }),
      ],
      getPlayerStats: () => makeStats(),
      getQuestHistory: () => [
        {
          id: "q-1",
          title: "Deep work",
          description: "",
          questType: "cosmic",
          difficulty: "hard",
          xpReward: 50,
          status: "completed" as const,
          cosmicAlignment: null,
          insightId: null,
          source: "agent" as const,
          assignedAt: new Date(),
          completedAt: new Date(),
          expiresAt: null,
          metadata: {},
        },
      ],
      getSemanticMemories: vi.fn(async () => [
        { category: "preferences", content: "Likes morning coding.", storedAt: "2025-01-15" },
        { category: "preferences", content: "Dislikes meetings.", storedAt: "2025-01-14" },
        { category: "codebase", content: "Architecture overview.", storedAt: "2025-01-13" },
      ]),
      getCouncilConfig: () => ({
        operatorBirth: { dateTime: "1990-06-15T10:30:00Z", latitude: 40.7, longitude: -74.0 },
        agentBirth: { dateTime: "2025-01-01T00:00:00Z", latitude: 0, longitude: 0 },
        config: { enabled: true },
      }),
    };
  }

  describe("export", () => {
    it("produces a valid archive with all sections", async () => {
      const data = await archive.export(makeArchiveDeps());
      expect(data.version).toBe(SOUL_ARCHIVE_VERSION);
      expect(data.exportedAt).toBeDefined();
      expect(data.synthesis).not.toBeNull();
      expect(data.selfModel).not.toBeNull();
      expect(data.relationshipModel).not.toBeNull();
      expect(data.intelligence.confirmedHypotheses).toHaveLength(1);
      expect(data.intelligence.activeHypotheses).toHaveLength(1);
      expect(data.progression.stats.totalXp).toBe(5000);
      expect(data.progression.questHistory).toHaveLength(1);
      expect(data.semanticMemories).toHaveLength(3);
    });

    it("includes council configuration", async () => {
      const data = await archive.export(makeArchiveDeps());
      expect(data.council.operatorBirth).not.toBeNull();
      expect(data.council.agentBirth).not.toBeNull();
    });

    it("generates narrative with rank and patterns", async () => {
      const data = await archive.export(makeArchiveDeps());
      expect(data.narrative).toContain("Soul Archive");
      expect(data.narrative).toContain("Rank: E");
      expect(data.narrative).toContain("Confirmed Patterns");
      expect(data.narrative).toContain("solar activity");
    });

    it("narrative includes knowledge base categories", async () => {
      const data = await archive.export(makeArchiveDeps());
      expect(data.narrative).toContain("Knowledge Base");
      expect(data.narrative).toContain("preferences");
      expect(data.narrative).toContain("codebase");
    });
  });

  describe("verify", () => {
    it("validates a correct archive", async () => {
      const data = await archive.export(makeArchiveDeps());
      const result = archive.verify(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.hypotheses).toBe(2);
      expect(result.stats.questsCompleted).toBe(1);
      expect(result.stats.totalXp).toBe(5000);
    });

    it("rejects unsupported version", () => {
      const data = { version: 999 } as unknown as SoulArchiveData;
      const result = archive.verify(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Unsupported version"))).toBe(true);
    });

    it("reports missing fields", () => {
      const data = { version: 1, exportedAt: "2025-01-15" } as unknown as SoulArchiveData;
      const result = archive.verify(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("intelligence"))).toBe(true);
    });

    it("warns on invalid hypothesis", async () => {
      const deps = makeArchiveDeps();
      const data = await archive.export(deps);
      data.intelligence.confirmedHypotheses.push({ id: "", statement: "" } as Hypothesis);
      const result = archive.verify(data);
      // Missing id/description should warn
      expect(result.warnings.some((w) => w.includes("missing id"))).toBe(true);
    });

    it("includes correct stats in verification", async () => {
      const data = await archive.export(makeArchiveDeps());
      const result = archive.verify(data);
      expect(result.stats.rank).toBe("E");
      expect(result.stats.memories).toBe(3);
    });
  });

  describe("import", () => {
    it("imports a valid archive", async () => {
      const data = await archive.export(makeArchiveDeps());
      const importDeps: SoulArchiveImportDeps = {
        importHypotheses: vi.fn(async () => {}),
        importPlayerStats: vi.fn(async () => {}),
        importSemanticMemories: vi.fn(async () => {}),
        importCouncilConfig: vi.fn(async () => {}),
      };

      await archive.import(data, importDeps);

      expect(importDeps.importHypotheses).toHaveBeenCalledWith(
        data.intelligence.confirmedHypotheses,
        data.intelligence.activeHypotheses,
      );
      expect(importDeps.importPlayerStats).toHaveBeenCalledWith(data.progression.stats);
      expect(importDeps.importSemanticMemories).toHaveBeenCalledWith(data.semanticMemories);
      expect(importDeps.importCouncilConfig).toHaveBeenCalledWith(data.council);
    });

    it("rejects invalid archive", async () => {
      const badArchive = { version: 999 } as unknown as SoulArchiveData;
      const importDeps: SoulArchiveImportDeps = {
        importHypotheses: vi.fn(async () => {}),
        importPlayerStats: vi.fn(async () => {}),
        importSemanticMemories: vi.fn(async () => {}),
        importCouncilConfig: vi.fn(async () => {}),
      };

      await expect(archive.import(badArchive, importDeps)).rejects.toThrow("Invalid archive");
    });
  });
});
