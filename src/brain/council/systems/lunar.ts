/**
 * Lunar Tracking System — Moon Phase & Position
 *
 * Ported from GUTTERS `tracking/lunar/tracker.py` (406 lines).
 *
 * Pure-computation lunar tracking (no API needed):
 *  - Phase angle: ((moonLong − sunLong) % 360 + 360) % 360
 *  - Illumination: (1 + cos(phaseAngle)) / 2
 *  - Phase name: 8 named phases by 45° sectors
 *  - Supermoon score: (405500 − distance) / (405500 − 363300)
 *  - Approximate moon longitude (simplified ELP2000)
 *  - Zodiac sign from ecliptic longitude
 *
 * Does NOT require birth data for transit-mode.
 */

import type { ArchetypeMapping, BirthMoment, CosmicState, CosmicSystem } from "../types.js";
import { Element } from "../types.js";

// ─── Constants (from GUTTERS §14.3) ──────────────────────────────

export const MOON_PERIGEE = 363_300; // km
export const MOON_APOGEE = 405_500; // km

/** J2000.0 epoch: 2000-01-01T12:00:00 UTC */
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
const DEG = Math.PI / 180;

// ─── Zodiac Signs ────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

/**
 * Convert ecliptic longitude to zodiac sign.
 * Each sign spans 30° (Aries = 0°–30°, Taurus = 30°–60°, etc.)
 */
export function longitudeToZodiacSign(longitude: number): ZodiacSign {
  const normalized = ((longitude % 360) + 360) % 360;
  const index = Math.floor(normalized / 30);
  return ZODIAC_SIGNS[index]!;
}

// ─── Phase Name (GUTTERS §14.2, exact boundaries) ───────────────

const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
] as const;

export type PhaseName = (typeof PHASE_NAMES)[number];

/**
 * Get the lunar phase name from the phase angle.
 *
 * Exact boundaries from GUTTERS §14.2:
 *   New Moon:        < 22.5° or >= 337.5°
 *   Waxing Crescent: 22.5° – 67.5°
 *   First Quarter:   67.5° – 112.5°
 *   Waxing Gibbous:  112.5° – 157.5°
 *   Full Moon:       157.5° – 202.5°
 *   Waning Gibbous:  202.5° – 247.5°
 *   Last Quarter:    247.5° – 292.5°
 *   Waning Crescent: 292.5° – 337.5°
 */
