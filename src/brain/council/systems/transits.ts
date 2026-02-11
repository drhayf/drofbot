/**
 * Transit Tracking System — Planetary Aspects
 *
 * Ported from GUTTERS `tracking/transits/tracker.py` (308 lines).
 *
 * Calculates current planetary positions (simplified) and identifies
 * aspects between transit planets and natal positions:
 *
 * Aspect Definitions (GUTTERS §15.1):
 *   Conjunction:  0°,  orb 8°
 *   Opposition:   180°, orb 8°
 *   Square:       90°, orb 6°
 *   Trine:        120°, orb 6°
 *   Sextile:      60°, orb 4°
 *
 * Does NOT require birth data for sky-only mode.
 * WITH birth data, compares transits to natal positions.
 */

import type { ArchetypeMapping, BirthMoment, CosmicState, CosmicSystem } from "../types.js";
import { Element } from "../types.js";

// ─── Constants ───────────────────────────────────────────────────

/** J2000.0 epoch: 2000-01-01T12:00:00 UTC */
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
const DEG = Math.PI / 180;

// ─── Aspect Definitions (GUTTERS §15.1) ─────────────────────────

export interface AspectDef {
  name: string;
  angle: number;
  orb: number;
}

export const ASPECTS: AspectDef[] = [
  { name: "conjunction", angle: 0, orb: 8 },
  { name: "opposition", angle: 180, orb: 8 },
  { name: "square", angle: 90, orb: 6 },
  { name: "trine", angle: 120, orb: 6 },
  { name: "sextile", angle: 60, orb: 4 },
];

// ─── Aspect Quality (for harmonic synthesis) ─────────────────────

/**
 * Classical astrological nature of each aspect.
 * Used for resonance/archetype mapping.
 */
export const ASPECT_NATURE: Record<string, "harmonious" | "challenging" | "neutral"> = {
  conjunction: "neutral",
  opposition: "challenging",
  square: "challenging",
  trine: "harmonious",
  sextile: "harmonious",
};

// ─── Planet Data ─────────────────────────────────────────────────

export interface PlanetPosition {
  name: string;
  longitude: number;
}

/**
 * Simplified planetary longitude calculation.
 *
 * Uses mean orbital elements + equation of center for inner planets.
 * Accuracy: ±2° for inner planets, ±5° for outer planets.
 * Sufficient for orb-based aspect detection, NOT for precise timing.
 *
 * Mean elements at J2000.0 from Meeus "Astronomical Algorithms".
 */
const PLANET_ELEMENTS: {
  name: string;
  L0: number; // mean longitude at J2000 (°)
  Lrate: number; // mean daily motion (°/day)
  M0: number; // mean anomaly at J2000 (°)
  Mrate: number; // mean anomaly rate (°/day)
  e: number; // eccentricity
  element: Element; // astrological element
}[] = [
  // Sun (handled separately in solar.ts / iching.ts but included for aspect calculation)
  {
    name: "Sun",
    L0: 280.46,
    Lrate: 0.9856474,
    M0: 357.528,
    Mrate: 0.9856003,
    e: 0.01671,
    element: Element.FIRE,
  },
  // Moon — very fast, simplified (see lunar.ts for more detailed calculation)
  {
    name: "Moon",
    L0: 218.3165,
    Lrate: 13.176_396,
    M0: 134.9634,
    Mrate: 13.064_993,
    e: 0.0549,
    element: Element.WATER,
  },
  // Mercury
  {
    name: "Mercury",
    L0: 252.251,
    Lrate: 4.0932377,
    M0: 174.795,
    Mrate: 4.0923344,
    e: 0.2056,
    element: Element.AIR,
  },
  // Venus
  {
    name: "Venus",
    L0: 181.9797,
    Lrate: 1.6021302,
    M0: 50.416,
    Mrate: 1.6021687,
    e: 0.0068,
    element: Element.WATER,
  },
  // Mars
  {
    name: "Mars",
    L0: 355.433,
    Lrate: 0.5240208,
    M0: 19.373,
    Mrate: 0.5240711,
    e: 0.0934,
    element: Element.FIRE,
  },
  // Jupiter
  {
    name: "Jupiter",
    L0: 34.351,
    Lrate: 0.0831294,
    M0: 20.02,
    Mrate: 0.0830853,
    e: 0.0485,
    element: Element.FIRE,
  },
  // Saturn
  {
    name: "Saturn",
    L0: 50.077,
    Lrate: 0.0334442,
    M0: 317.021,
    Mrate: 0.0334613,
    e: 0.0555,
    element: Element.EARTH,
  },
  // Uranus
  {
    name: "Uranus",
    L0: 314.055,
    Lrate: 0.0117331,
    M0: 141.05,
    Mrate: 0.0117261,
    e: 0.0463,
    element: Element.AIR,
  },
  // Neptune
  {
    name: "Neptune",
    L0: 304.349,
    Lrate: 0.005982,
    M0: 256.225,
    Mrate: 0.0059539,
    e: 0.0095,
    element: Element.WATER,
  },
];

