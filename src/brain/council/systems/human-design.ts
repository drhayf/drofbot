/**
 * Human Design System — Type, Authority, Profile, Centers, Channels
 *
 * Ported from GUTTERS:
 *   `modules/calculation/human_design/brain/constants.py`
 *   `modules/calculation/human_design/brain/mechanics.py`
 *
 * Key algorithms:
 *   - Type determination: Reflector / Manifestor / Generator / MG / Projector
 *     via defined centers + BFS motor-to-throat detection
 *   - Profile: from conscious/unconscious Sun gate lines
 *   - Design date: Sun longitude − 88° (solar arc)
 *   - Gate activations from ecliptic longitude (re-uses iching.ts's
 *     longitudeToActivation)
 *
 * Requires birth data (date, time, location).
 */

import type { ArchetypeMapping, BirthMoment, CosmicState, CosmicSystem } from "../types.js";
import { Element } from "../types.js";
// Re-use the I-Ching gate activation algorithm
import { approximateSunLongitude, longitudeToActivation } from "./iching.js";

// ─── HD Types & Enums ───────────────────────────────────────────

export enum HDType {
  REFLECTOR = "Reflector",
  MANIFESTOR = "Manifestor",
  GENERATOR = "Generator",
  MANIFESTING_GENERATOR = "Manifesting Generator",
  PROJECTOR = "Projector",
}

export type CenterName =
  | "Head"
  | "Ajna"
  | "Throat"
  | "G"
  | "Heart"
  | "Sacral"
  | "SolarPlexus"
  | "Spleen"
  | "Root";

export const ALL_CENTERS: CenterName[] = [
  "Head",
  "Ajna",
  "Throat",
  "G",
  "Heart",
  "Sacral",
  "SolarPlexus",
  "Spleen",
  "Root",
];

// ─── Gate-to-Center Mapping (GUTTERS constants.py) ──────────────

export const GATE_TO_CENTER: Record<number, CenterName> = {
  // Head (3 gates)
  64: "Head",
  61: "Head",
  63: "Head",
  // Ajna (6 gates)
  47: "Ajna",
  24: "Ajna",
  4: "Ajna",
  17: "Ajna",
  43: "Ajna",
  11: "Ajna",
  // Throat (11 gates)
  62: "Throat",
  23: "Throat",
  56: "Throat",
  35: "Throat",
  12: "Throat",
  45: "Throat",
  33: "Throat",
  8: "Throat",
  31: "Throat",
  20: "Throat",
  16: "Throat",
  // G Center (8 gates)
  7: "G",
  1: "G",
  13: "G",
  10: "G",
  15: "G",
  46: "G",
  25: "G",
  2: "G",
  // Heart/Ego (4 gates)
  26: "Heart",
  51: "Heart",
  21: "Heart",
  40: "Heart",
  // Sacral (9 gates)
  5: "Sacral",
  14: "Sacral",
  29: "Sacral",
  59: "Sacral",
  9: "Sacral",
  3: "Sacral",
  42: "Sacral",
  27: "Sacral",
  34: "Sacral",
  // Solar Plexus (7 gates)
  6: "SolarPlexus",
  37: "SolarPlexus",
  22: "SolarPlexus",
  36: "SolarPlexus",
  30: "SolarPlexus",
  55: "SolarPlexus",
  49: "SolarPlexus",
  // Spleen (7 gates)
  48: "Spleen",
  57: "Spleen",
  44: "Spleen",
  50: "Spleen",
  28: "Spleen",
  32: "Spleen",
  18: "Spleen",
  // Root (9 gates)
  38: "Root",
  54: "Root",
  53: "Root",
  60: "Root",
  52: "Root",
  19: "Root",
  39: "Root",
  41: "Root",
  58: "Root",
};

// ─── Channel Definitions (GUTTERS constants.py, 36 channels) ────

export interface ChannelDef {
  gate1: number;
  gate2: number;
  center1: CenterName;
  center2: CenterName;
  name: string;
}

