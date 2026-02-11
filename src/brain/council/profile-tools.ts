/**
 * Profile Exploration & Save Tools
 *
 * Tools for conversationally exploring birth data before committing it:
 *   profile_explore      — calculate full cosmic profile without saving
 *   profile_save         — commit explored birth data to operator profile
 *   profile_hypothesize_time — find birth times matching a known HD type
 *
 * The operator can say "try March 15 1990 in Sydney at 3pm" and see results,
 * then adjust until the results match what they know, then save.
 */

import { Type } from "@sinclair/typebox";
import type { BirthMomentConfig } from "../../shared/config/types.council.js";
import type { AnyAgentTool } from "../agent-runner/tools/common.js";
import type { BirthMoment } from "./types.js";
import { readConfigFileSnapshot, writeConfigFile } from "../../shared/config/io.js";
import { jsonResult, readNumberParam, readStringParam } from "../agent-runner/tools/common.js";
import { calculateHarmonicSynthesis } from "./harmonic.js";
import { getCouncil } from "./index.js";
import { calculateBirthCard, cardName, getZodiacSign } from "./systems/cardology.js";
import { calculateChart } from "./systems/human-design.js";
import { getDailyCode, getGeneKey } from "./systems/iching.js";
import { calculateLunarPhase } from "./systems/lunar.js";

// ─── Schemas ────────────────────────────────────────────────────

const ProfileExploreSchema = Type.Object({
  birthYear: Type.Number({ description: "Birth year (e.g. 1990)." }),
  birthMonth: Type.Number({ description: "Birth month (1-12)." }),
  birthDay: Type.Number({ description: "Birth day (1-31)." }),
  birthTime: Type.Optional(
    Type.String({
      description:
        "Birth time in HH:MM 24-hour format (e.g. '14:30'). Defaults to 12:00 if unknown.",
    }),
  ),
  birthCity: Type.Optional(
    Type.String({
      description: "Birth city/location name (for display). E.g. 'Sydney, Australia'.",
    }),
  ),
  birthLatitude: Type.Optional(
    Type.Number({ description: "Birth location latitude (-90 to 90). E.g. -33.87 for Sydney." }),
  ),
  birthLongitude: Type.Optional(
    Type.Number({ description: "Birth location longitude (-180 to 180). E.g. 151.21 for Sydney." }),
  ),
  birthTimezone: Type.Optional(
    Type.String({ description: "IANA timezone (e.g. 'Australia/Sydney'). Defaults to 'UTC'." }),
  ),
});

const ProfileSaveSchema = Type.Object({
  birthYear: Type.Number({ description: "Birth year (e.g. 1990)." }),
  birthMonth: Type.Number({ description: "Birth month (1-12)." }),
  birthDay: Type.Number({ description: "Birth day (1-31)." }),
  birthTime: Type.Optional(
    Type.String({
      description: "Birth time in HH:MM 24-hour format. Defaults to 12:00 if unknown.",
    }),
  ),
  birthLatitude: Type.Optional(
    Type.Number({ description: "Birth location latitude. Defaults to 0 if unknown." }),
  ),
  birthLongitude: Type.Optional(
    Type.Number({ description: "Birth location longitude. Defaults to 0 if unknown." }),
  ),
  birthTimezone: Type.Optional(Type.String({ description: "IANA timezone. Defaults to 'UTC'." })),
  operatorName: Type.Optional(
    Type.String({ description: "The operator's name (for the profile)." }),
  ),
});

const ProfileHypothesizeTimeSchema = Type.Object({
  birthYear: Type.Number({ description: "Birth year." }),
  birthMonth: Type.Number({ description: "Birth month (1-12)." }),
  birthDay: Type.Number({ description: "Birth day (1-31)." }),
  knownHDType: Type.String({
    description:
      "The Human Design type the operator knows they are. One of: Reflector, Manifestor, Generator, Manifesting Generator, Projector.",
  }),
  birthLatitude: Type.Optional(
    Type.Number({ description: "Birth location latitude. Defaults to 0." }),
  ),
  birthLongitude: Type.Optional(
    Type.Number({ description: "Birth location longitude. Defaults to 0." }),
  ),
  birthTimezone: Type.Optional(Type.String({ description: "IANA timezone. Defaults to 'UTC'." })),
  intervalMinutes: Type.Optional(
    Type.Number({ description: "Minutes between each trial calculation. Defaults to 15." }),
  ),
});

