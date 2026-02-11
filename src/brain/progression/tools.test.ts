/**
 * Tests for progression agent tools (progression_status, quest_*).
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ProgressionEngine, createDefaultStats } from "./engine.js";
import {
  createProgressionStatusTool,
  createQuestListTool,
  createQuestCompleteTool,
  createQuestCreateTool,
  createProgressionTools,
  setProgressionEngine,
} from "./tools.js";

// ─── Helpers ───────────────────────────────────────────────────

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ─── Test Suite ────────────────────────────────────────────────

describe("Progression Tools", () => {
  let engine: ProgressionEngine;

  beforeEach(() => {
    engine = new ProgressionEngine(createDefaultStats("test-operator"));
    setProgressionEngine(engine);
  });

  // ─── Factory tests ─────────────────────────────────────────

  describe("createProgressionTools", () => {
    it("returns 4 tools", () => {
      const tools = createProgressionTools();
      expect(tools).toHaveLength(4);
      const names = tools.map((t) => t.name);
      expect(names).toContain("progression_status");
      expect(names).toContain("quest_list");
      expect(names).toContain("quest_complete");
      expect(names).toContain("quest_create");
    });
  });

  // ─── Progression Status ────────────────────────────────────

  describe("progression_status", () => {
    it("returns initial stats for fresh engine", async () => {
      const tool = createProgressionStatusTool();
      const result = await tool.execute("tc-1", {});
      const data = parseResult(result);

      expect(data.level).toBe(1);
      expect(data.rank.id).toBe("E");
      expect(data.totalXp).toBe(0);
      expect(data.syncRate).toBe(0);
      expect(data.streakDays).toBe(0);
      expect(data.activeQuests).toBe(0);
      expect(data.completedQuests).toBe(0);
    });

    it("reflects XP gains", async () => {
      engine.addXP(500);

      const tool = createProgressionStatusTool();
      const result = await tool.execute("tc-2", {});
      const data = parseResult(result);

      expect(data.totalXp).toBe(500);
    });
  });

  // ─── Quest List ────────────────────────────────────────────

  describe("quest_list", () => {
    it("returns empty list for fresh engine", async () => {
      const tool = createQuestListTool();
      const result = await tool.execute("tc-3", {});
      const data = parseResult(result);
      expect(data.count).toBe(0);
      expect(data.quests).toEqual([]);
    });

    it("lists active quests by default", async () => {
      engine.createQuest({
        title: "Meditate",
        description: "Morning meditation",
        questType: "daily",
        difficulty: "easy",
      });

      const tool = createQuestListTool();
      const result = await tool.execute("tc-4", {});
      const data = parseResult(result);
      expect(data.count).toBe(1);
      expect(data.quests[0].title).toBe("Meditate");
      expect(data.quests[0].status).toBe("active");
    });

    it("filters by status=completed", async () => {
      const quest = engine.createQuest({
        title: "Read chapter",
        description: "Read one chapter",
        questType: "daily",
        difficulty: "medium",
      });
      engine.completeQuest(quest.id);

      const tool = createQuestListTool();
      const result = await tool.execute("tc-5", { status: "completed" });
      const data = parseResult(result);
      expect(data.count).toBe(1);
      expect(data.quests[0].status).toBe("completed");
    });

    it("filters by status=all returns everything", async () => {
      engine.createQuest({
        title: "Q1",
        description: "Active quest",
        questType: "daily",
        difficulty: "easy",
      });
      const q2 = engine.createQuest({
        title: "Q2",
        description: "Complete this",
        questType: "daily",
        difficulty: "easy",
      });
      engine.completeQuest(q2.id);

      const tool = createQuestListTool();
      const result = await tool.execute("tc-6", { status: "all" });
      const data = parseResult(result);
      expect(data.count).toBe(2);
    });
  });

  // ─── Quest Complete ────────────────────────────────────────

  describe("quest_complete", () => {
    it("completes a quest and awards XP", async () => {
      const quest = engine.createQuest({
        title: "Journal entry",
        description: "Write a journal entry",
        questType: "daily",
        difficulty: "easy",
      });

      const tool = createQuestCompleteTool();
      const result = await tool.execute("tc-7", {
        id: quest.id,
        reflection: "Felt good writing today",
      });
      const data = parseResult(result);

      expect(data.completed).toBe(true);
      expect(data.quest.status).toBe("completed");
      expect(data.xpGain.xpAdded).toBeGreaterThan(0);
      expect(data.xpGain.totalXp).toBeGreaterThan(0);
    });

    it("returns error for non-existent quest", async () => {
      const tool = createQuestCompleteTool();
      const result = await tool.execute("tc-8", { id: "no-such-quest" });
      const data = parseResult(result);
      expect(data.error).toContain("not found");
    });

    it("returns error when completing an already completed quest", async () => {
      const quest = engine.createQuest({
        title: "Run",
        description: "Go for a run",
        questType: "daily",
        difficulty: "medium",
      });
      engine.completeQuest(quest.id);

      const tool = createQuestCompleteTool();
      const result = await tool.execute("tc-9", { id: quest.id });
      const data = parseResult(result);
      expect(data.error).toContain("not found or not active");
    });

    it("tracks level-up across quest completions", async () => {
      // Create a hard quest for more XP
      const quest = engine.createQuest({
        title: "Deep dive",
        description: "Deep self-analysis",
        questType: "weekly",
        difficulty: "elite",
      });

      const tool = createQuestCompleteTool();
      const result = await tool.execute("tc-10", { id: quest.id });
      const data = parseResult(result);

      expect(data.xpGain.xpAdded).toBeGreaterThan(0);
      expect(typeof data.xpGain.leveledUp).toBe("boolean");
    });
  });

  // ─── Quest Create ──────────────────────────────────────────

  describe("quest_create", () => {
    it("creates a quest with all parameters", async () => {
      const tool = createQuestCreateTool();
      const result = await tool.execute("tc-11", {
        title: "Morning routine",
        description: "Complete full morning routine",
        difficulty: "medium",
        expiresIn: "24h",
      });
      const data = parseResult(result);

      expect(data.created).toBe(true);
      expect(data.quest.title).toBe("Morning routine");
      expect(data.quest.difficulty).toBe("medium");
      expect(data.quest.status).toBe("active");
      expect(data.quest.expiresAt).not.toBeNull();
    });

    it("creates a quest without expiration", async () => {
      const tool = createQuestCreateTool();
      const result = await tool.execute("tc-12", {
        title: "Learn astrology",
        description: "Study basics of natal charts",
        difficulty: "hard",
      });
      const data = parseResult(result);

      expect(data.created).toBe(true);
      expect(data.quest.expiresAt).toBeNull();
    });

    it("supports weekly duration", async () => {
      const tool = createQuestCreateTool();
      const result = await tool.execute("tc-13", {
        title: "Weekly review",
        description: "Do a weekly sync review",
        difficulty: "easy",
        expiresIn: "1w",
      });
      const data = parseResult(result);

      expect(data.created).toBe(true);
      const expires = new Date(data.quest.expiresAt);
      const now = new Date();
      const diffDays = (expires.getTime() - now.getTime()) / 86_400_000;
      // Should be approximately 7 days
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);
    });
  });

  // ─── Uninitialized engine ──────────────────────────────────

  describe("uninitialized engine", () => {
    it("progression_status returns error when engine is null", async () => {
      setProgressionEngine(null as never);
      const tool = createProgressionStatusTool();
      const result = await tool.execute("tc-14", {});
      const data = parseResult(result);
      expect(data.error).toContain("not initialized");
    });
  });
});
