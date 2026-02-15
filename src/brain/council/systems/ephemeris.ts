/**
 * Swiss Ephemeris Wrapper for Human Design Calculations
 *
 * Clean abstraction over the sweph Node.js package.
 * Handles all astronomical calculations for HD.
 *
 * Key functions:
 * - Julian date conversion
 * - Design date calculation (88° solar arc)
 * - Planetary position calculations
 *
 * Ported from GUTTERS ephemeris.py (verified implementation).
 * Uses Moshier ephemeris mode for 0.1 arcsec precision without data files.
 */

import sweph from "sweph";

// Swiss Ephemeris constants
const C = sweph.constants;

// ─── Planet Definitions ─────────────────────────────────────────────

export interface PlanetDef {
  name: string;
  code: number;
  derive: null | "opposite";
}

/**
 * All 13 Human Design planets.
 * Earth and South_Node are derived from Sun and North_Node respectively.
 */
export const PLANETS: PlanetDef[] = [
  { name: "Sun", code: C.SE_SUN, derive: null },
  { name: "Earth", code: C.SE_SUN, derive: "opposite" },
  { name: "Moon", code: C.SE_MOON, derive: null },
  { name: "North_Node", code: C.SE_TRUE_NODE, derive: null },
  { name: "South_Node", code: C.SE_TRUE_NODE, derive: "opposite" },
  { name: "Mercury", code: C.SE_MERCURY, derive: null },
  { name: "Venus", code: C.SE_VENUS, derive: null },
  { name: "Mars", code: C.SE_MARS, derive: null },
  { name: "Jupiter", code: C.SE_JUPITER, derive: null },
  { name: "Saturn", code: C.SE_SATURN, derive: null },
  { name: "Uranus", code: C.SE_URANUS, derive: null },
  { name: "Neptune", code: C.SE_NEPTUNE, derive: null },
  { name: "Pluto", code: C.SE_PLUTO, derive: null },
];

// Map planet name to definition for quick lookup
const PLANET_MAP = new Map(PLANETS.map((p) => [p.name, p]));

// ─── Ephemeris Flags ─────────────────────────────────────────────────

/**
 * Moshier ephemeris mode: no data files needed, 0.1 arcsec precision.
 * This is the recommended mode for Human Design calculations.
 */
const EPHEMERIS_FLAGS = C.SEFLG_MOSEPH;

// ─── Julian Date Conversion ──────────────────────────────────────────

/**
 * Convert date/time components to Julian date.
 *
 * @param year - Year (e.g., 1999)
 * @param month - Month (1-12)
 * @param day - Day (1-31)
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @param second - Second (0-59)
 * @param utcOffsetHours - Timezone offset in hours (e.g., +10 for Sydney, -5 for EST)
 * @returns Julian date (UT1)
 */
export function datetimeToJulian(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  utcOffsetHours: number = 0,
): number {
  // Convert local time to UTC via sweph's utc_time_zone
  const utc = sweph.utc_time_zone(year, month, day, hour, minute, second, utcOffsetHours);

  // Convert UTC to Julian date
  // utc_to_jd returns { flag, error, data: [jd_tt, jd_ut] }
  // data[1] is UT1 (Universal Time), data[0] is TT (Terrestrial Time)
  // For HD calculations, UT1 is appropriate
  const result = sweph.utc_to_jd(
    utc.year,
    utc.month,
    utc.day,
    utc.hour,
    utc.minute,
    utc.second,
    C.SE_GREG_CAL,
  );

  return result.data[1];
}

/**
 * Convert Julian date back to date/time components (UTC).
 *
 * @param jd - Julian date
 * @returns Object with year, month, day, hour, minute, second
 */
export function julianToDatetime(jd: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const utc = sweph.jdut1_to_utc(jd, C.SE_GREG_CAL);
  return {
    year: utc.year,
    month: utc.month,
    day: utc.day,
    hour: utc.hour,
    minute: utc.minute,
    second: utc.second,
  };
}

// ─── Planetary Position Calculations ─────────────────────────────────

/**
 * Get ecliptic longitude for a planet at a given Julian date.
 *
 * Handles special cases:
 * - Earth: Opposite Sun (Sun + 180°)
 * - South_Node: Opposite North Node (North + 180°)
 *
 * @param jd - Julian date
 * @param planetName - Planet name (Sun, Moon, Mercury, etc.)
 * @returns Ecliptic longitude in degrees (0-360)
 */