// ─── Helpers ────────────────────────────────────────────────────

function buildBirthMoment(params: {
  year: number;
  month: number;
  day: number;
  time?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}): BirthMoment {
  const dt = new Date(params.year, params.month - 1, params.day);
  if (params.time) {
    const [h, m] = params.time.split(":").map(Number);
    if (!Number.isNaN(h)) dt.setHours(h);
    if (!Number.isNaN(m)) dt.setMinutes(m);
  } else {
    dt.setHours(12, 0, 0, 0);
  }
  return {
    datetime: dt,
    latitude: params.latitude ?? 0,
    longitude: params.longitude ?? 0,
    timezone: params.timezone ?? "UTC",
  };
}

function calculateProfile(birth: BirthMoment) {
  const month = birth.datetime.getMonth() + 1;
  const day = birth.datetime.getDate();
  const now = new Date();

  // Cardology — only needs month + day
  const birthCard = calculateBirthCard(month, day);
  const zodiac = getZodiacSign(month, day);

  // Human Design — needs full birth data with time
  const hdChart = calculateChart(birth);

  // I-Ching — gate for birthday
  const ichingCode = getDailyCode(birth.datetime);
  const sunGate = ichingCode.sunActivation.gate;
  const sunLine = ichingCode.sunActivation.line;
  const geneKey = getGeneKey(sunGate);

  // Lunar at birth
  const lunarAtBirth = calculateLunarPhase(birth.datetime);

  return {
    cardology: {
      birthCard: cardName(birthCard),
      zodiacSign: zodiac,
    },
    humanDesign: {
      type: hdChart.type,
      authority: hdChart.authority,
      profile: hdChart.profile,
      definedCenters: hdChart.definedCenters,
      undefinedCenters: hdChart.undefinedCenters,
      personalitySunGate: hdChart.personalitySun.gate,
      designSunGate: hdChart.designSun.gate,
    },
    iching: {
      lifeGate: sunGate,
      lifeLine: sunLine,
      geneKey: geneKey
        ? {
            shadow: geneKey.shadow,
            gift: geneKey.gift,
            siddhi: geneKey.siddhi,
          }
        : undefined,
    },
    lunar: {
      birthPhase: lunarAtBirth.phaseName,
      birthMoonSign: lunarAtBirth.zodiacSign,
      illumination: Math.round(lunarAtBirth.illumination * 100) / 100,
    },
  };
}

// ─── Tools ──────────────────────────────────────────────────────

