/**
 * Dashboard API — Cosmic Routes
 *
 * GET    /api/cosmic/current    — Current cosmic weather (all 6 systems)
 * GET    /api/cosmic/synthesis  — Full Master Synthesis
 * GET    /api/cosmic/card       — Today's card + planetary period
 * GET    /api/cosmic/gate       — Current gate + line + Gene Keys
 * GET    /api/cosmic/solar      — Space weather
 * GET    /api/cosmic/lunar      — Moon phase
 * GET    /api/cosmic/transits   — Planetary transits + natal aspects
 * POST   /api/cosmic/calculate  — Standalone calculation for any date/person
 */

import { Router, type Request, type Response } from "express";
import type { ArchetypeMapping, CosmicState } from "../../brain/council/types.js";
import { calculateHarmonicSynthesis } from "../../brain/council/harmonic.js";
import { getCouncil, type BirthMoment } from "../../brain/council/index.js";
import { getSynthesisEngine } from "../../brain/synthesis/synthesis-runner.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { readConfigFileSnapshot } from "../../shared/config/config.js";
import { parseBirthMomentConfig } from "../../shared/config/types.council.js";

const log = createSubsystemLogger("dashboard-api/cosmic");

/** Derive archetype mappings from council states. */
function deriveArchetypeMappings(states: Map<string, CosmicState>): ArchetypeMapping[] {
  const council = getCouncil();
  return [...states.entries()]
    .map(([name, state]) => {
      const system = council.getSystem(name);
      return system ? system.archetypes(state) : null;
    })
    .filter((m): m is ArchetypeMapping => m !== null);
}

export const cosmicRouter: Router = Router();

/**
 * Resolve the operator's birth moment from config.
 */
async function resolveOperatorBirth(): Promise<BirthMoment | null> {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) return null;
  const cfg = snapshot.config?.council;
  if (!cfg?.operatorBirth) return null;
  return parseBirthMomentConfig(cfg.operatorBirth);
}

/**
 * GET /api/cosmic/current
 * Returns the current state from all 6 cosmic systems.
 */
cosmicRouter.get("/current", async (_req: Request, res: Response) => {
  try {
    const council = getCouncil();
    const birth = await resolveOperatorBirth();
    const states = await council.calculateAll(birth);

    const systems: Record<string, unknown> = {};
    for (const [name, state] of states) {
      systems[name] = state;
    }

    // Calculate harmonic synthesis
    const harmony = calculateHarmonicSynthesis(states, deriveArchetypeMappings(states));

    res.json({
      timestamp: new Date().toISOString(),
      systems,
      harmony: harmony ?? null,
    });
  } catch (err) {
    log.error(`Failed to get cosmic weather: ${err}`);
    res.status(500).json({ error: "Failed to get cosmic weather" });
  }
});

/**
 * GET /api/cosmic/synthesis
 * Full Master Synthesis (same as system prompt injection).
 */
cosmicRouter.get("/synthesis", async (_req: Request, res: Response) => {
  try {
    const engine = getSynthesisEngine();
    if (!engine) {
      res.status(503).json({ error: "Synthesis engine not initialized" });
      return;
    }

    const synthesis = engine.getCached();
    if (!synthesis) {
      res.status(503).json({ error: "No synthesis available yet" });
      return;
    }

    res.json({ synthesis });
  } catch (err) {
    log.error(`Failed to get synthesis: ${err}`);
    res.status(500).json({ error: "Failed to get synthesis" });
  }
});

/**
 * GET /api/cosmic/card
 * Today's card + planetary period info.
 */
cosmicRouter.get("/card", async (_req: Request, res: Response) => {
  try {
    const council = getCouncil();
    const birth = await resolveOperatorBirth();
    const cardology = council.getSystem("cardology");
    if (!cardology) {
      res.status(503).json({ error: "Cardology system not available" });
      return;
    }

    const state = await cardology.calculate(birth);
    if (!state) {
      res.status(503).json({ error: "Could not calculate card state (birth data needed)" });
      return;
    }

    res.json({
      card: {
        timestamp: state.timestamp.toISOString(),
        ...state.primary,
        summary: state.summary,
      },
    });
  } catch (err) {
    log.error(`Failed to get card: ${err}`);
    res.status(500).json({ error: "Failed to get card" });
  }
});

/**
 * GET /api/cosmic/gate
 * Current I-Ching gate + line + Gene Keys.
 */