export const CHANNELS: ChannelDef[] = [
  // Head → Ajna
  { gate1: 64, gate2: 47, center1: "Head", center2: "Ajna", name: "Abstraction" },
  { gate1: 61, gate2: 24, center1: "Head", center2: "Ajna", name: "Awareness" },
  { gate1: 63, gate2: 4, center1: "Head", center2: "Ajna", name: "Logic" },
  // Ajna → Throat
  { gate1: 17, gate2: 62, center1: "Ajna", center2: "Throat", name: "Acceptance" },
  { gate1: 43, gate2: 23, center1: "Ajna", center2: "Throat", name: "Structuring" },
  { gate1: 11, gate2: 56, center1: "Ajna", center2: "Throat", name: "Curiosity" },
  // Throat → Spleen
  { gate1: 16, gate2: 48, center1: "Throat", center2: "Spleen", name: "Wavelength" },
  { gate1: 20, gate2: 57, center1: "Throat", center2: "Spleen", name: "Brainwave" },
  // Throat → Sacral
  { gate1: 20, gate2: 34, center1: "Throat", center2: "Sacral", name: "Charisma" },
  // Throat → G
  { gate1: 20, gate2: 10, center1: "Throat", center2: "G", name: "Awakening" },
  { gate1: 31, gate2: 7, center1: "Throat", center2: "G", name: "Alpha" },
  { gate1: 8, gate2: 1, center1: "Throat", center2: "G", name: "Inspiration" },
  { gate1: 33, gate2: 13, center1: "Throat", center2: "G", name: "Prodigal" },
  // Throat → Heart
  { gate1: 45, gate2: 21, center1: "Throat", center2: "Heart", name: "Money" },
  // Throat → Solar Plexus
  { gate1: 35, gate2: 36, center1: "Throat", center2: "SolarPlexus", name: "Transitoriness" },
  { gate1: 12, gate2: 22, center1: "Throat", center2: "SolarPlexus", name: "Openness" },
  // Spleen → Root
  { gate1: 32, gate2: 54, center1: "Spleen", center2: "Root", name: "Transformation" },
  { gate1: 28, gate2: 38, center1: "Spleen", center2: "Root", name: "Struggle" },
  { gate1: 18, gate2: 58, center1: "Spleen", center2: "Root", name: "Judgment" },
  // Spleen → Sacral
  { gate1: 57, gate2: 34, center1: "Spleen", center2: "Sacral", name: "Power" },
  { gate1: 50, gate2: 27, center1: "Spleen", center2: "Sacral", name: "Preservation" },
  // G → Sacral
  { gate1: 10, gate2: 34, center1: "G", center2: "Sacral", name: "Exploration" },
  { gate1: 15, gate2: 5, center1: "G", center2: "Sacral", name: "Rhythm" },
  { gate1: 2, gate2: 14, center1: "G", center2: "Sacral", name: "Beat" },
  { gate1: 46, gate2: 29, center1: "G", center2: "Sacral", name: "Discovery" },
  // G → Spleen
  { gate1: 10, gate2: 57, center1: "G", center2: "Spleen", name: "Perfected Form" },
  // G → Heart
  { gate1: 25, gate2: 51, center1: "G", center2: "Heart", name: "Initiation" },
  // Sacral → Solar Plexus
  { gate1: 59, gate2: 6, center1: "Sacral", center2: "SolarPlexus", name: "Mating" },
  // Sacral → Root
  { gate1: 42, gate2: 53, center1: "Sacral", center2: "Root", name: "Maturation" },
  { gate1: 3, gate2: 60, center1: "Sacral", center2: "Root", name: "Mutation" },
  { gate1: 9, gate2: 52, center1: "Sacral", center2: "Root", name: "Concentration" },
  // Heart → Spleen
  { gate1: 26, gate2: 44, center1: "Heart", center2: "Spleen", name: "Surrender" },
  // Heart → Solar Plexus
  { gate1: 40, gate2: 37, center1: "Heart", center2: "SolarPlexus", name: "Community" },
  // Solar Plexus → Root
  { gate1: 49, gate2: 19, center1: "SolarPlexus", center2: "Root", name: "Synthesis" },
  { gate1: 55, gate2: 39, center1: "SolarPlexus", center2: "Root", name: "Emoting" },
  { gate1: 30, gate2: 41, center1: "SolarPlexus", center2: "Root", name: "Recognition" },
];

// ─── Motor Centers (GUTTERS mechanics.py) ────────────────────────

const MOTOR_CENTERS: CenterName[] = ["Heart", "SolarPlexus", "Sacral", "Root"];

// ─── Gate Activation ─────────────────────────────────────────────

export interface GateActivation {
  gate: number;
  line: number;
  center: CenterName;
}