export function createProfileExploreTool(): AnyAgentTool {
  return {
    label: "Explore Birth Profile",
    name: "profile_explore",
    description:
      "Calculate the full cosmic profile for given birth parameters WITHOUT saving. " +
      "Use this to trial-run different birth details (dates, times, locations) and show " +
      "the operator what their Human Design type, cardology birth card, I-Ching hexagram, " +
      "and lunar phase would be. The operator can compare results against what they know " +
      "about themselves and refine the details before committing with profile_save.",
    parameters: ProfileExploreSchema,
    execute: async (_toolCallId, params) => {
      const year = readNumberParam(params, "birthYear", { required: true })!;
      const month = readNumberParam(params, "birthMonth", { required: true })!;
      const day = readNumberParam(params, "birthDay", { required: true })!;
      const time = readStringParam(params, "birthTime");
      const city = readStringParam(params, "birthCity");
      const lat = readNumberParam(params, "birthLatitude");
      const lon = readNumberParam(params, "birthLongitude");
      const tz = readStringParam(params, "birthTimezone");

      const birth = buildBirthMoment({
        year,
        month,
        day,
        time,
        latitude: lat,
        longitude: lon,
        timezone: tz,
      });

      const profile = calculateProfile(birth);

      // Also get harmonic synthesis
      const council = getCouncil();
      const states = await council.calculateAll(birth, new Date());
      const archetypeMappings = [...states.entries()]
        .map(([name, state]) => {
          const system = council.getSystem(name);
          return system ? system.archetypes(state) : null;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);
      const synthesis = calculateHarmonicSynthesis(states, archetypeMappings);

      return jsonResult({
        status: "exploration",
        note: "These results are NOT saved. Use profile_save to commit when confirmed.",
        birthParameters: {
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          time: time ?? "12:00 (defaulted — birth time unknown)",
          location: city ?? (lat != null ? `${lat}, ${lon}` : "not specified (using 0, 0)"),
          timezone: tz ?? "UTC (defaulted)",
          timeKnown: !!time,
          locationKnown: lat != null,
        },
        systems: profile,
        harmonic: {
          resonanceScore: Math.round(synthesis.overallResonance * 1000) / 1000,
          resonanceType: synthesis.resonanceType,
          dominantElements: synthesis.dominantElements,
          guidance: synthesis.guidance,
        },
      });
    },
  };
}

export function createProfileSaveTool(): AnyAgentTool {
  return {
    label: "Save Birth Profile",
    name: "profile_save",
    description:
      "Commit the operator's birth data to the profile. Only use this after the operator " +
      "has confirmed the details are correct (e.g. after trial calculations with profile_explore). " +
      "This saves to the config and triggers recalculation of all personal cosmic systems. " +
      "After saving, endpoints like /api/identity/relationship and /api/cosmic/card will work.",
    parameters: ProfileSaveSchema,
    execute: async (_toolCallId, params) => {
      const year = readNumberParam(params, "birthYear", { required: true })!;
      const month = readNumberParam(params, "birthMonth", { required: true })!;
      const day = readNumberParam(params, "birthDay", { required: true })!;
      const time = readStringParam(params, "birthTime");
      const lat = readNumberParam(params, "birthLatitude") ?? 0;
      const lon = readNumberParam(params, "birthLongitude") ?? 0;
      const tz = readStringParam(params, "birthTimezone") ?? "UTC";

      // Build the datetime
      const dt = new Date(year, month - 1, day);
      if (time) {
        const [h, m] = time.split(":").map(Number);
        if (!Number.isNaN(h)) dt.setHours(h);
        if (!Number.isNaN(m)) dt.setMinutes(m);
      } else {
        dt.setHours(12, 0, 0, 0);
      }

      const birthConfig: BirthMomentConfig = {
        datetime: dt.toISOString(),
        latitude: lat,
        longitude: lon,
        timezone: tz,
      };

      // Read current config, set operatorBirth, write back
      const snapshot = await readConfigFileSnapshot();
      const cfg = snapshot.config;
      if (!cfg.council) {
        cfg.council = {};
      }
      cfg.council.operatorBirth = birthConfig;

      await writeConfigFile(cfg);

      // Calculate the profile to confirm what was saved
      const birth = buildBirthMoment({
        year,
        month,
        day,
        time,
        latitude: lat,
        longitude: lon,
        timezone: tz,
      });
      const profile = calculateProfile(birth);

      return jsonResult({
        status: "saved",
        message:
          "Operator birth data saved to profile. Cosmic systems will now use these details for all personalized calculations.",
        saved: birthConfig,
        profile: {
          humanDesign: {
            type: profile.humanDesign.type,
            authority: profile.humanDesign.authority,
            profile: profile.humanDesign.profile,
          },
          cardology: {
            birthCard: profile.cardology.birthCard,
            zodiacSign: profile.cardology.zodiacSign,
          },
        },
        nowAvailable: [
          "/api/identity/relationship — operator-agent cosmic relationship",
          "/api/cosmic/card — personal card calculation",
          "/api/profile — full profile with calculations",
        ],
      });
    },
  };
}

export function createProfileHypothesizeTimeTool(): AnyAgentTool {
  return {
    label: "Hypothesize Birth Time",
    name: "profile_hypothesize_time",
    description:
      "Find birth time windows that produce a known Human Design type. " +
      "If the operator knows they are a Projector but doesn't know their exact birth time, " +
      "this tool scans all 24 hours in intervals and reports which time windows give that type. " +
      "The operator can then narrow down using other known traits.",
    parameters: ProfileHypothesizeTimeSchema,
    execute: async (_toolCallId, params) => {
      const year = readNumberParam(params, "birthYear", { required: true })!;
      const month = readNumberParam(params, "birthMonth", { required: true })!;
      const day = readNumberParam(params, "birthDay", { required: true })!;
      const knownType = readStringParam(params, "knownHDType", { required: true })!;
      const lat = readNumberParam(params, "birthLatitude") ?? 0;
      const lon = readNumberParam(params, "birthLongitude") ?? 0;
      const tz = readStringParam(params, "birthTimezone") ?? "UTC";
      const intervalMin = readNumberParam(params, "intervalMinutes") ?? 15;

      const normalizedTarget = knownType.trim().toLowerCase();

      // Scan 24 hours in intervals
      type Window = {
        startTime: string;
        endTime: string;
        type: string;
        profile: string;
        authority: string;
      };
      const windows: Window[] = [];
      let currentWindowStart: string | null = null;
      let currentType = "";
      let currentProfile = "";
      let currentAuthority = "";

      const totalSteps = Math.floor((24 * 60) / intervalMin);

      for (let step = 0; step <= totalSteps; step++) {
        const minutes = step * intervalMin;
        const h = Math.floor(minutes / 60) % 24;
        const m = minutes % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

        const birth = buildBirthMoment({
          year,
          month,
          day,
          time: timeStr,
          latitude: lat,
          longitude: lon,
          timezone: tz,
        });

        const chart = calculateChart(birth);
        const chartType = chart.type.toLowerCase();

        if (chartType === normalizedTarget) {
          if (currentWindowStart === null) {
            currentWindowStart = timeStr;
            currentType = chart.type;
            currentProfile = chart.profile;
            currentAuthority = chart.authority;
          }
          // Extend the current window (keep latest profile/authority)
          currentProfile = chart.profile;
          currentAuthority = chart.authority;
        } else {
          if (currentWindowStart !== null) {
            // Close the window
            const prevMinutes = (step - 1) * intervalMin;
            const ph = Math.floor(prevMinutes / 60) % 24;
            const pm = prevMinutes % 60;
            windows.push({
              startTime: currentWindowStart,
              endTime: `${String(ph).padStart(2, "0")}:${String(pm).padStart(2, "0")}`,
              type: currentType,
              profile: currentProfile,
              authority: currentAuthority,
            });
            currentWindowStart = null;
          }
        }
      }

      // Close any remaining window
      if (currentWindowStart !== null) {
        windows.push({
          startTime: currentWindowStart,
          endTime: "23:59",
          type: currentType,
          profile: currentProfile,
          authority: currentAuthority,
        });
      }

      return jsonResult({
        searchParameters: {
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          targetType: knownType,
          location: lat !== 0 || lon !== 0 ? `${lat}, ${lon}` : "not specified (using 0, 0)",
          timezone: tz,
          intervalMinutes: intervalMin,
        },
        matchingWindows: windows,
        totalWindowsFound: windows.length,
        note:
          windows.length > 0
            ? `Found ${windows.length} time window(s) where ${knownType} appears. Try profile_explore with a time within these windows to see the full chart.`
            : `No time windows found for ${knownType} on this date. The type may require a different date or more precise location data.`,
      });
    },
  };
}

// ─── Convenience: all profile tools ─────────────────────────────

export function createProfileTools(): AnyAgentTool[] {
  return [createProfileExploreTool(), createProfileSaveTool(), createProfileHypothesizeTimeTool()];
}
