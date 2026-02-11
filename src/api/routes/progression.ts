/**
 * Dashboard API — Progression Routes
 *
 * GET    /api/progression          — Current stats (XP, level, rank, streak)
 * GET    /api/quests               — Active/completed/expired quests
 * POST   /api/quests/:id/complete  — Complete a quest with optional reflection
 * POST   /api/quests               — Create a custom quest
 */

import { Router, type Request, type Response } from "express";
import type { QuestDifficulty, QuestStatus, QuestType } from "../../brain/progression/types.js";
import { getProgressionEngine } from "../../brain/progression/tools.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("dashboard-api/progression");

export const progressionRouter: Router = Router();

/**
 * GET /api/progression
 * Current progression stats.
 */
progressionRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const engine = getProgressionEngine();
    if (!engine) {
      res.status(503).json({ error: "Progression engine not initialized" });
      return;
    }

    const stats = engine.getStats();
    const xpToNext = engine.getXPToNextLevel();
    const levelProgress = engine.getLevelProgress();

    res.json({
      stats: {
        level: stats.currentLevel,
        xp: stats.totalXp,
        rank: stats.currentRank,
        xpToNextLevel: xpToNext,
        levelProgress,
        streakDays: stats.streakDays,
        syncRate: stats.syncRate,
      },
    });
  } catch (err) {
    log.error(`Failed to get progression stats: ${err}`);
    res.status(500).json({ error: "Failed to get progression stats" });
  }
});

/**
 * GET /api/quests
 * List quests with optional status filter.
 *
 * Query params:
 *   status — filter by: active, completed, expired, abandoned
 */
progressionRouter.get("/quests", async (req: Request, res: Response) => {
  try {
    const engine = getProgressionEngine();
    if (!engine) {
      res.status(503).json({ error: "Progression engine not initialized" });
      return;
    }

    const statusFilter = req.query.status as QuestStatus | undefined;
    let quests = engine.getAllQuests();

    if (statusFilter) {
      quests = quests.filter((q) => q.status === statusFilter);
    }

    // Sort: active first, then by assignedAt descending
    quests.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return b.assignedAt.getTime() - a.assignedAt.getTime();
    });

    res.json({ quests, total: quests.length });
  } catch (err) {
    log.error(`Failed to list quests: ${err}`);
    res.status(500).json({ error: "Failed to list quests" });
  }
});

/**
 * POST /api/quests/:id/complete
 * Complete a quest with optional reflection.
 */
progressionRouter.post("/quests/:id/complete", async (req: Request, res: Response) => {
  try {
    const engine = getProgressionEngine();
    if (!engine) {
      res.status(503).json({ error: "Progression engine not initialized" });
      return;
    }

    const { reflection } = req.body as { reflection?: string };
    const result = engine.completeQuest(String(req.params.id));

    if (!result) {
      res.status(404).json({ error: "Quest not found or not completable" });
      return;
    }

    res.json({
      ...result,
      reflection: reflection ?? null,
    });
  } catch (err) {
    log.error(`Failed to complete quest: ${err}`);
    res.status(500).json({ error: "Failed to complete quest" });
  }
});

/**
 * POST /api/quests
 * Create a custom quest.
 */
progressionRouter.post("/quests", async (req: Request, res: Response) => {
  try {
    const engine = getProgressionEngine();
    if (!engine) {
      res.status(503).json({ error: "Progression engine not initialized" });
      return;
    }

    const { title, description, difficulty, questType, expiresAt } = req.body as {
      title?: string;
      description?: string;
      difficulty?: QuestDifficulty;
      questType?: QuestType;
      expiresAt?: string;
    };

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const quest = engine.createQuest({
      title: title.trim(),
      description: description?.trim() ?? "",
      difficulty: difficulty ?? "medium",
      questType: questType ?? "personal",
      source: "user",
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json(quest);
  } catch (err) {
    log.error(`Failed to create quest: ${err}`);
    res.status(500).json({ error: "Failed to create quest" });
  }
});