/**
 * Calculate a planet's ecliptic longitude for a given date.
 * Uses mean longitude + equation of center (1st order Kepler equation).
 */
export function calculatePlanetLongitude(
  planet: (typeof PLANET_ELEMENTS)[number],
  dt: Date,
): number {
  const days = (dt.getTime() - J2000) / 86_400_000;

  const meanLong = (((planet.L0 + planet.Lrate * days) % 360) + 360) % 360;
  const meanAnomaly = (((planet.M0 + planet.Mrate * days) % 360) + 360) % 360;

  // Equation of center (1st and 2nd harmonic)
  const C =
    (2 * planet.e * Math.sin(meanAnomaly * DEG) +
      1.25 * planet.e * planet.e * Math.sin(2 * meanAnomaly * DEG)) *
    (180 / Math.PI);

  return (((meanLong + C) % 360) + 360) % 360;
}

/**
 * Calculate all transit planet positions for a given datetime.
 */
export function calculateAllPlanetPositions(dt: Date): PlanetPosition[] {
  return PLANET_ELEMENTS.map((p) => ({
    name: p.name,
    longitude: calculatePlanetLongitude(p, dt),
  }));
}

// ─── Angular Distance ───────────────────────────────────────────

/**
 * Angular distance between two ecliptic longitudes (0–180°).
 */
