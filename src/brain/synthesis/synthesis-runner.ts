/**
 * Synthesis Cron Runner
 *
 * Regenerates the Master Synthesis periodically.
 * Designed to be triggered by the cron system or called directly.
 *
 * Schedule: every 1-2 hours, or when cosmic state changes significantly.
 *
 * Flow:
 * 1. Calculate all Council systems
 * 2. Gather active hypotheses and patterns
 * 3. Generate Master Synthesis
 * 4. Generate Self-Model
 * 5. Cache for system prompt injection
 */

import type { BirthMoment, CosmicState, HarmonicSynthesis } from "../council/types.js";
import type { OperatorIdentitySynthesis } from "../identity/operator/types.js";
import type { MasterSynthesis, SelfModel, SynthesisDeps } from "./master.js";
import { generateOperatorSynthesis } from "../identity/operator/identity-synthesis.js";
import { SynthesisEngine } from "./master.js";

// ─── Runner Result ─────────────────────────────────────────────

export interface SynthesisRunResult {
  timestamp: Date;
  synthesisGenerated: boolean;
  selfModelGenerated: boolean;
  operatorIdentityGenerated: boolean;
  renderedLength: number;
  sections: {
    profile: boolean;
    cosmicWeather: boolean;
    intelligence: boolean;
    harmony: boolean;
    progression: boolean;
    operatorIdentity: boolean;
  };
  errors: string[];
}

// ─── Singleton ─────────────────────────────────────────────────

let _synthesisEngine: SynthesisEngine | null = null;

/**
 * Get the singleton SynthesisEngine.
 * Must be initialized before use via configureSynthesisEngine().
 */
export function getSynthesisEngine(): SynthesisEngine | null {
  return _synthesisEngine;
}

/**
 * Configure the singleton SynthesisEngine with dependencies.
 * Call once during application bootstrap.
 */
export function configureSynthesisEngine(
  deps: SynthesisDeps,
  operatorBirth: BirthMoment | null,
  agentBirth: BirthMoment | null,
): SynthesisEngine {
  _synthesisEngine = new SynthesisEngine(deps, operatorBirth, agentBirth);
  return _synthesisEngine;
}

/** For testing: reset singleton */
export function resetSynthesisSingleton(): void {
  _synthesisEngine = null;
}

/**
 * Get the cached synthesis context string (rendered Master Synthesis).
 * Returns null if the synthesis engine is not configured or hasn't run yet.
 * Used for injection into the agent system prompt.
 */
export function getSynthesisContext(): string | null {
  const cached = _synthesisEngine?.getCached();
  return cached?.rendered ?? null;
}

// ─── Runner ────────────────────────────────────────────────────

/**
 * Run a full synthesis cycle.
 *
 * @param engine - SynthesisEngine instance (uses singleton if omitted)
 * @returns Result summary for logging
 */
export async function runSynthesisCycle(engine?: SynthesisEngine): Promise<SynthesisRunResult> {
  const now = new Date();
  const errors: string[] = [];
  const target = engine ?? _synthesisEngine;

  if (!target) {
    return {
      timestamp: now,
      synthesisGenerated: false,
      selfModelGenerated: false,
      operatorIdentityGenerated: false,
      renderedLength: 0,
      sections: {
        profile: false,
        cosmicWeather: false,
        intelligence: false,
        harmony: false,
        progression: false,
        operatorIdentity: false,
      },
      errors: ["SynthesisEngine not configured. Call configureSynthesisEngine() first."],
    };
  }

  let synthesis: MasterSynthesis | null = null;
  let selfModel: SelfModel | null = null;
  let operatorIdentity: OperatorIdentitySynthesis | null = null;

  // Generate Master Synthesis
  try {
    synthesis = await target.generateMasterSynthesis();
  } catch (err) {
    errors.push(`Master synthesis failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Generate Self-Model
  try {
    selfModel = await target.generateSelfModel();
  } catch (err) {
    errors.push(`Self-model failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Generate Operator Identity Synthesis (Phase 6)
  try {
    operatorIdentity = await generateOperatorSynthesis();
  } catch (err) {
    errors.push(
      `Operator identity synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    timestamp: now,
    synthesisGenerated: synthesis !== null,
    selfModelGenerated: selfModel !== null,
    operatorIdentityGenerated: operatorIdentity !== null,
    renderedLength: (synthesis?.rendered.length ?? 0) + (operatorIdentity?.rendered.length ?? 0),
    sections: {
      profile: (synthesis?.profile.length ?? 0) > 0,
      cosmicWeather: (synthesis?.cosmicWeather.length ?? 0) > 0,
      intelligence: (synthesis?.intelligence.length ?? 0) > 0,
      harmony: (synthesis?.harmony.length ?? 0) > 0,
      progression: (synthesis?.progression.length ?? 0) > 0,
      operatorIdentity: (operatorIdentity?.rendered.length ?? 0) > 0,
    },
    errors,
  };
}
