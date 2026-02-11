/**
 * Dashboard API — Profile Routes
 *
 * GET /api/profile           — Operator profile (birth data, HD type, etc.)
 * GET /api/profile/synthesis  — Current Master Synthesis document
 */

import { Router, type Request, type Response } from "express";
import { getCouncil } from "../../brain/council/index.js";
import { getDrofbotMemory } from "../../brain/memory/drofbot-memory.js";
import { getSynthesisEngine } from "../../brain/synthesis/synthesis-runner.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { readConfigFileSnapshot } from "../../shared/config/config.js";
import { parseBirthMomentConfig } from "../../shared/config/types.council.js";

const log = createSubsystemLogger("dashboard-api/profile");

export const profileRouter: Router = Router();

/**
 * GET /api/profile
 * Operator profile: birth data, confirmed facts, HD type, etc.
 */
profileRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const snapshot = await readConfigFileSnapshot();
    const cfg = snapshot.valid ? snapshot.config : {};
    const councilCfg = cfg?.council;

    const profile: Record<string, unknown> = {
      birthData: councilCfg?.operatorBirth ?? null,
      enabledSystems: councilCfg?.enabledSystems ?? null,
      primaryChannel: councilCfg?.primaryChannel ?? null,
    };

    // If birth data is available, get HD type and other natal data
    if (councilCfg?.operatorBirth) {
      const birth = parseBirthMomentConfig(councilCfg.operatorBirth);
      const council = getCouncil();
      const hdSystem = council.getSystem("human-design");
      if (hdSystem) {
        const hdState = await hdSystem.calculate(birth);
        if (hdState) {
          profile.humanDesign = hdState.primary;
        }
      }
      const cardSystem = council.getSystem("cardology");
      if (cardSystem) {
        const cardState = await cardSystem.calculate(birth);
        if (cardState) {
          profile.cardology = cardState.primary;
        }
      }
    }

    // Get confirmed facts from semantic memory
    const memory = getDrofbotMemory();
    if (memory.isStructuredMemoryAvailable) {
      try {
        const facts = await memory.semantic.search({
          query: "confirmed fact identity",
          limit: 20,
        });
        profile.confirmedFacts = facts.map((f) => ({
          content: f.entry.content,
          confidence: f.entry.confidence,
          category: f.entry.category,
        }));
      } catch {
        profile.confirmedFacts = [];
      }
    }

    res.json(profile);
  } catch (err) {
    log.error(`Failed to get profile: ${err}`);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

/**
 * GET /api/profile/synthesis
 * Current Master Synthesis document.
 */
profileRouter.get("/synthesis", async (_req: Request, res: Response) => {
  try {
    const engine = getSynthesisEngine();
    if (!engine) {
      res.status(503).json({ error: "Synthesis engine not initialized" });
      return;
    }

    const synthesis = engine.getCached();
    if (!synthesis) {
      res.status(503).json({ error: "No synthesis available" });
      return;
    }

    res.json(synthesis);
  } catch (err) {
    log.error(`Failed to get synthesis: ${err}`);
    res.status(500).json({ error: "Failed to get synthesis" });
  }
});
