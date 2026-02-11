/**
 * Dashboard API — Intelligence Routes
 *
 * GET    /api/hypotheses              — List hypotheses with status filter
 * POST   /api/hypotheses/:id/confirm  — Confirm a hypothesis
 * POST   /api/hypotheses/:id/reject   — Reject a hypothesis
 * GET    /api/patterns                — List Observer patterns
 * GET    /api/patterns/:id            — Pattern detail with statistics
 */

import { Router, type Request, type Response } from "express";
import { HypothesisStatus } from "../../brain/intelligence/hypothesis.js";
import { getHypothesisEngine, getObserver } from "../../brain/intelligence/observer-runner.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("dashboard-api/intelligence");

export const intelligenceRouter: Router = Router();

/**
 * GET /api/hypotheses
 * List hypotheses with optional status filter.
 *
 * Query params:
 *   status — filter by status: FORMING, TESTING, CONFIRMED, REJECTED, STALE
 */
intelligenceRouter.get("/", async (req: Request, res: Response) => {
  try {
    const engine = getHypothesisEngine();
    const statusFilter = req.query.status as string | undefined;

    let hypotheses = engine.getAll();

    if (statusFilter) {
      const validStatus = Object.values(HypothesisStatus);
      if (!validStatus.includes(statusFilter as HypothesisStatus)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatus.join(", ")}`,
        });
        return;
      }
      hypotheses = hypotheses.filter((h) => h.status === statusFilter);
    }

    // Sort by confidence descending, then by updatedAt descending
    hypotheses.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    res.json({ hypotheses, total: hypotheses.length });
  } catch (err) {
    log.error(`Failed to list hypotheses: ${err}`);
    res.status(500).json({ error: "Failed to list hypotheses" });
  }
});

/**
 * POST /api/hypotheses/:id/confirm
 * Confirm a hypothesis (sets status to CONFIRMED).
 */
intelligenceRouter.post("/:id/confirm", async (req: Request, res: Response) => {
  try {
    const engine = getHypothesisEngine();
    const id = String(req.params.id);
    const hypothesis = engine.get(id);

    if (!hypothesis) {
      res.status(404).json({ error: "Hypothesis not found" });
      return;
    }

    const result = engine.userConfirm(id);
    if (!result) {
      res.status(400).json({ error: "Could not confirm hypothesis" });
      return;
    }

    res.json(result);
  } catch (err) {
    log.error(`Failed to confirm hypothesis: ${err}`);
    res.status(500).json({ error: "Failed to confirm hypothesis" });
  }
});

/**
 * POST /api/hypotheses/:id/reject
 * Reject a hypothesis (sets status to REJECTED).
 */
intelligenceRouter.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const engine = getHypothesisEngine();
    const id = String(req.params.id);
    const hypothesis = engine.get(id);

    if (!hypothesis) {
      res.status(404).json({ error: "Hypothesis not found" });
      return;
    }

    const result = engine.userReject(id);
    if (!result) {
      res.status(400).json({ error: "Could not reject hypothesis" });
      return;
    }

    res.json(result);
  } catch (err) {
    log.error(`Failed to reject hypothesis: ${err}`);
    res.status(500).json({ error: "Failed to reject hypothesis" });
  }
});

/**
 * GET /api/patterns
 * List detected Observer patterns sorted by confidence.
 */
intelligenceRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const engine = getHypothesisEngine();
    // Patterns feed hypotheses; return hypotheses grouped by pattern type
    const hypotheses = engine.getAll();

    // Extract unique pattern-derived hypotheses and their evidence
    const patterns = hypotheses.map((h) => ({
      id: h.id,
      type: h.type,
      statement: h.statement,
      confidence: h.confidence,
      status: h.status,
      evidenceCount: h.evidenceRecords.length,
      category: h.category,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    }));

    res.json({ patterns, total: patterns.length });
  } catch (err) {
    log.error(`Failed to list patterns: ${err}`);
    res.status(500).json({ error: "Failed to list patterns" });
  }
});

/**
 * GET /api/patterns/:id
 * Get pattern detail with statistics and evidence chain.
 */
intelligenceRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const engine = getHypothesisEngine();
    const hypothesis = engine.get(String(req.params.id));

    if (!hypothesis) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }

    res.json({
      ...hypothesis,
      evidenceChain: hypothesis.evidenceRecords,
      confidenceHistory: hypothesis.confidenceHistory,
      periodDistribution: hypothesis.periodEvidenceCount,
      gateDistribution: hypothesis.gateEvidenceCount,
    });
  } catch (err) {
    log.error(`Failed to get pattern detail: ${err}`);
    res.status(500).json({ error: "Failed to get pattern" });
  }
});
