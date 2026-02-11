/**
 * Dashboard API — Memory Routes
 *
 * GET /api/memory/recent  — Recent memories across all banks
 * GET /api/memory/search  — Semantic search across memories
 * GET /api/memory/stats   — Memory bank statistics
 */

import { Router, type Request, type Response } from "express";
import { getDrofbotMemory } from "../../brain/memory/drofbot-memory.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../shared/database/client.js";

const log = createSubsystemLogger("dashboard-api/memory");

export const memoryRouter: Router = Router();

/**
 * GET /api/memory/recent
 * Recent memories across all banks.
 *
 * Query params:
 *   limit — max entries per bank (default 10, max 50)
 *   bank  — specific bank: episodic, semantic, procedural, relational (default: all)
 */
memoryRouter.get("/recent", async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const client = getSupabaseClient();
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const bank = req.query.bank as string | undefined;

    const result: Record<string, unknown[]> = {};

    const banks = bank ? [bank] : ["episodic", "semantic", "procedural", "relational"];

    for (const bankName of banks) {
      const tableName = `memory_${bankName}`;
      try {
        const orderCol = bankName === "relational" ? "created_at" : "created_at";
        const { data, error } = await client
          .from(tableName)
          .select("*")
          .order(orderCol, { ascending: false })
          .limit(limit);

        if (!error && data) {
          result[bankName] = data;
        } else {
          result[bankName] = [];
        }
      } catch {
        result[bankName] = [];
      }
    }

    res.json(result);
  } catch (err) {
    log.error(`Failed to get recent memories: ${err}`);
    res.status(500).json({ error: "Failed to get recent memories" });
  }
});

/**
 * GET /api/memory/search
 * Semantic search across memory banks.
 *
 * Query params:
 *   q     — search query (required)
 *   bank  — bank to search: episodic, semantic, procedural, relational (default: episodic)
 *   limit — max results (default 10, max 50)
 */
memoryRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }

    const memory = getDrofbotMemory();
    if (!memory.isStructuredMemoryAvailable) {
      res.status(503).json({ error: "Structured memory not available" });
      return;
    }

    const bankName = (req.query.bank as string) || "episodic";
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    let results: unknown[] = [];

    switch (bankName) {
      case "episodic":
        results = await memory.episodic.search({ query, limit });
        break;
      case "semantic":
        results = await memory.semantic.search({ query, limit });
        break;
      case "procedural":
        results = await memory.procedural.search({ query, limit });
        break;
      case "relational":
        results = await memory.relational.search({ query, limit });
        break;
      default:
        res.status(400).json({ error: `Unknown bank: ${bankName}` });
        return;
    }

    res.json({
      query,
      bank: bankName,
      results,
      total: results.length,
    });
  } catch (err) {
    log.error(`Failed to search memories: ${err}`);
    res.status(500).json({ error: "Failed to search memories" });
  }
});

/**
 * GET /api/memory/stats
 * Memory bank statistics (entry counts, sizes).
 */
memoryRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const client = getSupabaseClient();
    const stats: Record<string, { count: number }> = {};

    const banks = ["episodic", "semantic", "procedural", "relational"];
    for (const bank of banks) {
      try {
        const { count, error } = await client
          .from(`memory_${bank}`)
          .select("*", { count: "exact", head: true });

        stats[bank] = { count: error ? 0 : (count ?? 0) };
      } catch {
        stats[bank] = { count: 0 };
      }
    }

    res.json({ stats });
  } catch (err) {
    log.error(`Failed to get memory stats: ${err}`);
    res.status(500).json({ error: "Failed to get memory stats" });
  }
});
