/**
 * Agent tools for interacting with the Progression subsystem.
 *
 * Tools:
 *   progression_status — current progression stats
 *   quest_list         — list quests filtered by status
 *   quest_complete     — mark a quest as completed
 *   quest_create       — create a custom quest
 *
 * Same factory pattern as intelligence/tools.ts.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../agent-runner/tools/common.js";
import type { Quest, QuestDifficulty, QuestStatus } from "./types.js";
import { jsonResult, readNumberParam, readStringParam } from "../agent-runner/tools/common.js";
import { ProgressionEngine, type QuestCompletionResult } from "./engine.js";
import { getRankForLevel, xpToNextLevel } from "./types.js";

// ─── Shared State ──────────────────────────────────────────────

let _progressionEngine: ProgressionEngine | null = null;

export function setProgressionEngine(engine: ProgressionEngine): void {
  _progressionEngine = engine;
}

export function getProgressionEngine(): ProgressionEngine | null {
  return _progressionEngine;
}

// ─── Schemas ───────────────────────────────────────────────────

const QUEST_STATUS_VALUES = ["active", "completed", "expired", "abandoned", "all"] as const;
const DIFFICULTY_VALUES = ["easy", "medium", "hard", "elite"] as const;

const ProgressionStatusSchema = Type.Object({});

const QuestListSchema = Type.Object({
  status: Type.Optional(
    Type.Unsafe<string>({
      type: "string",
      enum: [...QUEST_STATUS_VALUES],
      description:
        "Filter by status: active, completed, expired, abandoned, or all. Default: active.",
    }),
  ),
});

const QuestCompleteSchema = Type.Object({
  id: Type.String({ description: "Quest ID to complete." }),
  reflection: Type.Optional(
    Type.String({ description: "Optional reflection on the completed quest." }),
  ),
});

const QuestCreateSchema = Type.Object({
  title: Type.String({ description: "Quest title." }),
  description: Type.String({ description: "Quest description." }),
  difficulty: Type.Unsafe<string>({
    type: "string",
    enum: [...DIFFICULTY_VALUES],
    description: "Difficulty: easy, medium, hard, or elite.",
  }),
  expiresIn: Type.Optional(
    Type.String({
      description: "Expiration duration: e.g. '24h', '7d', '2w'. Default: no expiration.",
    }),
  ),
});

// ─── Quest Summary ─────────────────────────────────────────────

function summarizeQuest(q: Quest) {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    difficulty: q.difficulty,
    xpReward: q.xpReward,
    status: q.status,
    source: q.source,
    cosmicAlignment: q.cosmicAlignment,
    assignedAt: q.assignedAt.toISOString(),
    completedAt: q.completedAt?.toISOString() ?? null,
    expiresAt: q.expiresAt?.toISOString() ?? null,
  };
}

// ─── Duration Parser ───────────────────────────────────────────

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)\s*(h|d|w)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "h":
      return value * 3600_000;
    case "d":
      return value * 86_400_000;
    case "w":
      return value * 7 * 86_400_000;
    default:
      return null;
  }
}

// ─── Tool Factories ────────────────────────────────────────────

export function createProgressionStatusTool(): AnyAgentTool {
  return {
    label: "Progression Status",
    name: "progression_status",
    description:
      "Get current progression stats: XP, level, rank, sync rate, streak, frequency band.",
    parameters: ProgressionStatusSchema,
    execute: async () => {
      const engine = _progressionEngine;
      if (!engine) {
        return jsonResult({ error: "Progression engine not initialized." });
      }

      const stats = engine.getStats();
      const rankDef = getRankForLevel(stats.currentLevel);
      const xpNeeded = xpToNextLevel(stats.totalXp, stats.currentLevel);
      const progress = engine.getLevelProgress();

      return jsonResult({
        level: stats.currentLevel,
        rank: {
          id: rankDef.id,
          title: rankDef.title,
        },
        totalXp: stats.totalXp,
        xpToNextLevel: xpNeeded,
        levelProgress: Math.round(progress * 1000) / 1000,
        syncRate: Math.round(stats.syncRate * 1000) / 1000,
        streakDays: stats.streakDays,
        lastActive: stats.lastActive,
        activeQuests: engine.getActiveQuests().length,
        completedQuests: engine.getCompletedQuests().length,
      });
    },
  };
}

export function createQuestListTool(): AnyAgentTool {
  return {
    label: "Quest List",
    name: "quest_list",
    description: "List quests filtered by status.",
    parameters: QuestListSchema,
    execute: async (_toolCallId, params) => {
      const engine = _progressionEngine;
      if (!engine) {
        return jsonResult({ quests: [], error: "Progression engine not initialized." });
      }

      const statusFilter = readStringParam(params, "status") ?? "active";

      let quests: Quest[];
      switch (statusFilter) {
        case "active":
          quests = engine.getActiveQuests();
          break;
        case "completed":
          quests = engine.getCompletedQuests();
          break;
        case "expired":
          quests = engine.getAllQuests().filter((q) => q.status === "expired");
          break;
        case "abandoned":
          quests = engine.getAllQuests().filter((q) => q.status === "abandoned");
          break;
        default:
          quests = engine.getAllQuests();
          break;
      }

      return jsonResult({
        count: quests.length,
        quests: quests.map(summarizeQuest),
      });
    },
  };
}

export function createQuestCompleteTool(): AnyAgentTool {
  return {
    label: "Quest Complete",
    name: "quest_complete",
    description:
      "Mark a quest as completed. Awards XP, updates level/rank, records cosmic context.",
    parameters: QuestCompleteSchema,
    execute: async (_toolCallId, params) => {
      const engine = _progressionEngine;
      if (!engine) {
        return jsonResult({ error: "Progression engine not initialized." });
      }

      const id = readStringParam(params, "id", { required: true });
      const reflection = readStringParam(params, "reflection");

      const result = engine.completeQuest(id);
      if (!result) {
        return jsonResult({ error: `Quest "${id}" not found or not active.` });
      }

      // Store reflection in quest metadata if provided
      if (reflection) {
        result.quest.metadata = {
          ...result.quest.metadata,
          completionReflection: reflection,
        };
      }

      return jsonResult({
        completed: true,
        quest: summarizeQuest(result.quest),
        xpGain: {
          xpAdded: result.xpGain.xpAdded,
          totalXp: result.xpGain.totalXp,
          previousLevel: result.xpGain.previousLevel,
          newLevel: result.xpGain.newLevel,
          leveledUp: result.xpGain.leveledUp,
          previousRank: result.xpGain.previousRank,
          newRank: result.xpGain.newRank,
          rankChanged: result.xpGain.rankChanged,
        },
        newSyncRate: result.newSyncRate,
        newStreak: result.newStreak,
      });
    },
  };
}

export function createQuestCreateTool(): AnyAgentTool {
  return {
    label: "Quest Create",
    name: "quest_create",
    description: "Create a custom quest from operator request.",
    parameters: QuestCreateSchema,
    execute: async (_toolCallId, params) => {
      const engine = _progressionEngine;
      if (!engine) {
        return jsonResult({ error: "Progression engine not initialized." });
      }

      const title = readStringParam(params, "title", { required: true });
      const description = readStringParam(params, "description", { required: true });
      const difficulty = readStringParam(params, "difficulty", {
        required: true,
      }) as QuestDifficulty;
      const expiresIn = readStringParam(params, "expiresIn");

      let expiresAt: Date | undefined;
      if (expiresIn) {
        const durationMs = parseDuration(expiresIn);
        if (durationMs) {
          expiresAt = new Date(Date.now() + durationMs);
        }
      }

      const quest = engine.createQuest({
        title,
        description,
        questType: "personal",
        difficulty,
        source: "user",
        expiresAt,
      });

      return jsonResult({
        created: true,
        quest: summarizeQuest(quest),
      });
    },
  };
}

// ─── Convenience: all progression tools ────────────────────────

export function createProgressionTools(): AnyAgentTool[] {
  return [
    createProgressionStatusTool(),
    createQuestListTool(),
    createQuestCompleteTool(),
    createQuestCreateTool(),
  ];
}