export function getPhaseName(phaseAngle: number): PhaseName {
  const a = ((phaseAngle % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return "New Moon";
  if (a < 67.5) return "Waxing Crescent";
  if (a < 112.5) return "First Quarter";
  if (a < 157.5) return "Waxing Gibbous";
  if (a < 202.5) return "Full Moon";
  if (a < 247.5) return "Waning Gibbous";
  if (a < 292.5) return "Last Quarter";
  return "Waning Crescent";
}

// ─── Illumination (GUTTERS §14.1) ───────────────────────────────

/**
 * Calculate fractional illumination from phase angle.
 * Formula: (1 + cos(phaseAngle)) / 2
 *
 * 0.0 = new moon, 1.0 = full moon
 */
export function calculateIllumination(phaseAngle: number): number {
  return (1 + Math.cos(phaseAngle * DEG)) / 2;
}

// ─── Supermoon Score (GUTTERS §14.3) ─────────────────────────────

/**
 * Calculate supermoon score.
 * 1.0 at perigee (363 300 km), 0.0 at apogee (405 500 km).
 * Formula: (405500 − distance) / (405500 − 363300)
 */
export function calculateSupermoonScore(distanceKm: number): number {
  const score = (MOON_APOGEE - distanceKm) / (MOON_APOGEE - MOON_PERIGEE);
  return Math.max(0, Math.min(1, score));
}

// ─── Approximate Sun Longitude ──────────────────────────────────

/**
 * Simplified VSOP87 sun longitude.
 * Same formula used in iching.ts:
 *   meanLong = (280.46 + 0.9856474 × d) % 360
 *   g = (357.528 + 0.9856003 × d) (mean anomaly)
 *   C = 1.915 sin(g) + 0.020 sin(2g)
 *   sunLong = (meanLong + C) % 360
 */
export function approximateSunLongitude(dt: Date): number {
  const days = (dt.getTime() - J2000) / 86_400_000;
  const meanLong = (((280.46 + 0.9856474 * days) % 360) + 360) % 360;
  const g = (((357.528 + 0.9856003 * days) % 360) + 360) % 360;
  const correctionCenterEquation = 1.915 * Math.sin(g * DEG) + 0.02 * Math.sin(2 * g * DEG);
  return (((meanLong + correctionCenterEquation) % 360) + 360) % 360;
}

// ─── Approximate Moon Longitude ─────────────────────────────────

/**
 * Simplified lunar mean longitude + basic perturbation.
 *
 * Based on simplified ELP2000 (Jean Meeus, "Astronomical Algorithms").
 * This gives the ecliptic longitude ±2° (sufficient for phase and
 * zodiac sign calculations, NOT for precise transit timing).
 */
export function approximateMoonLongitude(dt: Date): number {
  const days = (dt.getTime() - J2000) / 86_400_000;
  const T = days / 36525; // Julian centuries

  // Mean longitude of the Moon (L')
  const Lp = 218.3165 + 481267.8813 * T - 0.0016 * T * T;

  // Mean anomaly of the Moon (M')
  const Mp = 134.9634 + 477198.8676 * T + 0.0089 * T * T;

  // Mean anomaly of the Sun (M)
  const M = 357.5291 + 35999.0503 * T - 0.0002 * T * T;

  // Moon's argument of latitude (F)
  const F = 93.272 + 483202.0175 * T - 0.0034 * T * T;

  // Mean elongation of the Moon (D)
  const D = 297.8502 + 445267.1115 * T - 0.0016 * T * T;

  // Principal perturbation terms (largest terms from ELP2000)
  const longitude =
    Lp +
    6.289 * Math.sin(Mp * DEG) + // Equation of center
    1.274 * Math.sin((2 * D - Mp) * DEG) + // Evection
    0.658 * Math.sin(2 * D * DEG) + // Variation
    -0.186 * Math.sin(M * DEG) + // Annual equation
    -0.114 * Math.sin(2 * F * DEG) + // Reduction to ecliptic
    0.059 * Math.sin((2 * D - 2 * Mp) * DEG) +
    0.057 * Math.sin((2 * D - M - Mp) * DEG) +
    0.053 * Math.sin((2 * D + Mp) * DEG) +
    0.046 * Math.sin((2 * D - M) * DEG) +
    -0.041 * Math.sin((Mp - M) * DEG) +
    -0.035 * Math.sin(D * DEG) + // Parallactic inequality
    -0.03 * Math.sin((Mp + M) * DEG);

  return ((longitude % 360) + 360) % 360;
}

// ─── Approximate Moon Distance ──────────────────────────────────

/**
 * Simplified geocentric distance to the Moon in km.
 * Mean distance ≈ 385 001 km, with corrections for eccentricity.
 */
export function approximateMoonDistance(dt: Date): number {
  const days = (dt.getTime() - J2000) / 86_400_000;
  const T = days / 36525;

  // Mean anomaly of the Moon (M')
  const Mp = 134.9634 + 477198.8676 * T + 0.0089 * T * T;
  // Mean elongation (D)
  const D = 297.8502 + 445267.1115 * T - 0.0016 * T * T;

  // Simplified distance formula (mean + principal perturbation)
  // r = 385001 − 20905 cos(M') − 3699 cos(2D − M') − 2956 cos(2D) (km)
  const r =
    385_001 -
    20_905 * Math.cos(Mp * DEG) -
    3_699 * Math.cos((2 * D - Mp) * DEG) -
    2_956 * Math.cos(2 * D * DEG);

  return r;
}

// ─── Full Lunar Calculation (GUTTERS §14.1) ─────────────────────

export interface LunarData {
  phaseAngle: number;
  illumination: number;
  phaseName: PhaseName;
  zodiacSign: ZodiacSign;
  moonLongitude: number;
  distance: number;
  supermoonScore: number;
}

/**
 * Calculate full lunar data for a given datetime.
 * Matches GUTTERS §14.1 calculateLunarPhase() signature.
 */
export function calculateLunarPhase(dt: Date): LunarData {
  const sunLong = approximateSunLongitude(dt);
  const moonLong = approximateMoonLongitude(dt);
  const phaseAngle = (((moonLong - sunLong) % 360) + 360) % 360;
  const illumination = calculateIllumination(phaseAngle);
  const distance = approximateMoonDistance(dt);

  return {
    phaseAngle,
    illumination,
    phaseName: getPhaseName(phaseAngle),
    zodiacSign: longitudeToZodiacSign(moonLong),
    moonLongitude: moonLong,
    distance,
    supermoonScore: calculateSupermoonScore(distance),
  };
}

// ─── Natal Comparison (GUTTERS §14.5) ───────────────────────────

export interface NatalMoonComparison {
  inNatalSign: boolean;
  lunarReturn: boolean;
}

/**
 * Angular distance between two ecliptic longitudes (0–180°).
 */
export function angularDistance(lon1: number, lon2: number): number {
  const diff = Math.abs((((lon1 - lon2) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Compare current transit Moon to natal Moon position.
 * Lunar Return = transit moon within 5° of natal moon longitude.
 */
export function compareToNatalMoon(
  transitMoon: LunarData,
  natalMoonLongitude: number,
  natalMoonSign: ZodiacSign,
): NatalMoonComparison {
  const inNatalSign = transitMoon.zodiacSign === natalMoonSign;
  const lunarReturn = angularDistance(transitMoon.moonLongitude, natalMoonLongitude) <= 5;

  return { inNatalSign, lunarReturn };
}

// ─── Lunar Tracking System ──────────────────────────────────────

export class LunarTrackingSystem implements CosmicSystem {
  readonly name = "lunar";
  readonly displayName = "Lunar Tracking (Moon Phase)";
  readonly requiresBirthData = false;
  readonly recalcInterval = { type: "hours" as const, hours: 6 };

  async calculate(_birth: BirthMoment | null, now?: Date): Promise<CosmicState> {
    const dt = now ?? new Date();
    const lunar = calculateLunarPhase(dt);

    return {
      system: "lunar",
      timestamp: dt,
      primary: {
        phaseAngle: lunar.phaseAngle,
        illumination: lunar.illumination,
        phaseName: lunar.phaseName,
        zodiacSign: lunar.zodiacSign,
        moonLongitude: lunar.moonLongitude,
        distance: Math.round(lunar.distance),
        supermoonScore: lunar.supermoonScore,
      },
      summary: this.buildSummary(lunar),
      metrics: {
        phaseAngle: lunar.phaseAngle,
        illumination: lunar.illumination,
        supermoonScore: lunar.supermoonScore,
        distanceKm: lunar.distance,
      },
    };
  }

  synthesize(state: CosmicState): string {
    return state.summary;
  }

  archetypes(state: CosmicState): ArchetypeMapping {
    const illumination = (state.metrics.illumination as number) ?? 0.5;
    const phaseName = (state.primary as unknown as LunarData).phaseName ?? "First Quarter";

    // Moon element mapping: Water is the primary element
    const elements = [Element.WATER];

    // Add secondary element based on phase
    const waxing =
      phaseName === "Waxing Crescent" ||
      phaseName === "First Quarter" ||
      phaseName === "Waxing Gibbous";
    const waning =
      phaseName === "Waning Gibbous" ||
      phaseName === "Last Quarter" ||
      phaseName === "Waning Crescent";

    if (waxing) elements.push(Element.FIRE); // growth energy
    if (waning) elements.push(Element.EARTH); // release, grounding
    if (phaseName === "Full Moon") elements.push(Element.ETHER); // peak illumination
    if (phaseName === "New Moon") elements.push(Element.AIR); // mental, seed planting

    const archetypes: string[] = [];
    if (illumination > 0.8) archetypes.push("illumination", "fullness");
    else if (illumination < 0.2) archetypes.push("darkness", "seed");
    else if (waxing) archetypes.push("growth", "building");
    else archetypes.push("release", "integration");

    return {
      system: "lunar",
      elements,
      archetypes,
      resonanceValues: {
        illumination,
        waxing: waxing ? 1 : 0,
        waning: waning ? 1 : 0,
      },
    };
  }

  private buildSummary(lunar: LunarData): string {
    const illumPct = Math.round(lunar.illumination * 100);
    const parts = [
      `${lunar.phaseName} (${illumPct}% illuminated).`,
      `Moon in ${lunar.zodiacSign}.`,
    ];

    if (lunar.supermoonScore > 0.7) {
      parts.push(`Supermoon conditions (score: ${lunar.supermoonScore.toFixed(2)}).`);
    }

    return parts.join(" ");
  }
}