export function getPlanetLongitude(jd: number, planetName: string): number {
  const planet = PLANET_MAP.get(planetName);
  if (!planet) {
    throw new Error(`Unknown planet: ${planetName}`);
  }

  // Calculate the base position
  const result = sweph.calc_ut(jd, planet.code, EPHEMERIS_FLAGS);

  // result.data[0] is the ecliptic longitude
  let longitude = result.data[0];

  // Handle derived positions
  if (planet.derive === "opposite") {
    longitude = (longitude + 180) % 360;
  }

  // Normalize to 0-360
  return ((longitude % 360) + 360) % 360;
}

/**
 * Get all planetary positions at a given Julian date.
 *
 * @param jd - Julian date
 * @param label - "personality" (conscious) or "design" (unconscious)
 * @returns Array of planetary positions with longitude
 */
export function getAllPlanetaryPositions(
  jd: number,
  label: "personality" | "design" = "personality",
): Array<{ planet: string; longitude: number; label: string }> {
  const positions: Array<{ planet: string; longitude: number; label: string }> = [];

  for (const planet of PLANETS) {
    const longitude = getPlanetLongitude(jd, planet.name);
    positions.push({
      planet: planet.name,
      longitude,
      label,
    });
  }

  return positions;
}

// ─── Design Date Calculation ─────────────────────────────────────────

/**
 * Calculate the Design Julian date using 88° solar arc method.
 *
 * CRITICAL: This uses 88 DEGREES of solar arc, NOT 88 days!
 * The Design is calculated for when the Sun was 88° before
 * its birth position, approximately 88-89 days before birth.
 *
 * Source: Ra Uru Hu BlackBook, verified implementation from
 * dturkuler/humandesign_api
 *
 * @param birthJd - Birth Julian date
 * @returns Design Julian date
 */
export function calculateDesignJulianDay(birthJd: number): number {
  // Get Sun's longitude at birth
  const sunResult = sweph.calc_ut(birthJd, C.SE_SUN, EPHEMERIS_FLAGS);
  const sunLongitude = sunResult.data[0];

  // Calculate target longitude (88° before birth position)
  const targetLongitude = (((sunLongitude - 88) % 360) + 360) % 360;

  // Find when Sun crossed this longitude (search backwards)
  // Start search ~100 days before to ensure we find it
  const searchStart = birthJd - 100;

  // solcross_ut finds when the Sun crosses a given longitude
  // Returns { date: julian_day, error: string }
  const result = sweph.solcross_ut(targetLongitude, searchStart, EPHEMERIS_FLAGS);

  return result.date;
}

// ─── Convenience Functions ───────────────────────────────────────────

/**
 * Calculate both Personality and Design Julian dates from birth data.
 *
 * @param year - Birth year
 * @param month - Birth month (1-12)
 * @param day - Birth day (1-31)
 * @param hour - Birth hour (0-23)
 * @param minute - Birth minute (0-59)
 * @param second - Birth second (0-59)
 * @param utcOffsetHours - Timezone offset in hours
 * @returns Object with personalityJd and designJd
 */
export function calculateJulianDates(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  utcOffsetHours: number = 0,
): { personalityJd: number; designJd: number } {
  const personalityJd = datetimeToJulian(year, month, day, hour, minute, second, utcOffsetHours);

  const designJd = calculateDesignJulianDay(personalityJd);

  return { personalityJd, designJd };
}

/**
 * Get complete planetary positions for both Personality and Design.
 *
 * @param year - Birth year
 * @param month - Birth month (1-12)
 * @param day - Birth day (1-31)
 * @param hour - Birth hour (0-23)
 * @param minute - Birth minute (0-59)
 * @param second - Birth second (0-59)
 * @param utcOffsetHours - Timezone offset in hours
 * @returns Object with personality and design planetary positions
 */
export function calculateFullChartPositions(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  utcOffsetHours: number = 0,
): {
  personality: Array<{ planet: string; longitude: number; label: string }>;
  design: Array<{ planet: string; longitude: number; label: string }>;
  personalityJd: number;
  designJd: number;
} {
  const { personalityJd, designJd } = calculateJulianDates(
    year,
    month,
    day,
    hour,
    minute,
    second,
    utcOffsetHours,
  );

  const personality = getAllPlanetaryPositions(personalityJd, "personality");
  const design = getAllPlanetaryPositions(designJd, "design");

  return { personality, design, personalityJd, designJd };
}

/**
 * Get Sun longitude for a given date (convenience for daily transits).
 *
 * @param dt - JavaScript Date object (assumed UTC)
 * @returns Sun ecliptic longitude in degrees
 */
export function getSunLongitude(dt: Date): number {
  const jd = datetimeToJulian(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate(),
    dt.getUTCHours(),
    dt.getUTCMinutes(),
    dt.getUTCSeconds(),
    0, // UTC
  );

  return getPlanetLongitude(jd, "Sun");
}
