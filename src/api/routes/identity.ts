/**
 * Dashboard API — Identity Routes
 *
 * GET /api/identity/self          — Drofbot's own profile (its chart, its cosmic state)
 * GET /api/identity/relationship  — Operator↔Drofbot cosmic relationship
 */

import { Router, type Request, type Response } from "express";
import type { ArchetypeMapping, BirthMoment, CosmicState } from "../../brain/council/types.js";
import { calculateHarmonicSynthesis } from "../../brain/council/harmonic.js";
import { getCouncil, DROFBOT_DEFAULT_BIRTH } from "../../brain/council/index.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { readConfigFileSnapshot } from "../../shared/config/config.js";
import {
  parseBirthMomentConfig,
  type BirthMomentConfig,
} from "../../shared/config/types.council.js";

const log = createSubsystemLogger("dashboard-api/identity");

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

export const identityRouter: Router = Router();

/**
 * GET /api/identity/self
 * Drofbot's own cosmic state from its birth moment.
 */
identityRouter.get("/self", async (_req: Request, res: Response) => {
  try {
    const snapshot = await readConfigFileSnapshot();
    const cfg = snapshot.valid ? snapshot.config : {};
    const councilCfg = cfg?.council;

    // Resolve Drofbot's birth moment
    const agentBirth: BirthMoment = councilCfg?.agentBirth
      ? parseBirthMomentConfig(councilCfg.agentBirth as BirthMomentConfig)
      : { ...DROFBOT_DEFAULT_BIRTH, datetime: new Date(DROFBOT_DEFAULT_BIRTH.datetime) };

    const council = getCouncil();
    const states = await council.calculateAll(agentBirth);

    const systems: Record<string, unknown> = {};
    for (const [name, state] of states) {
      systems[name] = state;
    }

    const harmony = calculateHarmonicSynthesis(states, deriveArchetypeMappings(states));

    res.json({
      birthMoment: {
        datetime: agentBirth.datetime.toISOString(),
        latitude: agentBirth.latitude,
        longitude: agentBirth.longitude,
        timezone: agentBirth.timezone,
      },
      systems,
      harmony,
    });
  } catch (err) {
    log.error(`Failed to get identity self: ${err}`);
    res.status(500).json({ error: "Failed to get identity" });
  }
});

/**
 * GET /api/identity/relationship
 * Cosmic relationship between operator and Drofbot.
 */
identityRouter.get("/relationship", async (_req: Request, res: Response) => {
  try {
    const snapshot = await readConfigFileSnapshot();
    const cfg = snapshot.valid ? snapshot.config : {};
    const councilCfg = cfg?.council;

    if (!councilCfg?.operatorBirth) {
      res.status(503).json({ error: "Operator birth data not configured" });
      return;
    }

    const operatorBirth = parseBirthMomentConfig(councilCfg.operatorBirth);
    const agentBirth: BirthMoment = councilCfg?.agentBirth
      ? parseBirthMomentConfig(councilCfg.agentBirth as BirthMomentConfig)
      : { ...DROFBOT_DEFAULT_BIRTH, datetime: new Date(DROFBOT_DEFAULT_BIRTH.datetime) };

    const council = getCouncil();

    // Calculate both cosmic states
    const operatorStates = await council.calculateAll(operatorBirth);
    const agentStates = await council.calculateAll(agentBirth);

    // Calculate individual harmonics
    const operatorHarmony = calculateHarmonicSynthesis(
      operatorStates,
      deriveArchetypeMappings(operatorStates),
    );
    const agentHarmony = calculateHarmonicSynthesis(
      agentStates,
      deriveArchetypeMappings(agentStates),
    );

    res.json({
      operator: {
        birthMoment: {
          datetime: operatorBirth.datetime.toISOString(),
          latitude: operatorBirth.latitude,
          longitude: operatorBirth.longitude,
          timezone: operatorBirth.timezone,
        },
        harmony: operatorHarmony,
      },
      agent: {
        birthMoment: {
          datetime: agentBirth.datetime.toISOString(),
          latitude: agentBirth.latitude,
          longitude: agentBirth.longitude,
          timezone: agentBirth.timezone,
        },
        harmony: agentHarmony,
      },
    });
  } catch (err) {
    log.error(`Failed to get relationship: ${err}`);
    res.status(500).json({ error: "Failed to get relationship" });
  }
});