export function angularDistance(lon1: number, lon2: number): number {
  const diff = Math.abs((((lon1 - lon2) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

// ─── Transit Aspects (GUTTERS §15.2) ────────────────────────────

export interface TransitAspect {
  transitPlanet: string;
  natalPlanet: string;
  aspectName: string;
  exactAngle: number;
  actualOrb: number;
  isApplying: boolean;
}

/**
 * Compare transit planets to natal planet positions and find aspects.
 * Matches GUTTERS §15.2 compareToNatal() signature.
 */
export function compareToNatal(
  transitPlanets: PlanetPosition[],
  natalPlanets: PlanetPosition[],
): TransitAspect[] {
  const aspects: TransitAspect[] = [];

  for (const transit of transitPlanets) {
    for (const natal of natalPlanets) {
      // Skip same-planet (transit Sun vs natal Sun is a solar return, handled elsewhere)
      if (transit.name === natal.name) continue;

      for (const aspectDef of ASPECTS) {
        const angDist = angularDistance(transit.longitude, natal.longitude);
        const orbDiff = Math.abs(angDist - aspectDef.angle);

        if (orbDiff <= aspectDef.orb) {
          // Determine if aspect is applying (getting closer to exact) or separating
          // Simplified: if transit planet is "behind" the exact angle, it's applying
          const rawDiff = (((transit.longitude - natal.longitude) % 360) + 360) % 360;
          const isApplying = rawDiff < aspectDef.angle;

          aspects.push({
            transitPlanet: transit.name,
            natalPlanet: natal.name,
            aspectName: aspectDef.name,
            exactAngle: aspectDef.angle,
            actualOrb: orbDiff,
            isApplying,
          });
        }
      }
    }
  }

  return aspects;
}

// ─── Sky-Only Aspects (between transit planets) ──────────────────

export interface SkyAspect {
  planet1: string;
  planet2: string;
  aspectName: string;
  exactAngle: number;
  actualOrb: number;
}

/**
 * Find aspects between transit planets themselves (no natal chart needed).
 * This is the "sky-only" or "mundane" mode.
 */
export function findSkyAspects(positions: PlanetPosition[]): SkyAspect[] {
  const aspects: SkyAspect[] = [];

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const p1 = positions[i]!;
      const p2 = positions[j]!;

      for (const aspectDef of ASPECTS) {
        const angDist = angularDistance(p1.longitude, p2.longitude);
        const orbDiff = Math.abs(angDist - aspectDef.angle);

        if (orbDiff <= aspectDef.orb) {
          aspects.push({
            planet1: p1.name,
            planet2: p2.name,
            aspectName: aspectDef.name,
            exactAngle: aspectDef.angle,
            actualOrb: orbDiff,
          });
        }
      }
    }
  }

  return aspects;
}

// ─── Significant Transit Events (GUTTERS §15.3) ─────────────────

export interface TransitEvent {
  type: "EXACT_TRANSIT" | "TIGHT_ORB";
  aspect: TransitAspect | SkyAspect;
}

/**
 * Detect significant transit events (exact or near-exact aspects).
 */
export function detectSignificantTransitEvents(
  aspects: (TransitAspect | SkyAspect)[],
): TransitEvent[] {
  const events: TransitEvent[] = [];

  for (const aspect of aspects) {
    if (aspect.actualOrb < 1.0) {
      events.push({ type: "EXACT_TRANSIT", aspect });
    } else if (aspect.actualOrb < 2.0) {
      events.push({ type: "TIGHT_ORB", aspect });
    }
  }

  return events;
}

// ─── Transit Tracking System ────────────────────────────────────

export class TransitTrackingSystem implements CosmicSystem {
  readonly name = "transits";
  readonly displayName = "Transit Tracking (Planetary Aspects)";
  readonly requiresBirthData = false; // Works in sky-only mode; natal comparison when birth data provided
  readonly recalcInterval = { type: "hours" as const, hours: 6 };

  async calculate(birth: BirthMoment | null, now?: Date): Promise<CosmicState> {
    const dt = now ?? new Date();
    const transitPositions = calculateAllPlanetPositions(dt);

    // Sky-only aspects (always available)
    const skyAspects = findSkyAspects(transitPositions);
    const skyEvents = detectSignificantTransitEvents(skyAspects);

    // Natal aspects (only when birth data available)
    let natalAspects: TransitAspect[] = [];
    let natalEvents: TransitEvent[] = [];
    if (birth) {
      const natalPositions = calculateAllPlanetPositions(birth.datetime);
      natalAspects = compareToNatal(transitPositions, natalPositions);
      natalEvents = detectSignificantTransitEvents(natalAspects);
    }

    const allEvents = [...skyEvents, ...natalEvents];

    return {
      system: "transits",
      timestamp: dt,
      primary: {
        transitPositions: transitPositions.map((p) => ({
          name: p.name,
          longitude: Math.round(p.longitude * 100) / 100,
        })),
        skyAspects: skyAspects.map((a) => ({
          planets: `${a.planet1}-${a.planet2}`,
          aspect: a.aspectName,
          orb: Math.round(a.actualOrb * 100) / 100,
        })),
        natalAspects: natalAspects.map((a) => ({
          transit: a.transitPlanet,
          natal: a.natalPlanet,
          aspect: a.aspectName,
          orb: Math.round(a.actualOrb * 100) / 100,
          applying: a.isApplying,
        })),
        significantEvents: allEvents.length,
      },
      summary: this.buildSummary(skyAspects, natalAspects, allEvents),
      metrics: {
        skyAspectCount: skyAspects.length,
        natalAspectCount: natalAspects.length,
        exactTransits: allEvents.filter((e) => e.type === "EXACT_TRANSIT").length,
        tightOrbCount: allEvents.filter((e) => e.type === "TIGHT_ORB").length,
      },
    };
  }

  synthesize(state: CosmicState): string {
    return state.summary;
  }

  archetypes(state: CosmicState): ArchetypeMapping {
    const skyAspectCount = (state.metrics.skyAspectCount as number) ?? 0;
    const exactTransits = (state.metrics.exactTransits as number) ?? 0;

    // Determine dominant element from active aspects
    const elements: Element[] = [Element.ETHER]; // transits are always "connection"

    if (exactTransits > 0) {
      elements.push(Element.FIRE); // activation
    }
    if (skyAspectCount > 5) {
      elements.push(Element.AIR); // mental complexity
    }

    const archetypes: string[] = [];
    if (exactTransits > 0) archetypes.push("activation", "exact-timing");
    if (skyAspectCount > 3) archetypes.push("complexity", "interconnection");
    if (skyAspectCount === 0) archetypes.push("quiet", "integration");

    return {
      system: "transits",
      elements,
      archetypes,
      resonanceValues: {
        aspectDensity: Math.min(skyAspectCount / 10, 1),
        exactness: exactTransits > 0 ? 1 : 0,
      },
    };
  }

  private buildSummary(
    skyAspects: SkyAspect[],
    natalAspects: TransitAspect[],
    events: TransitEvent[],
  ): string {
    const parts: string[] = [];

    parts.push(`${skyAspects.length} sky aspects active.`);

    if (natalAspects.length > 0) {
      parts.push(`${natalAspects.length} natal transits.`);
    }

    const exact = events.filter((e) => e.type === "EXACT_TRANSIT");
    if (exact.length > 0) {
      const names = exact.map((e) => {
        const a = e.aspect;
        if ("transitPlanet" in a) {
          return `${a.transitPlanet} ${a.aspectName} natal ${a.natalPlanet}`;
        }
        return `${a.planet1} ${a.aspectName} ${a.planet2}`;
      });
      parts.push(`Exact: ${names.join("; ")}.`);
    }

    return parts.join(" ");
  }
}
