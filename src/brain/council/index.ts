/**
 * Council Core — Module Entry Point
 *
 * The Council is the perceptual framework through which Drofbot
 * interprets all experience. It is not a feature module — it is
 * the operating system.
 *
 * Usage:
 *   import { getCouncil } from './council/index.js'
 *   const council = getCouncil()
 *   const timestamp = await council.getCosmicTimestamp(birthMoment)
 */

import { CouncilRegistry } from "./registry.js";
import { CardologySystem } from "./systems/cardology.js";
import { HumanDesignSystem } from "./systems/human-design.js";
import { IChingSystem } from "./systems/iching.js";
import { LunarTrackingSystem } from "./systems/lunar.js";
import { SolarTrackingSystem } from "./systems/solar.js";
import { TransitTrackingSystem } from "./systems/transits.js";

export type { CouncilRegistry } from "./registry.js";
export type {
  ArchetypeMapping,
  BirthMoment,
  CosmicState,
  CosmicSystem,
  CosmicTimestamp,
  HarmonicSynthesis,
  PairwiseResonance,
  RecalcInterval,
  SystemReading,
} from "./types.js";
export {
  Element,
  FrequencyBand,
  ResonanceType,
  getFrequencyBand,
  getResonanceType,
} from "./types.js";
export {
  calculateHarmonicSynthesis,
  getElementalCompatibility,
  ELEMENTAL_MATRIX,
  SUIT_TO_ELEMENT,
  CENTER_TO_ELEMENT,
  TRIGRAM_TO_ELEMENT,
} from "./harmonic.js";
export {
  createCosmicSnapshot,
  enrichWithCosmic,
  initEnrichment,
  matchesCosmicFilter,
  type CosmicFilter,
  type CosmicSnapshot,
} from "./enrichment.js";

// Re-export system classes for direct usage
export { CardologySystem } from "./systems/cardology.js";
export { IChingSystem } from "./systems/iching.js";
export { HumanDesignSystem } from "./systems/human-design.js";
export { SolarTrackingSystem } from "./systems/solar.js";
export { LunarTrackingSystem } from "./systems/lunar.js";
export { TransitTrackingSystem } from "./systems/transits.js";

// ─── Singleton ───────────────────────────────────────────────────

let council: CouncilRegistry | null = null;

/**
 * Get the singleton Council Registry with all built-in systems.
 * Lazily creates and registers all systems on first access.
 */
export function getCouncil(): CouncilRegistry {
  if (!council) {
    council = new CouncilRegistry();

    // Register all built-in systems
    council.register(new CardologySystem());
    council.register(new IChingSystem());
    council.register(new HumanDesignSystem());
    council.register(new SolarTrackingSystem());
    council.register(new LunarTrackingSystem());
    council.register(new TransitTrackingSystem());

    // Future: council.register(new VedicAstrologySystem())
    // Future: council.register(new MayanCalendarSystem())
    // Future: council.register(new NumerologySystem())
  }
  return council;
}

/**
 * Reset the singleton (for testing).
 */
export function resetCouncil(): void {
  council = null;
}

/**
 * Drofbot's default birth moment.
 * The fork creation timestamp, configurable via `council.agentBirth`.
 */
export const DROFBOT_DEFAULT_BIRTH = {
  // Drofbot fork creation: use a meaningful default
  datetime: new Date("2025-01-01T00:00:00Z"),
  latitude: 0,
  longitude: 0,
  timezone: "UTC",
} as const;
