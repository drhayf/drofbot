/**
 * Dashboard API — Journal Routes
 *
 * POST /api/journal/entry    — Create journal entry with cosmic enrichment
 * GET  /api/journal/entries  — List entries (paginated, filterable)
 * GET  /api/journal/:id      — Single entry with full cosmic context
 */

import { Router, type Request, type Response } from "express";
import { getHypothesisEngine } from "../../brain/intelligence/observer-runner.js";
import { getDrofbotMemory } from "../../brain/memory/drofbot-memory.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../shared/database/client.js";

const log = createSubsystemLogger("dashboard-api/journal");

export const journalRouter: Router = Router();

/**
 * POST /api/journal/entry
 * Create a new journal entry (gets cosmic enrichment + memory storage).
 */
journalRouter.post("/entry", async (req: Request, res: Response) => {
  try {
    const { content, mood, energy, tags } = req.body as {
      content?: string;
      mood?: number;
      energy?: number;
      tags?: string[];
    };

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    const memory = getDrofbotMemory();
    if (!memory.isStructuredMemoryAvailable) {
      res.status(503).json({ error: "Structured memory not available" });
      return;
    }

    // Store via episodic bank (auto-enriches with cosmic context)
    const id = await memory.episodic.store({
      content: content.trim(),
      context: {
        source: "dashboard",
        mood: mood ?? undefined,
        energy: energy ?? undefined,
        tags: tags ?? undefined,
      },
      importance: 0.7, // journal entries are moderately important
    });

    if (!id) {
      res.status(500).json({ error: "Failed to store journal entry" });
      return;
    }

    // Test against active hypotheses
    let matchedHypotheses: string[] = [];
    try {
      const engine = getHypothesisEngine();
      const hypotheses = engine.getActive();
      matchedHypotheses = hypotheses
        .filter((h) => content.toLowerCase().includes(h.category.toLowerCase()))
        .map((h) => h.id);
    } catch {
      // Non-critical — hypothesis matching is best-effort
    }

    res.status(201).json({
      id,
      matchedHypotheses,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error(`Failed to create journal entry: ${err}`);
    res.status(500).json({ error: "Failed to create journal entry" });
  }
});

/**
 * GET /api/journal/entries
 * List journal entries with pagination and optional filters.
 *
 * Query params:
 *   limit   — max entries (default 20, max 100)
 *   offset  — pagination offset (default 0)
 *   after   — ISO date string, entries after this time
 *   before  — ISO date string, entries before this time
 *   tag     — filter by tag
 */
journalRouter.get("/entries", async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const client = getSupabaseClient();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const after = req.query.after as string | undefined;
    const before = req.query.before as string | undefined;
    const tag = req.query.tag as string | undefined;

    let query = client
      .from("memory_episodic")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (after) {
      query = query.gte("timestamp", after);
    }
    if (before) {
      query = query.lte("timestamp", before);
    }

    const { data, error, count } = await query;

    if (error) {
      log.error(`Failed to list journal entries: ${error.message}`);
      res.status(500).json({ error: "Failed to list entries" });
      return;
    }

    // Filter by tag client-side (JSONB containment is complex without RPC)
    let entries = data ?? [];
    if (tag) {
      entries = entries.filter((e) => {
        const ctx = e.context as Record<string, unknown> | null;
        const tags = ctx?.tags as string[] | undefined;
        return tags?.includes(tag);
      });
    }

    res.json({
      entries,
      total: count ?? entries.length,
      limit,
      offset,
    });
  } catch (err) {
    log.error(`Failed to list journal entries: ${err}`);
    res.status(500).json({ error: "Failed to list entries" });
  }
});

/**
 * GET /api/journal/:id
 * Get a single journal entry with full cosmic context.
 */
journalRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("memory_episodic")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    res.json({ entry: data });
  } catch (err) {
    log.error(`Failed to get journal entry: ${err}`);
    res.status(500).json({ error: "Failed to get entry" });
  }
});
