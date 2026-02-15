/**
 * I-Ching / Gene Keys System — 64 Gates
 *
 * Ported from GUTTERS `intelligence/iching/kernel.py` (4299 lines).
 *
 * Core algorithms:
 *  - Sun longitude → gate/line via the Rave Mandala (Human Design wheel)
 *  - Offset: (longitude + 58) % 360
 *  - 5.625° per gate, 0.9375° per line
 *  - Gate circle: 64 gates in the Rave Mandala sequence starting from Gate 41
 *  - Earth gate: Sun + 180° (opposing gate)
 *  - Sun longitude: Swiss Ephemeris (arcsecond precision)
 *  - Design date: Sun − 88° solar arc (not 88 calendar days)
 *
 * Every formula, constant, and threshold faithfully ported.
 */

import type { ArchetypeMapping, BirthMoment, CosmicState, CosmicSystem } from "../types.js";
import { Element } from "../types.js";
import { getSunLongitude } from "./ephemeris.js";

// ─── Constants (from GUTTERS §3.1) ──────────────────────────────

export const ICHING_OFFSET = 58; // degrees
export const DEGREES_PER_GATE = 5.625; // 360 / 64
export const DEGREES_PER_LINE = 0.9375; // 5.625 / 6
export const DEGREES_PER_COLOR = 0.15625; // 0.9375 / 6
export const DEGREES_PER_TONE = 0.026041; // 0.15625 / 6 (approx)
export const DEGREES_PER_BASE = 0.005208; // 0.026041 / 5 (approx)
export const DESIGN_ARC_DEGREES = 88; // Solar arc for Design date

// ─── Gate Circle (§3.2 — Rave Mandala Sequence) ──────────────────

/**
 * 64 gates arranged around the 360° wheel, starting from Gate 41.
 * This is the Human Design wheel ordering (NOT sequential 1-64).
 */
export const GATE_CIRCLE: number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45,
  12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44,
  1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
];

// ─── Line Archetypes (§3.7) ─────────────────────────────────────

export const LINE_ARCHETYPES: Record<number, string> = {
  1: "Investigator",
  2: "Hermit",
  3: "Martyr",
  4: "Opportunist",
  5: "Heretic",
  6: "Role Model",
};

// ─── Trigram Data (§3.8) ─────────────────────────────────────────

export const TRIGRAMS: Record<string, { binary: string; element: Element }> = {
  Heaven: { binary: "111", element: Element.FIRE },
  Earth: { binary: "000", element: Element.EARTH },
  Thunder: { binary: "001", element: Element.FIRE },
  Water: { binary: "010", element: Element.WATER },
  Mountain: { binary: "100", element: Element.EARTH },
  Wind: { binary: "110", element: Element.AIR },
  Fire: { binary: "101", element: Element.FIRE },
  Lake: { binary: "011", element: Element.WATER },
};

// ─── Activation (§3.3 — THE CORE ALGORITHM) ─────────────────────

export interface Activation {
  longitude: number;
  gate: number;
  line: number; // 1–6
  color: number; // 1–6
  tone: number; // 1–6
  base: number; // 1–5
}

/**
 * Convert ecliptic longitude to I-Ching activation.
 *
 * THE CORE ALGORITHM from GUTTERS:
 *   angle = (longitude + 58) % 360
 *   pct = angle / 360
 *   gateIndex = floor(pct × 64)
 *   gate = GATE_CIRCLE[gateIndex]
 *   line = floor((pct × 384) % 6) + 1
 *   color = floor((pct × 2304) % 6) + 1
 *   tone = floor((pct × 13824) % 6) + 1
 *   base = floor((pct × 69120) % 5) + 1
 */
export function longitudeToActivation(longitude: number): Activation {
  const angle = (((longitude + ICHING_OFFSET) % 360) + 360) % 360;
  const pct = angle / 360;

  const gateIndex = Math.floor(pct * 64);
  const gate = GATE_CIRCLE[gateIndex % 64]; // safety wrap

  const line = Math.floor((pct * 384) % 6) + 1; // 64 × 6 = 384
  const color = Math.floor((pct * 2304) % 6) + 1; // 384 × 6 = 2304
  const tone = Math.floor((pct * 13824) % 6) + 1; // 2304 × 6 = 13824
  const base = Math.floor((pct * 69120) % 5) + 1; // 13824 × 5 = 69120

  return { longitude, gate, line, color, tone, base };
}

// ─── Daily Code (§3.5) ──────────────────────────────────────────