/**
 * Get gate activations for a set of planet positions.
 * In a full HD chart, 13 planets are used. Here we use
 * Sun, Earth, and Moon as the primary activations.
 */
function getActivationsFromLongitudes(longitudes: number[]): GateActivation[] {
  const activations: GateActivation[] = [];
  for (const lon of longitudes) {
    const { gate, line } = longitudeToActivation(lon);
    const center = GATE_TO_CENTER[gate];
    if (center) {
      activations.push({ gate, line, center });
    }
  }
  return activations;
}

// ─── Channel Detection ──────────────────────────────────────────

export interface ActiveChannel {
  gate1: number;
  gate2: number;
  center1: CenterName;
  center2: CenterName;
  name: string;
}

/**
 * Find which channels are defined (both gates activated).
 */
export function findActiveChannels(activeGates: Set<number>): ActiveChannel[] {
  const channels: ActiveChannel[] = [];
  for (const ch of CHANNELS) {
    if (activeGates.has(ch.gate1) && activeGates.has(ch.gate2)) {
      channels.push({
        gate1: ch.gate1,
        gate2: ch.gate2,
        center1: ch.center1,
        center2: ch.center2,
        name: ch.name,
      });
    }
  }
  return channels;
}

// ─── Defined Centers ─────────────────────────────────────────────

/**
 * A center is "defined" when it has at least one complete channel
 * connecting it to another center.
 */
export function findDefinedCenters(channels: ActiveChannel[]): Set<CenterName> {
  const defined = new Set<CenterName>();
  for (const ch of channels) {
    defined.add(ch.center1);
    defined.add(ch.center2);
  }
  return defined;
}

// ─── BFS Motor-to-Throat (GUTTERS mechanics.py §3.9) ────────────

/**
 * Build center adjacency from active channels.
 * Only defined channels create connections.
 */
function buildCenterAdjacency(channels: ActiveChannel[]): Map<CenterName, Set<CenterName>> {
  const adj = new Map<CenterName, Set<CenterName>>();
  for (const ch of channels) {
    if (!adj.has(ch.center1)) adj.set(ch.center1, new Set());
    if (!adj.has(ch.center2)) adj.set(ch.center2, new Set());
    adj.get(ch.center1)!.add(ch.center2);
    adj.get(ch.center2)!.add(ch.center1);
  }
  return adj;
}

/**
 * BFS from a motor center to Throat through defined centers.
 */