cosmicRouter.get("/gate", async (_req: Request, res: Response) => {
  try {
    const council = getCouncil();
    const birth = await resolveOperatorBirth();
    const iching = council.getSystem("iching");
    if (!iching) {
      res.status(503).json({ error: "I-Ching system not available" });
      return;
    }

    const state = await iching.calculate(birth);
    if (!state) {
      res.status(503).json({ error: "Could not calculate gate state" });
      return;
    }

    res.json({
      gate: {
        timestamp: state.timestamp.toISOString(),
        ...state.primary,
        metrics: state.metrics,
        summary: state.summary,
      },
    });
  } catch (err) {
    log.error(`Failed to get gate: ${err}`);
    res.status(500).json({ error: "Failed to get gate" });
  }
});

/**
 * GET /api/cosmic/solar
 * Space weather (Kp index, solar wind, flares).
 */
cosmicRouter.get("/solar", async (_req: Request, res: Response) => {
  try {
    const council = getCouncil();
    const solar = council.getSystem("solar");
    if (!solar) {
      res.status(503).json({ error: "Solar system not available" });
      return;
    }

    const state = await solar.calculate(null); // solar doesn't need birth data
    if (!state) {
      res.status(503).json({ error: "Could not get solar data" });
      return;
    }

    res.json({
      solar: {
        timestamp: state.timestamp.toISOString(),
        ...state.primary,
        metrics: state.metrics,
        summary: state.summary,
      },
    });
  } catch (err) {
    log.error(`Failed to get solar data: ${err}`);
    res.status(500).json({ error: "Failed to get solar data" });
  }
});

/**
 * GET /api/cosmic/lunar
 * Moon phase, illumination, zodiac position.
 */
cosmicRouter.get("/lunar", async (_req: Request, res: Response) => {
  try {
    const council = getCouncil();
    const lunar = council.getSystem("lunar");
    if (!lunar) {
      res.status(503).json({ error: "Lunar system not available" });
      return;
    }

    const state = await lunar.calculate(null); // lunar doesn't need birth data
    if (!state) {
      res.status(503).json({ error: "Could not get lunar data" });
      return;
    }

    res.json({
      lunar: {
        timestamp: state.timestamp.toISOString(),
        ...state.primary,
        metrics: state.metrics,
        summary: state.summary,
      },
    });
  } catch (err) {
    log.error(`Failed to get lunar data: ${err}`);
    res.status(500).json({ error: "Failed to get lunar data" });
  }
});

/**
 * GET /api/cosmic/transits
 * Planetary transit positions + natal aspects.
 */
cosmicRouter.get("/transits", async (_req: Request, res: Response) => {
  try {
    const council = getCouncil();
    const birth = await resolveOperatorBirth();
    const transits = council.getSystem("transits");
    if (!transits) {
      res.status(503).json({ error: "Transit system not available" });
      return;
    }

    const state = await transits.calculate(birth);
    if (!state) {
      res.status(503).json({ error: "Could not get transit data" });
      return;
    }

    res.json({
      transits: {
        timestamp: state.timestamp.toISOString(),
        ...state.primary,
        metrics: state.metrics,
        summary: state.summary,
      },
    });
  } catch (err) {
    log.error(`Failed to get transits: ${err}`);
    res.status(500).json({ error: "Failed to get transits" });
  }
});

/**
 * POST /api/cosmic/calculate
 * Standalone cosmic calculation for any date/person.
 */
cosmicRouter.post("/calculate", async (req: Request, res: Response) => {
  try {
    const { datetime, latitude, longitude, timezone, systems } = req.body as {
      datetime?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
      systems?: string[];
    };

    if (!datetime) {
      res.status(400).json({ error: "datetime is required" });
      return;
    }

    const birth: BirthMoment | null =
      latitude != null && longitude != null && timezone
        ? {
            datetime: new Date(datetime),
            latitude,
            longitude,
            timezone,
          }
        : null;

    const council = getCouncil();
    const now = new Date(datetime);
    const allStates = await council.calculateAll(birth, now);

    // Filter to requested systems if specified
    const result: Record<string, unknown> = {};
    for (const [name, state] of allStates) {
      if (!systems || systems.includes(name)) {
        result[name] = state;
      }
    }

    const harmony = calculateHarmonicSynthesis(allStates, deriveArchetypeMappings(allStates));

    res.json({
      datetime: now.toISOString(),
      systems: result,
      harmony,
    });
  } catch (err) {
    log.error(`Failed to calculate: ${err}`);
    res.status(500).json({ error: "Failed to calculate" });
  }
});