export interface DailyCode {
  timestamp: Date;
  sunActivation: Activation;
  earthActivation: Activation;
  sunLongitude: number;
}

/**
 * Calculate the daily I-Ching code.
 * Earth activation = Sun + 180° (opposing gate).
 * Uses Swiss Ephemeris for arcsecond precision.
 */
export function getDailyCode(dt: Date): DailyCode {
  const sunLong = getSunLongitude(dt);
  const earthLong = (sunLong + 180) % 360;

  return {
    timestamp: dt,
    sunActivation: longitudeToActivation(sunLong),
    earthActivation: longitudeToActivation(earthLong),
    sunLongitude: sunLong,
  };
}

// ─── Gene Key Data ──────────────────────────────────────────────

export interface GeneKeyData {
  number: number;
  name: string;
  shadow: string;
  gift: string;
  siddhi: string;
  center: string;
  programmingPartner: number;
}

/**
 * Complete Gene Key spectrum for all 64 gates.
 * Each gate has Shadow (low expression), Gift (balanced), Siddhi (highest).
 */
const GENE_KEYS: GeneKeyData[] = [
  {
    number: 1,
    name: "The Creative",
    shadow: "Entropy",
    gift: "Freshness",
    siddhi: "Beauty",
    center: "G",
    programmingPartner: 2,
  },
  {
    number: 2,
    name: "The Receptive",
    shadow: "Dislocation",
    gift: "Orientation",
    siddhi: "Unity",
    center: "G",
    programmingPartner: 1,
  },
  {
    number: 3,
    name: "Difficulty at the Beginning",
    shadow: "Chaos",
    gift: "Innovation",
    siddhi: "Innocence",
    center: "Sacral",
    programmingPartner: 50,
  },
  {
    number: 4,
    name: "Youthful Folly",
    shadow: "Intolerance",
    gift: "Understanding",
    siddhi: "Forgiveness",
    center: "Ajna",
    programmingPartner: 49,
  },
  {
    number: 5,
    name: "Waiting",
    shadow: "Impatience",
    gift: "Patience",
    siddhi: "Timelessness",
    center: "Sacral",
    programmingPartner: 35,
  },
  {
    number: 6,
    name: "Conflict",
    shadow: "Conflict",
    gift: "Diplomacy",
    siddhi: "Peace",
    center: "SolarPlexus",
    programmingPartner: 36,
  },
  {
    number: 7,
    name: "The Army",
    shadow: "Division",
    gift: "Guidance",
    siddhi: "Virtue",
    center: "G",
    programmingPartner: 13,
  },
  {
    number: 8,
    name: "Holding Together",
    shadow: "Mediocrity",
    gift: "Style",
    siddhi: "Exquisiteness",
    center: "Throat",
    programmingPartner: 14,
  },
  {
    number: 9,
    name: "The Taming Power of the Small",
    shadow: "Inertia",
    gift: "Determination",
    siddhi: "Invincibility",
    center: "Sacral",
    programmingPartner: 16,
  },
  {
    number: 10,
    name: "Treading",
    shadow: "Self-Obsession",
    gift: "Naturalness",
    siddhi: "Being",
    center: "G",
    programmingPartner: 15,
  },
  {
    number: 11,
    name: "Peace",
    shadow: "Obscurity",
    gift: "Idealism",
    siddhi: "Light",
    center: "Ajna",
    programmingPartner: 12,
  },
  {
    number: 12,
    name: "Standstill",
    shadow: "Vanity",
    gift: "Discrimination",
    siddhi: "Purity",
    center: "Throat",
    programmingPartner: 11,
  },
  {
    number: 13,
    name: "Fellowship",
    shadow: "Discord",
    gift: "Discernment",
    siddhi: "Empathy",
    center: "G",
    programmingPartner: 7,
  },
  {
    number: 14,
    name: "Possession in Great Measure",
    shadow: "Compromise",
    gift: "Competence",
    siddhi: "Bounteousness",
    center: "Sacral",
    programmingPartner: 8,
  },
  {
    number: 15,
    name: "Modesty",
    shadow: "Dullness",
    gift: "Magnetism",
    siddhi: "Florescence",
    center: "G",
    programmingPartner: 10,
  },
  {
    number: 16,
    name: "Enthusiasm",
    shadow: "Indifference",
    gift: "Versatility",
    siddhi: "Mastery",
    center: "Throat",
    programmingPartner: 9,
  },
  {
    number: 17,
    name: "Following",
    shadow: "Opinion",
    gift: "Far-Sightedness",
    siddhi: "Omniscience",
    center: "Ajna",
    programmingPartner: 18,
  },
  {
    number: 18,
    name: "Work on What Has Been Spoiled",
    shadow: "Judgement",
    gift: "Integrity",
    siddhi: "Perfection",
    center: "Spleen",
    programmingPartner: 17,
  },
  {
    number: 19,
    name: "Approach",
    shadow: "Co-Dependence",
    gift: "Sensitivity",
    siddhi: "Sacrifice",
    center: "Root",
    programmingPartner: 33,
  },
  {
    number: 20,
    name: "Contemplation",
    shadow: "Superficiality",
    gift: "Self-Assurance",
    siddhi: "Presence",
    center: "Throat",
    programmingPartner: 34,
  },
  {
    number: 21,
    name: "Biting Through",
    shadow: "Control",
    gift: "Authority",
    siddhi: "Valour",
    center: "Heart",
    programmingPartner: 48,
  },
  {
    number: 22,
    name: "Grace",
    shadow: "Dishonour",
    gift: "Graciousness",
    siddhi: "Grace",
    center: "SolarPlexus",
    programmingPartner: 47,
  },
  {
    number: 23,
    name: "Splitting Apart",
    shadow: "Complexity",
    gift: "Simplicity",
    siddhi: "Quintessence",
    center: "Throat",
    programmingPartner: 43,
  },
  {
    number: 24,
    name: "Return",
    shadow: "Addiction",
    gift: "Invention",
    siddhi: "Silence",
    center: "Ajna",
    programmingPartner: 44,
  },
  {
    number: 25,
    name: "Innocence",
    shadow: "Constriction",
    gift: "Acceptance",
    siddhi: "Universal Love",
    center: "G",
    programmingPartner: 46,
  },
  {
    number: 26,
    name: "The Taming Power of the Great",
    shadow: "Pride",
    gift: "Artfulness",
    siddhi: "Invisibility",
    center: "Heart",
    programmingPartner: 45,
  },
  {
    number: 27,
    name: "Nourishment",
    shadow: "Selfishness",
    gift: "Altruism",
    siddhi: "Selflessness",
    center: "Sacral",
    programmingPartner: 28,
  },
  {
    number: 28,
    name: "Preponderance of the Great",
    shadow: "Purposelessness",
    gift: "Totality",
    siddhi: "Immortality",
    center: "Spleen",
    programmingPartner: 27,
  },
  {
    number: 29,
    name: "The Abysmal",
    shadow: "Half-Heartedness",
    gift: "Commitment",
    siddhi: "Devotion",
    center: "Sacral",
    programmingPartner: 30,
  },
  {
    number: 30,
    name: "The Clinging Fire",
    shadow: "Desire",
    gift: "Lightness",
    siddhi: "Rapture",
    center: "SolarPlexus",
    programmingPartner: 29,
  },
  {
    number: 31,
    name: "Influence",
    shadow: "Arrogance",
    gift: "Leadership",
    siddhi: "Humility",
    center: "Throat",
    programmingPartner: 41,
  },
  {
    number: 32,
    name: "Duration",
    shadow: "Failure",
    gift: "Preservation",
    siddhi: "Veneration",
    center: "Spleen",
    programmingPartner: 42,
  },
  {
    number: 33,
    name: "Retreat",
    shadow: "Forgetting",
    gift: "Mindfulness",
    siddhi: "Revelation",
    center: "Throat",
    programmingPartner: 19,
  },
  {
    number: 34,
    name: "The Power of the Great",
    shadow: "Force",
    gift: "Strength",
    siddhi: "Majesty",
    center: "Sacral",
    programmingPartner: 20,
  },
  {
    number: 35,
    name: "Progress",
    shadow: "Hunger",
    gift: "Adventure",
    siddhi: "Boundlessness",
    center: "Throat",
    programmingPartner: 5,
  },
  {
    number: 36,
    name: "Darkening of the Light",
    shadow: "Turbulence",
    gift: "Humanity",
    siddhi: "Compassion",
    center: "SolarPlexus",
    programmingPartner: 6,
  },
  {
    number: 37,
    name: "The Family",
    shadow: "Weakness",
    gift: "Equality",
    siddhi: "Tenderness",
    center: "SolarPlexus",
    programmingPartner: 40,
  },
  {
    number: 38,
    name: "Opposition",
    shadow: "Struggle",
    gift: "Perseverance",
    siddhi: "Honour",
    center: "Root",
    programmingPartner: 39,
  },
  {
    number: 39,
    name: "Obstruction",
    shadow: "Provocation",
    gift: "Dynamism",
    siddhi: "Liberation",
    center: "Root",
    programmingPartner: 38,
  },
  {
    number: 40,
    name: "Deliverance",
    shadow: "Exhaustion",
    gift: "Resolve",
    siddhi: "Divine Will",
    center: "Heart",
    programmingPartner: 37,
  },
  {
    number: 41,
    name: "Decrease",
    shadow: "Fantasy",
    gift: "Anticipation",
    siddhi: "Emanation",
    center: "Root",
    programmingPartner: 31,
  },
  {
    number: 42,
    name: "Increase",
    shadow: "Expectation",
    gift: "Detachment",
    siddhi: "Celebration",
    center: "Sacral",
    programmingPartner: 32,
  },
  {
    number: 43,
    name: "Breakthrough",
    shadow: "Deafness",
    gift: "Insight",
    siddhi: "Epiphany",
    center: "Ajna",
    programmingPartner: 23,
  },
  {
    number: 44,
    name: "Coming to Meet",
    shadow: "Interference",
    gift: "Teamwork",
    siddhi: "Synarchy",
    center: "Spleen",
    programmingPartner: 24,
  },
  {
    number: 45,
    name: "Gathering Together",
    shadow: "Dominance",
    gift: "Synergy",
    siddhi: "Communion",
    center: "Throat",
    programmingPartner: 26,
  },
  {
    number: 46,
    name: "Pushing Upward",
    shadow: "Seriousness",
    gift: "Delight",
    siddhi: "Ecstasy",
    center: "G",
    programmingPartner: 25,
  },
  {
    number: 47,
    name: "Oppression",
    shadow: "Oppression",
    gift: "Transmutation",
    siddhi: "Transfiguration",
    center: "Ajna",
    programmingPartner: 22,
  },
  {
    number: 48,
    name: "The Well",
    shadow: "Inadequacy",
    gift: "Resourcefulness",
    siddhi: "Wisdom",
    center: "Spleen",
    programmingPartner: 21,
  },
  {
    number: 49,
    name: "Revolution",
    shadow: "Reaction",
    gift: "Revolution",
    siddhi: "Rebirth",
    center: "SolarPlexus",
    programmingPartner: 4,
  },
  {
    number: 50,
    name: "The Cauldron",
    shadow: "Corruption",
    gift: "Equilibrium",
    siddhi: "Harmony",
    center: "Spleen",
    programmingPartner: 3,
  },
  {
    number: 51,
    name: "The Arousing",
    shadow: "Agitation",
    gift: "Initiative",
    siddhi: "Awakening",
    center: "Heart",
    programmingPartner: 57,
  },
  {
    number: 52,
    name: "Keeping Still",
    shadow: "Stress",
    gift: "Restraint",
    siddhi: "Stillness",
    center: "Root",
    programmingPartner: 58,
  },
  {
    number: 53,
    name: "Development",
    shadow: "Immaturity",
    gift: "Expansion",
    siddhi: "Superabundance",
    center: "Root",
    programmingPartner: 54,
  },
  {
    number: 54,
    name: "The Marrying Maiden",
    shadow: "Greed",
    gift: "Aspiration",
    siddhi: "Ascension",
    center: "Root",
    programmingPartner: 53,
  },
  {
    number: 55,
    name: "Abundance",
    shadow: "Victimhood",
    gift: "Freedom",
    siddhi: "Freedom",
    center: "SolarPlexus",
    programmingPartner: 59,
  },
  {
    number: 56,
    name: "The Wanderer",
    shadow: "Distraction",
    gift: "Enrichment",
    siddhi: "Intoxication",
    center: "Throat",
    programmingPartner: 60,
  },
  {
    number: 57,
    name: "The Gentle",
    shadow: "Unease",
    gift: "Intuition",
    siddhi: "Clarity",
    center: "Spleen",
    programmingPartner: 51,
  },
  {
    number: 58,
    name: "The Joyous",
    shadow: "Dissatisfaction",
    gift: "Vitality",
    siddhi: "Bliss",
    center: "Root",
    programmingPartner: 52,
  },
  {
    number: 59,
    name: "Dispersion",
    shadow: "Dishonesty",
    gift: "Intimacy",
    siddhi: "Transparency",
    center: "Sacral",
    programmingPartner: 55,
  },
  {
    number: 60,
    name: "Limitation",
    shadow: "Limitation",
    gift: "Realism",
    siddhi: "Justice",
    center: "Root",
    programmingPartner: 56,
  },
  {
    number: 61,
    name: "Inner Truth",
    shadow: "Psychosis",
    gift: "Inspiration",
    siddhi: "Sanctity",
    center: "Head",
    programmingPartner: 62,
  },
  {
    number: 62,
    name: "Preponderance of the Small",
    shadow: "Intellect",
    gift: "Precision",
    siddhi: "Impeccability",
    center: "Throat",
    programmingPartner: 61,
  },
  {
    number: 63,
    name: "After Completion",
    shadow: "Doubt",
    gift: "Inquiry",
    siddhi: "Truth",
    center: "Head",
    programmingPartner: 64,
  },
  {
    number: 64,
    name: "Before Completion",
    shadow: "Confusion",
    gift: "Imagination",
    siddhi: "Illumination",
    center: "Head",
    programmingPartner: 63,
  },
];