function bfsPathExists(
  start: CenterName,
  target: CenterName,
  definedCenters: Set<CenterName>,
  adjacency: Map<CenterName, Set<CenterName>>,
): boolean {
  if (!definedCenters.has(start)) return false;
  if (start === target) return true;

  const visited = new Set<CenterName>();
  const queue: CenterName[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (neighbor === target) return true;
      if (!visited.has(neighbor) && definedCenters.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}

/**
 * Check if any motor center has a path to the Throat.
 * GUTTERS §3.9: BFS from each motor center through defined centers.
 */
export function checkMotorToThroat(
  definedCenters: Set<CenterName>,
  channels: ActiveChannel[],
): boolean {
  const adjacency = buildCenterAdjacency(channels);

  for (const motor of MOTOR_CENTERS) {
    if (!definedCenters.has(motor)) continue;
    if (bfsPathExists(motor, "Throat", definedCenters, adjacency)) {
      return true;
    }
  }
  return false;
}

// ─── Type Determination (GUTTERS §3.9) ──────────────────────────

/**
 * Determine Human Design Type from defined centers and channels.
 *
 * Algorithm:
 *   - No defined centers → Reflector
 *   - Sacral defined + motor-to-throat → Manifesting Generator
 *   - Sacral defined (no motor-to-throat) → Generator
 *   - Motor-to-throat (no Sacral) → Manifestor
 *   - Otherwise → Projector
 */
export function determineType(definedCenters: Set<CenterName>, channels: ActiveChannel[]): HDType {
  if (definedCenters.size === 0) return HDType.REFLECTOR;

  const hasSacral = definedCenters.has("Sacral");
  const motorToThroat = checkMotorToThroat(definedCenters, channels);

  if (hasSacral && motorToThroat) return HDType.MANIFESTING_GENERATOR;
  if (hasSacral) return HDType.GENERATOR;
  if (motorToThroat) return HDType.MANIFESTOR;
  return HDType.PROJECTOR;
}

// ─── Authority Determination ─────────────────────────────────────

export type Authority =
  | "Emotional"
  | "Sacral"
  | "Splenic"
  | "Ego Manifested"
  | "Ego Projected"
  | "Self-Projected"
  | "Mental"
  | "Lunar";

/**
 * Determine inner authority from defined centers and type.
 * Priority order (highest to lowest):
 *   Solar Plexus → Sacral → Spleen → Heart → G → Ajna/Head → Lunar
 */
export function determineAuthority(definedCenters: Set<CenterName>, hdType: HDType): Authority {
  if (hdType === HDType.REFLECTOR) return "Lunar";

  if (definedCenters.has("SolarPlexus")) return "Emotional";
  if (definedCenters.has("Sacral")) return "Sacral";
  if (definedCenters.has("Spleen")) return "Splenic";

  if (definedCenters.has("Heart")) {
    // Ego Manifested if Throat is also defined, else Ego Projected
    return definedCenters.has("Throat") ? "Ego Manifested" : "Ego Projected";
  }

  if (definedCenters.has("G")) return "Self-Projected";

  return "Mental";
}

// ─── Profile (GUTTERS §3.10) ────────────────────────────────────

/**
 * Calculate profile from conscious Sun line and design (unconscious) Sun line.
 */
export function calculateProfile(personalitySunLine: number, designSunLine: number): string {
  return `${personalitySunLine}/${designSunLine}`;
}

// ─── Design Date (GUTTERS §3.6) ─────────────────────────────────

/**
 * Calculate the "Design" datetime — when the Sun was exactly 88°
 * earlier in ecliptic longitude before birth.
 *
 * This is NOT 88 calendar days — it's 88° of solar motion (~88.5 days).
 * Uses iterative refinement (simplified binary search).
 */
export function calculateDesignDate(birthDate: Date): Date {
  const birthSunLong = approximateSunLongitude(birthDate);
  const designLong = (((birthSunLong - 88) % 360) + 360) % 360;

  // Initial guess: ~88.5 days before birth
  let dt = new Date(birthDate.getTime() - 88.5 * 86_400_000);

  // Binary search: refine until sun longitude matches within 0.1°
  let step = 5 * 86_400_000; // 5-day steps
  for (let i = 0; i < 30; i++) {
    const currentLong = approximateSunLongitude(dt);
    const diff = (((currentLong - designLong) % 360) + 360) % 360;

    if (diff < 0.1 || diff > 359.9) break; // close enough

    // If we overshot (past the target), go forward; otherwise go back
    if (diff > 180) {
      dt = new Date(dt.getTime() + step);
    } else {
      dt = new Date(dt.getTime() - step);
    }
    step = Math.max(step / 2, 3_600_000); // halve step, min 1 hour
  }

  return dt;
}

// ─── HD Chart ────────────────────────────────────────────────────

export interface HumanDesignChart {
  type: HDType;
  authority: Authority;
  profile: string;
  personalitySun: GateActivation;
  personalityEarth: GateActivation;
  designSun: GateActivation;
  designEarth: GateActivation;
  activeGates: number[];
  definedCenters: CenterName[];
  undefinedCenters: CenterName[];
  definedChannels: ActiveChannel[];
}

/**
 * Calculate a full Human Design chart from birth moment.
 */
export function calculateChart(birth: BirthMoment): HumanDesignChart {
  // Personality (conscious): birth time
  const personalitySunLong = approximateSunLongitude(birth.datetime);
  const personalityEarthLong = (personalitySunLong + 180) % 360;

  // Design (unconscious): ~88° earlier
  const designDate = calculateDesignDate(birth.datetime);
  const designSunLong = approximateSunLongitude(designDate);
  const designEarthLong = (designSunLong + 180) % 360;

  // Get all 4 primary activations
  const longitudes = [personalitySunLong, personalityEarthLong, designSunLong, designEarthLong];

  const activations = getActivationsFromLongitudes(longitudes);
  const personalitySun = activations[0]!;
  const personalityEarth = activations[1]!;
  const designSun = activations[2]!;
  const designEarth = activations[3]!;

  // Collect all active gates
  const activeGateSet = new Set(activations.map((a) => a.gate));

  // Find defined channels + centers
  const definedChannels = findActiveChannels(activeGateSet);
  const definedCenters = findDefinedCenters(definedChannels);

  // Determine type and authority
  const type = determineType(definedCenters, definedChannels);
  const authority = determineAuthority(definedCenters, type);

  // Profile
  const profile = calculateProfile(personalitySun.line, designSun.line);

  // Undefined centers
  const undefinedCenters = ALL_CENTERS.filter((c) => !definedCenters.has(c));

  return {
    type,
    authority,
    profile,
    personalitySun,
    personalityEarth,
    designSun,
    designEarth,
    activeGates: [...activeGateSet].sort((a, b) => a - b),
    definedCenters: [...definedCenters],
    undefinedCenters,
    definedChannels,
  };
}

// ─── Human Design System ─────────────────────────────────────────

export class HumanDesignSystem implements CosmicSystem {
  readonly name = "human-design";
  readonly displayName = "Human Design";
  readonly requiresBirthData = true;
  readonly recalcInterval = { type: "daily" as const };

  // Natal chart cache (calculated once per birth moment, cached permanently)
  private natalCache = new Map<string, HumanDesignChart>();

  async calculate(birth: BirthMoment | null, now?: Date): Promise<CosmicState | null> {
    if (!birth) return null;

    const dt = now ?? new Date();

    // Get or compute natal chart (cached permanently)
    const cacheKey = birth.datetime.toISOString();
    let natal = this.natalCache.get(cacheKey);
    if (!natal) {
      natal = calculateChart(birth);
      this.natalCache.set(cacheKey, natal);
    }

    // Current transit gate activations
    const transitSunLong = approximateSunLongitude(dt);
    const transitEarthLong = (transitSunLong + 180) % 360;
    const transitActivations = getActivationsFromLongitudes([transitSunLong, transitEarthLong]);
    const transitGates = transitActivations.map((a) => a.gate);

    // Check if transit gates complete any additional channels with natal gates
    const combinedGates = new Set([...natal.activeGates, ...transitGates]);
    const allChannels = findActiveChannels(combinedGates);
    const transitNewChannels = allChannels.filter(
      (ch) => !natal!.definedChannels.some((nc) => nc.gate1 === ch.gate1 && nc.gate2 === ch.gate2),
    );

    return {
      system: "human-design",
      timestamp: dt,
      primary: {
        type: natal.type,
        authority: natal.authority,
        profile: natal.profile,
        definedCenters: natal.definedCenters,
        undefinedCenters: natal.undefinedCenters,
        definedChannels: natal.definedChannels.map((c) => c.name),
        activeGates: natal.activeGates,
        transitGates,
        transitNewChannels: transitNewChannels.map((c) => c.name),
      },
      summary:
        `${natal.type} (${natal.authority} Authority, ${natal.profile} Profile). ` +
        `${natal.definedChannels.length} channels, ` +
        `${natal.definedCenters.length} defined centers. ` +
        (transitNewChannels.length > 0
          ? `Transit completing: ${transitNewChannels.map((c) => c.name).join(", ")}.`
          : "No transit channel completions."),
      metrics: {
        definedCenterCount: natal.definedCenters.length,
        undefinedCenterCount: natal.undefinedCenters.length,
        channelCount: natal.definedChannels.length,
        activeGateCount: natal.activeGates.length,
        transitGateCount: transitGates.length,
        transitNewChannelCount: transitNewChannels.length,
      },
    };
  }

  synthesize(state: CosmicState): string {
    return state.summary;
  }

  archetypes(state: CosmicState): ArchetypeMapping {
    const type = (state.primary as Record<string, unknown>).type as string;

    // Map HD types to elements
    const elements: Element[] = [];
    switch (type) {
      case HDType.GENERATOR:
      case HDType.MANIFESTING_GENERATOR:
        elements.push(Element.FIRE, Element.EARTH); // life force + grounding
        break;
      case HDType.MANIFESTOR:
        elements.push(Element.FIRE, Element.AIR); // initiation + impact
        break;
      case HDType.PROJECTOR:
        elements.push(Element.AIR, Element.WATER); // guidance + reception
        break;
      case HDType.REFLECTOR:
        elements.push(Element.WATER, Element.ETHER); // mirroring + lunar
        break;
      default:
        elements.push(Element.ETHER);
    }

    return {
      system: "human-design",
      elements,
      archetypes: [type.toLowerCase().replace(/ /g, "-")],
      resonanceValues: {
        definedCenters: ((state.metrics.definedCenterCount as number) ?? 0) / 9,
        channelDensity: ((state.metrics.channelCount as number) ?? 0) / 36,
      },
    };
  }
}
