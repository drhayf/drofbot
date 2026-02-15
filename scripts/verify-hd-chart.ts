/**
 * Verification script for Human Design calculations.
 * Tests against known birth data: July 23, 1999, 2:30 PM Sydney, Australia
 *
 * Usage: bun scripts/verify-hd-chart.ts
 */

import type { BirthMoment } from "../src/brain/council/types.js";
import {
  calculateFullChartPositions,
  datetimeToJulian,
  calculateDesignJulianDay,
  julianToDatetime,
} from "../src/brain/council/systems/ephemeris.js";
import { calculateChart } from "../src/brain/council/systems/human-design.js";
import { longitudeToActivation } from "../src/brain/council/systems/iching.js";

// Test birth data - Accra, Ghana
const TEST_BIRTH: BirthMoment = {
  datetime: new Date("1999-07-23T14:30:00+00:00"), // July 23, 1999, 2:30 PM Accra (UTC+0)
  latitude: 5.6037,
  longitude: -0.187,
  timezone: "Africa/Accra",
};

// Planet names for display
const PLANET_NAMES = [
  "Sun",
  "Earth",
  "Moon",
  "North Node",
  "South Node",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
];

function formatActivation(
  gate: number,
  line: number,
  color?: number,
  tone?: number,
  base?: number,
): string {
  let result = `${gate}.${line}`;
  if (color !== undefined) {
    result += `.${color}`;
  }
  if (tone !== undefined) {
    result += `.${tone}`;
  }
  if (base !== undefined) {
    result += `.${base}`;
  }
  return result;
}

function zodiacSign(longitude: number): string {
  const signs = [
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
  ];
  const signIndex = Math.floor(longitude / 30);
  return signs[signIndex] ?? "Unknown";
}

function formatLongitude(lon: number): string {
  const sign = zodiacSign(lon);
  const degInSign = lon % 30;
  const degrees = Math.floor(degInSign);
  const minutes = Math.floor((degInSign - degrees) * 60);
  return `${degrees}°${minutes.toString().padStart(2, "0")}' ${sign}`;
}

console.log("═══════════════════════════════════════════════════════════════════");
console.log("HUMAN DESIGN CALCULATION VERIFICATION");
console.log("═══════════════════════════════════════════════════════════════════");
console.log();
console.log("Birth Data:");
console.log(`  Date: July 23, 1999`);
console.log(`  Time: 2:30 PM (14:30)`);
console.log(`  Location: Accra, Ghana (UTC+0)`);
console.log(`  Latitude: 5.6037, Longitude: -0.1870`);
console.log();

// Calculate Julian Day
const birthJd = datetimeToJulian(1999, 7, 23, 14, 30, 0, 0);

console.log(`Julian Day (UT): ${birthJd.toFixed(6)}`);
console.log();

// Calculate Design Julian Day
const designJd = calculateDesignJulianDay(birthJd);
const designDt = julianToDatetime(designJd);
console.log(`Design Julian Day: ${designJd.toFixed(6)}`);
console.log(
  `Design Date: ${designDt.year}-${designDt.month.toString().padStart(2, "0")}-${designDt.day.toString().padStart(2, "0")} ${designDt.hour.toString().padStart(2, "0")}:${designDt.minute.toString().padStart(2, "0")}:${designDt.second.toString().padStart(2, "0")} UTC`,
);
console.log();

// Get all planetary positions
const positions = calculateFullChartPositions(1999, 7, 23, 14, 30, 0, 0);

console.log("───────────────────────────────────────────────────────────────────");
console.log("PLANETARY POSITIONS");
console.log("───────────────────────────────────────────────────────────────────");
console.log();
console.log("PERSONALITY (Conscious) - Birth Time:");
console.log();

for (let i = 0; i < 13; i++) {
  const pos = positions.personality[i];
  if (!pos) {
    continue;
  }
  const activation = longitudeToActivation(pos.longitude);
  console.log(
    `  ${PLANET_NAMES[i]!.padEnd(12)} ${formatLongitude(pos.longitude).padEnd(15)} → Gate ${formatActivation(activation.gate, activation.line, activation.color, activation.tone, activation.base)}`,
  );
}

console.log();
console.log("DESIGN (Unconscious) - ~88 days before birth:");
console.log();

for (let i = 0; i < 13; i++) {
  const pos = positions.design[i];
  if (!pos) {
    continue;
  }
  const activation = longitudeToActivation(pos.longitude);
  console.log(
    `  ${PLANET_NAMES[i]!.padEnd(12)} ${formatLongitude(pos.longitude).padEnd(15)} → Gate ${formatActivation(activation.gate, activation.line, activation.color, activation.tone, activation.base)}`,
  );
}

console.log();
console.log("───────────────────────────────────────────────────────────────────");
console.log("CHART SUMMARY");
console.log("───────────────────────────────────────────────────────────────────");
console.log();

// Calculate full chart
const chart = calculateChart(TEST_BIRTH);

console.log(`Type: ${chart.type}`);
console.log(`Authority: ${chart.authority}`);
console.log(`Profile: ${chart.profile}`);
console.log();

console.log("Defined Centers:");
const definedCenters = chart.definedCenters;
if (definedCenters.length === 0) {
  console.log("  None (Reflector)");
} else {
  console.log(`  ${definedCenters.join(", ")}`);
}
console.log();

console.log("Defined Channels:");
if (chart.definedChannels.length === 0) {
  console.log("  None");
} else {
  for (const ch of chart.definedChannels) {
    console.log(`  ${ch.gate1}-${ch.gate2} (${ch.name})`);
  }
}
console.log();

console.log("Active Gates:");
const sortedGates = chart.activeGates.toSorted((a, b) => a - b);
console.log(`  ${sortedGates.join(", ")}`);
console.log();

console.log("───────────────────────────────────────────────────────────────────");
console.log("VERIFICATION CHECKLIST");
console.log("───────────────────────────────────────────────────────────────────");
console.log();
console.log("Compare these results with mybodygraph.com or geneticmatrix.com:");
console.log();
console.log(`1. Personality Sun: Gate ${chart.personalitySun.gate}.${chart.personalitySun.line}`);
console.log(
  `2. Personality Earth: Gate ${chart.personalityEarth.gate}.${chart.personalityEarth.line}`,
);
console.log(`3. Design Sun: Gate ${chart.designSun.gate}.${chart.designSun.line}`);
console.log(`4. Design Earth: Gate ${chart.designEarth.gate}.${chart.designEarth.line}`);
console.log(`5. Type: ${chart.type}`);
console.log(`6. Authority: ${chart.authority}`);
console.log(`7. Profile: ${chart.profile}`);
console.log();
console.log("═══════════════════════════════════════════════════════════════════");
