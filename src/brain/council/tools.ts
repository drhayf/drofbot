/**
 * Standalone Cosmic Calculation Tools
 *
 * General-purpose cosmic calculators exposed as agent tools.
 * These are thin wrappers over the existing Council system implementations,
 * accepting ANY birth data and ANY target date.
 *
 * Tools:
 *   cardology_calculate    — birth card, periods, karma cards, spreads
 *   iching_calculate       — I-Ching gate, line, Gene Keys for any date
 *   human_design_calculate — Human Design chart for any birth data
 *   solar_weather          — current space weather data
 *   lunar_calculate        — lunar phase for any date
 *   transit_calculate      — planetary transits + natal comparison
 *   cosmic_synthesis       — full harmonic synthesis for a person on a date
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../agent-runner/tools/common.js";
import { jsonResult, readNumberParam, readStringParam } from "../agent-runner/tools/common.js";
import { calculateHarmonicSynthesis } from "./harmonic.js";
import { getCouncil } from "./index.js";
// Council system imports — use existing implementations, no duplication
import {
  calculateBirthCard,
  calculateKarmaCards,
  calculatePlanetaryPeriods,
  getCurrentPeriod,
  cardName,
  getZodiacSign,
  generateLifeSpread,
  getPlanetaryCard,
  type Card,
} from "./systems/cardology.js";
import { Planet } from "./systems/cardology.js";
import { calculateChart, calculateDesignDate } from "./systems/human-design.js";
import { getDailyCode, getGeneKey } from "./systems/iching.js";
import { calculateLunarPhase } from "./systems/lunar.js";
import { SolarTrackingSystem } from "./systems/solar.js";
import { calculateAllPlanetPositions, compareToNatal, findSkyAspects } from "./systems/transits.js";

// ─── Schemas ───────────────────────────────────────────────────

const CardologyCalculateSchema = Type.Object({
  birthMonth: Type.Number({ description: "Birth month (1-12)." }),
  birthDay: Type.Number({ description: "Birth day (1-31)." }),
  targetDate: Type.Optional(
    Type.String({ description: "ISO date for period calculation. Defaults to today." }),
  ),
  includeSpread: Type.Optional(Type.Boolean({ description: "Include full life spread analysis." })),
  includeKarma: Type.Optional(Type.Boolean({ description: "Include karma card calculation." })),
  includeRelationship: Type.Optional(
    Type.Object({
      otherBirthMonth: Type.Number({ description: "Other person's birth month." }),
      otherBirthDay: Type.Number({ description: "Other person's birth day." }),
    }),
  ),
});

const IChingCalculateSchema = Type.Object({
  date: Type.Optional(Type.String({ description: "ISO date. Defaults to today." })),
  includeEarth: Type.Optional(Type.Boolean({ description: "Include Earth gate (opposite)." })),
  includeGeneKeys: Type.Optional(Type.Boolean({ description: "Include shadow/gift/siddhi." })),
  includeDesignDate: Type.Optional(
    Type.Boolean({ description: "Calculate design date (requires birthDate)." }),
  ),
  birthDate: Type.Optional(Type.String({ description: "For design date calculation." })),
});

const HumanDesignCalculateSchema = Type.Object({
  birthDate: Type.String({ description: "ISO date (YYYY-MM-DD)." }),
  birthTime: Type.Optional(Type.String({ description: "HH:MM (24h). If omitted, uses noon." })),
  birthLatitude: Type.Optional(Type.Number()),
  birthLongitude: Type.Optional(Type.Number()),
  birthTimezone: Type.Optional(Type.String()),
});

const SolarWeatherSchema = Type.Object({});

const LunarCalculateSchema = Type.Object({
  date: Type.Optional(Type.String({ description: "ISO date. Defaults to now." })),
});

const TransitCalculateSchema = Type.Object({
  date: Type.Optional(Type.String({ description: "ISO date. Defaults to now." })),
  natalBirthDate: Type.Optional(Type.String({ description: "For natal comparison." })),
  natalBirthTime: Type.Optional(Type.String({ description: "HH:MM for natal chart." })),
});

const CosmicSynthesisSchema = Type.Object({
  birthMonth: Type.Number({ description: "Birth month (1-12)." }),
  birthDay: Type.Number({ description: "Birth day (1-31)." }),
  birthTime: Type.Optional(Type.String({ description: "HH:MM (24h)." })),
  date: Type.Optional(Type.String({ description: "ISO date. Defaults to today." })),
});

// ─── Helpers ───────────────────────────────────────────────────

function parseOptionalDate(value?: string): Date {
  if (!value) return new Date();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}

function formatCard(card: Card) {
  return {
    rank: card.rank,
    suit: card.suit,
    solarValue: card.solarValue,
    name: cardName(card),
  };
}

function parseBirthDate(dateStr: string, timeStr?: string): Date {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (!Number.isNaN(hours)) d.setHours(hours);
    if (!Number.isNaN(minutes)) d.setMinutes(minutes);
  } else {
    d.setHours(12, 0, 0, 0); // noon default
  }
  return d;
}

// ─── Tool Factories ────────────────────────────────────────────

export function createCardologyCalculateTool(): AnyAgentTool {
  return {
    label: "Cardology Calculator",
    name: "cardology_calculate",
    description:
      "Calculate cardology information for any person or date. " +
      "Computes birth card, current planetary period, karma cards, and spread analysis. " +
      "Use when the user asks about their card, life path, relationship compatibility, or current planetary influence.",
    parameters: CardologyCalculateSchema,
    execute: async (_toolCallId, params) => {
      const month = readNumberParam(params, "birthMonth")!;
      const day = readNumberParam(params, "birthDay")!;
      const targetDate = parseOptionalDate(readStringParam(params, "targetDate"));

      const birthCard = calculateBirthCard(month, day);
      const zodiacSign = getZodiacSign(month, day);

      // Current period
      const year = targetDate.getFullYear();
      // Construct a synthetic birth date for period calculation (year doesn't matter for period)
      const birthDate = new Date(year, month - 1, day);
      const currentPeriod = getCurrentPeriod(birthDate, targetDate);
      const periods = calculatePlanetaryPeriods(birthDate, year, birthCard);

      const result: Record<string, unknown> = {
        birthCard: formatCard(birthCard),
        zodiacSign,
        currentPeriod: currentPeriod
          ? {
              planet: currentPeriod.planet,
              card: formatCard(currentPeriod.directCard),
              dayInPeriod: currentPeriod.periodDay,
              periodIndex: currentPeriod.periodIndex,
            }
          : null,
        allPeriods: periods.map((p) => ({
          planet: p.planet,
          card: formatCard(p.directCard),
          startDate: p.startDate.toISOString().split("T")[0],
          endDate: p.endDate.toISOString().split("T")[0],
        })),
      };

      // Karma cards
      if (params.includeKarma !== false) {
        const [first, second] = calculateKarmaCards(birthCard);
        result.karmaCards = {
          first: first ? formatCard(first) : null,
          second: second ? formatCard(second) : null,
        };
      }

      // Spread analysis
      if (params.includeSpread) {
        const lifeSpread = generateLifeSpread();
        const planets: Planet[] = [
          Planet.MERCURY,
          Planet.VENUS,
          Planet.MARS,
          Planet.JUPITER,
          Planet.SATURN,
          Planet.URANUS,
          Planet.NEPTUNE,
        ];
        const planetaryCards: Record<string, string | null> = {};
        for (const planet of planets) {
          const card = getPlanetaryCard(birthCard, planet, lifeSpread);
          planetaryCards[planet] = card ? cardName(card) : null;
        }
        result.planetaryCards = planetaryCards;
      }

      // Relationship comparison
      if (params.includeRelationship && typeof params.includeRelationship === "object") {
        const rel = params.includeRelationship as {
          otherBirthMonth: number;
          otherBirthDay: number;
        };
        const otherBirthCard = calculateBirthCard(rel.otherBirthMonth, rel.otherBirthDay);
        const [otherKarma1, otherKarma2] = calculateKarmaCards(otherBirthCard);
        const [myKarma1, myKarma2] = calculateKarmaCards(birthCard);

        const connections: string[] = [];
        if (myKarma1 && cardName(myKarma1) === cardName(otherBirthCard)) {
          connections.push("Their birth card is your first karma card");
        }
        if (myKarma2 && cardName(myKarma2) === cardName(otherBirthCard)) {
          connections.push("Their birth card is your second karma card");
        }
        if (otherKarma1 && cardName(otherKarma1) === cardName(birthCard)) {
          connections.push("Your birth card is their first karma card");
        }
        if (otherKarma2 && cardName(otherKarma2) === cardName(birthCard)) {
          connections.push("Your birth card is their second karma card");
        }

        result.relationship = {
          otherBirthCard: formatCard(otherBirthCard),
          otherZodiacSign: getZodiacSign(rel.otherBirthMonth, rel.otherBirthDay),
          connections,
        };
      }

      return jsonResult(result);
    },
  };
}

export function createIChingCalculateTool(): AnyAgentTool {
  return {
    label: "I-Ching Calculator",
    name: "iching_calculate",
    description:
      "Calculate I-Ching gate, line, and Gene Keys data for any date. Uses actual Sun longitude.",
    parameters: IChingCalculateSchema,
    execute: async (_toolCallId, params) => {
      const date = parseOptionalDate(readStringParam(params, "date"));
      const dailyCode = getDailyCode(date);

      const result: Record<string, unknown> = {
        sunGate: dailyCode.sunActivation.gate,
        sunLine: dailyCode.sunActivation.line,
        sunColor: dailyCode.sunActivation.color,
        sunTone: dailyCode.sunActivation.tone,
        sunBase: dailyCode.sunActivation.base,
        sunLongitude: Math.round(dailyCode.sunLongitude * 100) / 100,
      };

      // Earth gate (opposite)
      if (params.includeEarth !== false) {
        result.earthGate = dailyCode.earthActivation.gate;
        result.earthLine = dailyCode.earthActivation.line;
      }

      // Gene Keys
      if (params.includeGeneKeys) {
        const geneKey = getGeneKey(dailyCode.sunActivation.gate);
        if (geneKey) {
          result.geneKey = {
            number: geneKey.number,
            name: geneKey.name,
            shadow: geneKey.shadow,
            gift: geneKey.gift,
            siddhi: geneKey.siddhi,
          };
        }
      }

      // Design date (requires birthDate)
      if (params.includeDesignDate) {
        const birthDateStr = readStringParam(params, "birthDate");
        if (birthDateStr) {
          const designDate = calculateDesignDate(parseBirthDate(birthDateStr));
          const designCode = getDailyCode(designDate);
          result.designDate = {
            date: designDate.toISOString().split("T")[0],
            sunGate: designCode.sunActivation.gate,
            sunLine: designCode.sunActivation.line,
          };
        }
      }

      return jsonResult(result);
    },
  };
}

export function createHumanDesignCalculateTool(): AnyAgentTool {
  return {
    label: "Human Design Calculator",
    name: "human_design_calculate",
    description:
      "Calculate Human Design chart for a given birth date. " +
      "Returns type, authority, profile, defined centers, channels, and incarnation cross.",
    parameters: HumanDesignCalculateSchema,
    execute: async (_toolCallId, params) => {
      const dateStr = readStringParam(params, "birthDate", { required: true });
      const timeStr = readStringParam(params, "birthTime");
      const birthDate = parseBirthDate(dateStr, timeStr);

      const chart = calculateChart({
        datetime: birthDate,
        latitude: readNumberParam(params, "birthLatitude") ?? 0,
        longitude: readNumberParam(params, "birthLongitude") ?? 0,
        timezone: readStringParam(params, "birthTimezone") ?? "UTC",
      });

      return jsonResult({
        type: chart.type,
        authority: chart.authority,
        profile: chart.profile,
        definedCenters: [...chart.definedCenters],
        undefinedCenters: [...chart.undefinedCenters],
        definedChannels: chart.definedChannels.map((ch) => ({
          gate1: ch.gate1,
          gate2: ch.gate2,
          name: ch.name,
        })),
        activeGates: chart.activeGates,
        personalitySun: {
          gate: chart.personalitySun.gate,
          line: chart.personalitySun.line,
        },
        personalityEarth: {
          gate: chart.personalityEarth.gate,
          line: chart.personalityEarth.line,
        },
        designSun: {
          gate: chart.designSun.gate,
          line: chart.designSun.line,
        },
        designEarth: {
          gate: chart.designEarth.gate,
          line: chart.designEarth.line,
        },
        uncertainBirthTime: !timeStr,
      });
    },
  };
}

export function createSolarWeatherTool(): AnyAgentTool {
  return {
    label: "Solar Weather",
    name: "solar_weather",
    description: "Get current space weather data: Kp index, solar flares, geomagnetic conditions.",
    parameters: SolarWeatherSchema,
    execute: async () => {
      // Use the SolarTrackingSystem to get current solar state
      const solar = new SolarTrackingSystem();
      const state = await solar.calculate(null);

      if (!state) {
        return jsonResult({ error: "Solar data unavailable." });
      }

      return jsonResult({
        kpIndex: state.metrics.kpIndex ?? 0,
        stormLevel: state.primary.stormLevel ?? "quiet",
        flareCount: state.primary.flareCount ?? 0,
        recentFlareClasses: state.primary.recentFlareClasses ?? [],
        summary: state.summary,
      });
    },
  };
}

export function createLunarCalculateTool(): AnyAgentTool {
  return {
    label: "Lunar Calculator",
    name: "lunar_calculate",
    description: "Calculate lunar phase for any date.",
    parameters: LunarCalculateSchema,
    execute: async (_toolCallId, params) => {
      const date = parseOptionalDate(readStringParam(params, "date"));
      const lunar = calculateLunarPhase(date);

      return jsonResult({
        phaseName: lunar.phaseName,
        illumination: Math.round(lunar.illumination * 1000) / 1000,
        zodiacSign: lunar.zodiacSign,
        phaseAngle: Math.round(lunar.phaseAngle * 100) / 100,
        supermoonScore: Math.round(lunar.supermoonScore * 1000) / 1000,
        moonLongitude: Math.round(lunar.moonLongitude * 100) / 100,
        distance: Math.round(lunar.distance),
      });
    },
  };
}

export function createTransitCalculateTool(): AnyAgentTool {
  return {
    label: "Transit Calculator",
    name: "transit_calculate",
    description: "Calculate current planetary transits, optionally compared to a natal chart.",
    parameters: TransitCalculateSchema,
    execute: async (_toolCallId, params) => {
      const date = parseOptionalDate(readStringParam(params, "date"));
      const positions = calculateAllPlanetPositions(date);
      const skyAspects = findSkyAspects(positions);

      const result: Record<string, unknown> = {
        date: date.toISOString().split("T")[0],
        planetPositions: positions.map((p) => ({
          planet: p.name,
          longitude: Math.round(p.longitude * 100) / 100,
        })),
        skyAspects: skyAspects.map((a) => ({
          planet1: a.planet1,
          planet2: a.planet2,
          aspect: a.aspectName,
          orb: Math.round(a.actualOrb * 100) / 100,
        })),
      };

      // Natal comparison
      const natalDateStr = readStringParam(params, "natalBirthDate");
      if (natalDateStr) {
        const natalTimeStr = readStringParam(params, "natalBirthTime");
        const natalDate = parseBirthDate(natalDateStr, natalTimeStr);
        const natalPositions = calculateAllPlanetPositions(natalDate);
        const natalAspects = compareToNatal(positions, natalPositions);

        result.natalAspects = natalAspects.map((a) => ({
          transitPlanet: a.transitPlanet,
          natalPlanet: a.natalPlanet,
          aspect: a.aspectName,
          orb: Math.round(a.actualOrb * 100) / 100,
          applying: a.isApplying,
        }));
      }

      return jsonResult(result);
    },
  };
}

export function createCosmicSynthesisTool(): AnyAgentTool {
  return {
    label: "Cosmic Synthesis",
    name: "cosmic_synthesis",
    description:
      "Get the full harmonic synthesis for a person on a given date. " +
      "Combines all Council systems (cardology, I-Ching, Human Design, lunar, transits, solar) " +
      "into a unified reading with resonance score. " +
      "Use proactively when the user asks about energy, timing, 'how is today', or wants a holistic cosmic perspective.",
    parameters: CosmicSynthesisSchema,
    execute: async (_toolCallId, params) => {
      const month = readNumberParam(params, "birthMonth")!;
      const day = readNumberParam(params, "birthDay")!;
      const timeStr = readStringParam(params, "birthTime");
      const dateStr = readStringParam(params, "date");
      const now = parseOptionalDate(dateStr);

      // Build a BirthMoment
      const year = now.getFullYear();
      const birthDate = new Date(year, month - 1, day);
      if (timeStr) {
        const [h, m] = timeStr.split(":").map(Number);
        if (!Number.isNaN(h)) birthDate.setHours(h);
        if (!Number.isNaN(m)) birthDate.setMinutes(m);
      } else {
        birthDate.setHours(12, 0, 0, 0);
      }

      const birth = {
        datetime: birthDate,
        latitude: 0,
        longitude: 0,
        timezone: "UTC",
      };

      // Calculate all systems via the Council
      const council = getCouncil();
      const states = await council.calculateAll(birth, now);

      // Get archetypes for synthesis by calling each system's archetypes() method
      const archetypeMappings = [...states.entries()]
        .map(([name, state]) => {
          const system = council.getSystem(name);
          return system ? system.archetypes(state) : null;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      // Calculate harmonic synthesis
      const synthesis = calculateHarmonicSynthesis(states, archetypeMappings);

      return jsonResult({
        resonanceScore: Math.round(synthesis.overallResonance * 1000) / 1000,
        resonanceType: synthesis.resonanceType,
        elementalBalance: synthesis.elementalBalance,
        dominantElements: synthesis.dominantElements,
        guidance: synthesis.guidance,
        systemSummaries: [...states.entries()].map(([name, state]) => ({
          system: name,
          summary: state.summary,
        })),
      });
    },
  };
}

// ─── Convenience: all cosmic tools ─────────────────────────────

export function createCosmicTools(): AnyAgentTool[] {
  return [
    createCardologyCalculateTool(),
    createIChingCalculateTool(),
    createHumanDesignCalculateTool(),
    createSolarWeatherTool(),
    createLunarCalculateTool(),
    createTransitCalculateTool(),
    createCosmicSynthesisTool(),
  ];
}