/**
 * Get Gene Key data for a gate number (1-64).
 */
export function getGeneKey(gateNumber: number): GeneKeyData | undefined {
  return GENE_KEYS.find((gk) => gk.number === gateNumber);
}

// ─── Center → Element mapping ────────────────────────────────────

const CENTER_ELEMENT: Record<string, Element> = {
  Head: Element.AIR,
  Ajna: Element.AIR,
  Throat: Element.ETHER,
  G: Element.ETHER,
  Heart: Element.FIRE,
  Sacral: Element.WATER,
  SolarPlexus: Element.WATER,
  Spleen: Element.EARTH,
  Root: Element.EARTH,
};

// ═════════════════════════════════════════════════════════════════
//  COSMIC SYSTEM IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════

export class IChingSystem implements CosmicSystem {
  readonly name = "iching";
  readonly displayName = "I-Ching / Gene Keys (64 Gates)";
  readonly requiresBirthData = false; // current transit doesn't need birth data
  readonly recalcInterval = { type: "hours" as const, hours: 6 };

  async calculate(_birth: BirthMoment | null, now?: Date): Promise<CosmicState> {
    const currentTime = now ?? new Date();
    const daily = getDailyCode(currentTime);
    const sunGate = daily.sunActivation.gate;
    const sunLine = daily.sunActivation.line;
    const earthGate = daily.earthActivation.gate;
    const earthLine = daily.earthActivation.line;

    const geneKey = getGeneKey(sunGate);
    const lineArchetype = LINE_ARCHETYPES[sunLine] ?? "Unknown";

    return {
      system: "iching",
      timestamp: currentTime,
      primary: {
        sunGate,
        sunLine,
        sunColor: daily.sunActivation.color,
        sunTone: daily.sunActivation.tone,
        sunBase: daily.sunActivation.base,
        earthGate,
        earthLine,
        gateName: geneKey?.name ?? "Unknown",
        shadow: geneKey?.shadow ?? "",
        gift: geneKey?.gift ?? "",
        siddhi: geneKey?.siddhi ?? "",
        center: geneKey?.center ?? "",
        programmingPartner: geneKey?.programmingPartner ?? 0,
        lineArchetype,
        sunLongitude: daily.sunLongitude,
      },
      summary:
        `Gate ${sunGate}.${sunLine} — ${geneKey?.name ?? "Unknown"} ` +
        `(${lineArchetype}). ` +
        `Shadow: ${geneKey?.shadow ?? "?"}, ` +
        `Gift: ${geneKey?.gift ?? "?"}, ` +
        `Siddhi: ${geneKey?.siddhi ?? "?"}. ` +
        `Earth: Gate ${earthGate}.${earthLine}.`,
      metrics: {
        sunGate,
        sunLine,
        earthGate,
        earthLine,
        sunLongitude: daily.sunLongitude,
      },
    };
  }

  synthesize(state: CosmicState): string {
    return state.summary;
  }

  archetypes(state: CosmicState): ArchetypeMapping {
    const center = (state.primary.center as string) ?? "";
    const element = CENTER_ELEMENT[center] ?? Element.ETHER;
    const lineArchetype = (state.primary.lineArchetype as string) ?? "Unknown";

    return {
      system: "iching",
      elements: [element],
      archetypes: [lineArchetype],
      resonanceValues: {
        gate: (state.metrics.sunGate ?? 0) / 64,
        line: (state.metrics.sunLine ?? 0) / 6,
      },
    };
  }
}
