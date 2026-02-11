/**
 * Council Core — Type Definitions
 *
 * Every metaphysical system in the Council implements the CosmicSystem interface.
 * Adding a new system = implementing this interface + registering it.
 * Zero downstream changes required.
 */

// ─── Enums ───────────────────────────────────────────────────────

export enum Element {
  FIRE = "FIRE",
  WATER = "WATER",
  AIR = "AIR",
  EARTH = "EARTH",
  ETHER = "ETHER",
}

export enum ResonanceType {
  HARMONIC = "HARMONIC", // score >= 0.8
  SUPPORTIVE = "SUPPORTIVE", // score >= 0.6
  NEUTRAL = "NEUTRAL", // score >= 0.4
  CHALLENGING = "CHALLENGING", // score >= 0.2
  DISSONANT = "DISSONANT", // score < 0.2
}

// ─── Birth Data ──────────────────────────────────────────────────

export interface BirthMoment {
  /** Birth date and time */
  datetime: Date;
  /** Birth location latitude */
  latitude: number;
  /** Birth location longitude */
  longitude: number;
  /** IANA timezone string */
  timezone: string;
}

// ─── Cosmic State ────────────────────────────────────────────────

/**
 * The active state of a single cosmic system at a point in time.
 */
export interface CosmicState {
  /** System name (matches CosmicSystem.name) */
  system: string;
  /** When this was calculated */
  timestamp: Date;
  /** The primary active state (varies by system) */
  primary: Record<string, unknown>;
  /** Human-readable summary */
  summary: string;
  /** Numeric values for pattern correlation */
  metrics: Record<string, number>;
}

/**
 * Cross-system archetype mapping for resonance calculation.
 */
export interface ArchetypeMapping {
  system: string;
  /** Element classification for resonance (fire/water/earth/air/ether) */
  elements: Element[];
  /** Archetype tags for cross-system correlation */
  archetypes: string[];
  /** Numeric resonance values (0-1) keyed by archetype dimension */
  resonanceValues: Record<string, number>;
}

/**
 * Cosmic timestamp — the state of ALL registered systems at a point in time.
 * Attached to every memory entry for pattern correlation.
 */
export interface CosmicTimestamp {
  datetime: Date;
  systems: Record<string, CosmicState>;
}

// ─── Recalculation Intervals ─────────────────────────────────────

export type RecalcInterval =
  | { type: "hours"; hours: number } // e.g., lunar phase every 6 hours
  | { type: "daily" } // e.g., gate transit daily
  | { type: "periodic"; days: number } // e.g., magi period every 52 days
  | { type: "realtime"; minutes: number }; // e.g., solar weather every 30 min

// ─── CosmicSystem Interface ──────────────────────────────────────

/**
 * Every metaphysical system in the Council implements this interface.
 * Adding a new system = implementing this interface + registering it.
 * Zero downstream changes required.
 */
export interface CosmicSystem {
  /** Unique identifier, e.g. "cardology", "iching", "human-design" */
  readonly name: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Whether this system requires birth data to function */
  readonly requiresBirthData: boolean;

  /**
   * How often this system should recalculate.
   * Some change hourly (transits), some daily (gates), some weekly (magi periods).
   */
  readonly recalcInterval: RecalcInterval;

  /**
   * Calculate the current state of this system.
   * @param birthMoment - Operator's (or Drofbot's) birth datetime + location
   * @param now - Current datetime (defaults to Date.now())
   * @returns The active state, or null if birth data required but missing
   */
  calculate(birthMoment: BirthMoment | null, now?: Date): Promise<CosmicState | null>;

  /**
   * Generate a natural language synthesis of the current state.
   * Used in briefings and system prompt context.
   */
  synthesize(state: CosmicState): string;

  /**
   * Map the current state to archetypes for cross-system resonance.
   * Returns element/archetype tags that the Harmonic Synthesis Engine
   * uses to calculate resonance between systems.
   */
  archetypes(state: CosmicState): ArchetypeMapping;
}

// ─── Harmonic Synthesis ──────────────────────────────────────────

export interface PairwiseResonance {
  systemA: string;
  systemB: string;
  score: number;
  resonanceType: ResonanceType;
  sharedElements: Element[];
}

export interface HarmonicSynthesis {
  /** 0-1 aggregate resonance score */
  overallResonance: number;
  /** Classification of the overall resonance */
  resonanceType: ResonanceType;
  /** Resonance between each pair of systems */
  pairwise: PairwiseResonance[];
  /** Most active archetypal elements across all systems */
  dominantElements: Element[];
  /** Elemental balance across all systems */
  elementalBalance: Record<Element, number>;
  /** Natural language synthesis */
  guidance: string;
  /** Confidence level based on number of active systems and data quality (0-1) */
  confidence: number;
}

// ─── System Reading (standardized output) ────────────────────────

export interface SystemReading {
  systemName: string;
  primarySymbol: string;
  element: Element;
  archetype: string;
  shadow: string;
  gift: string;
  siddhi: string;
  cycleDay: number;
  cycleTotal: number;
  cyclePercentage: number;
}

// ─── Frequency Band (Gene Keys) ──────────────────────────────────

export enum FrequencyBand {
  SHADOW = "SHADOW", // 0–33% XP
  GIFT = "GIFT", // 34–66% XP
  SIDDHI = "SIDDHI", // 67–100% XP
}

export function getFrequencyBand(xpPercentage: number): FrequencyBand {
  if (xpPercentage <= 33) return FrequencyBand.SHADOW;
  if (xpPercentage <= 66) return FrequencyBand.GIFT;
  return FrequencyBand.SIDDHI;
}

// ─── Helper Functions ────────────────────────────────────────────

export function getResonanceType(score: number): ResonanceType {
  if (score >= 0.8) return ResonanceType.HARMONIC;
  if (score >= 0.6) return ResonanceType.SUPPORTIVE;
  if (score >= 0.4) return ResonanceType.NEUTRAL;
  if (score >= 0.2) return ResonanceType.CHALLENGING;
  return ResonanceType.DISSONANT;
}
