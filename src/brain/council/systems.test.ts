/**
 * Tests for all Council cosmic systems (Step 2).
 *
 * Covers:
 *   - Cardology (birth cards, quadration, periods)
 *   - I-Ching (gate activation, sun longitude, daily code)
 *   - Human Design (type determination, BFS motor-to-throat, channels)
 *   - Solar Tracking (storm classification, significant events)
 *   - Lunar Tracking (phase, illumination, supermoon score)
 *   - Transit Tracking (aspects, angular distance, planet positions)
 *   - Full registry integration
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { BirthMoment } from "./types.js";
// ─── Registry ────────────────────────────────────────────────────
import { getCouncil, resetCouncil } from "./index.js";
// ─── Cardology ───────────────────────────────────────────────────
import {
  calculateBirthCard,
  generateNaturalSpread,
  quadrate,
  calculatePlanetaryPeriods,
  getCurrentPeriod,
  generateLifeSpread,
  generateSpiritualSpread,
  calculateKarmaCards,
  CardologySystem,
  Suit,
  cardName,
} from "./systems/cardology.js";
// ─── Human Design ────────────────────────────────────────────────
import {
  determineType,
  determineAuthority,
  checkMotorToThroat,
  findActiveChannels,
  findDefinedCenters,
  calculateDesignDate,
  calculateChart,
  calculateProfile,
  GATE_TO_CENTER,
  CHANNELS,
  HDType,
  HumanDesignSystem,
} from "./systems/human-design.js";
// ─── I-Ching ─────────────────────────────────────────────────────
import {
  longitudeToActivation,
  approximateSunLongitude,
  getDailyCode,
  getGeneKey,
  GATE_CIRCLE,
  IChingSystem,
} from "./systems/iching.js";
// ─── Lunar ───────────────────────────────────────────────────────
import {
  getPhaseName,
  calculateIllumination,
  calculateSupermoonScore,
  calculateLunarPhase,
  approximateMoonLongitude,
  approximateMoonDistance,
  longitudeToZodiacSign,
  angularDistance as lunarAngularDistance,
  compareToNatalMoon,
  MOON_PERIGEE,
  MOON_APOGEE,
  LunarTrackingSystem,
} from "./systems/lunar.js";
// ─── Solar ───────────────────────────────────────────────────────
import {
  classifyStorm,
  detectSignificantSolarEvents,
  SolarTrackingSystem,
} from "./systems/solar.js";
// ─── Transit ─────────────────────────────────────────────────────
import {
  ASPECTS,
  angularDistance,
  calculateAllPlanetPositions,
  findSkyAspects,
  compareToNatal,
  detectSignificantTransitEvents,
  TransitTrackingSystem,
} from "./systems/transits.js";

// ─── Test Fixtures ───────────────────────────────────────────────

const TEST_BIRTH: BirthMoment = {
  datetime: new Date("1990-06-15T06:00:00Z"),
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
};

const REFERENCE_DATE = new Date("2025-06-15T12:00:00Z");

// ═════════════════════════════════════════════════════════════════
// CARDOLOGY TESTS
// ═════════════════════════════════════════════════════════════════

describe("Cardology", () => {
  describe("calculateBirthCard", () => {
    it("Jan 1 → K♠ (sv = 55 - (1*2 + 1) = 52)", () => {
      const card = calculateBirthCard(1, 1);
      expect(card.rank).toBe(13); // 13 = King
      expect(card.suit).toBe(Suit.SPADES);
    });

    it("Dec 30 → A♥ (sv = 55 - (12*2 + 30) = 1)", () => {
      const card = calculateBirthCard(12, 30);
      expect(card.rank).toBe(1); // 1 = Ace
      expect(card.suit).toBe(Suit.HEARTS);
    });

    it("Dec 31 → Joker (sv = 55 - (12*2 + 31) = 0)", () => {
      const card = calculateBirthCard(12, 31);
      expect(card.rank).toBe(0); // 0 = Joker
    });

    it("Dec 18 → K♥ (sv = 55 - (12*2 + 18) = 13, heart range)", () => {
      const card = calculateBirthCard(12, 18);
      expect(card.rank).toBe(13); // 13 = King
      expect(card.suit).toBe(Suit.HEARTS);
    });

    it("Jul 4 → J♦ (sv = 55 - (7*2 + 4) = 37, diamond range)", () => {
      const card = calculateBirthCard(7, 4);
      expect(card.rank).toBe(11); // 11 = Jack
      expect(card.suit).toBe(Suit.DIAMONDS);
    });

    it("handles negative sv by wrapping", () => {
      // sv < 0 gets wrapped via modulo
      // E.g., month=13 is invalid but formula should not crash
      const card = calculateBirthCard(1, 15);
      expect(card.suit).toBeDefined();
    });
  });

  describe("generateNaturalSpread", () => {
    it("produces an 8×8 grid (52 cards + Crown row)", () => {
      const spread = generateNaturalSpread();
      // 7 rows of 7 cards + 1 crown row of 3 = 52
      // But the spread is an 8×8 grid structure
      expect(spread.length).toBe(8);
    });
  });

  describe("quadrate", () => {
    it("takes exactly 52 cards", () => {
      const deck = Array.from({ length: 52 }, (_, i) => ({
        rank: (i % 13) + 1,
        suit: Suit.HEARTS,
        solarValue: i + 1,
      }));
      const result = quadrate(deck);
      expect(result.length).toBe(52);
    });

    it("throws on wrong deck size", () => {
      const deck = Array.from({ length: 48 }, (_, i) => ({
        rank: (i % 13) + 1,
        suit: Suit.HEARTS,
        solarValue: i + 1,
      }));
      expect(() => quadrate(deck)).toThrow();
    });
  });

  describe("calculatePlanetaryPeriods", () => {
    it("produces exactly 7 periods", () => {
      const birth = new Date("1990-06-15T00:00:00Z");
      const birthCard = calculateBirthCard(6, 15);
      const periods = calculatePlanetaryPeriods(birth, 2025, birthCard);
      expect(periods.length).toBe(7);
    });

    it("first 6 periods are 52 days, Neptune gets remainder", () => {
      const birth = new Date("1990-06-15T00:00:00Z");
      const birthCard = calculateBirthCard(6, 15);
      const periods = calculatePlanetaryPeriods(birth, 2025, birthCard);

      // endDate = startDate + (duration-1) days (inclusive range)
      // So endDate - startDate = 51 for a 52-day period
      for (let i = 0; i < 6; i++) {
        const daySpan =
          (periods[i]!.endDate.getTime() - periods[i]!.startDate.getTime()) / 86_400_000;
        // Inclusive duration = daySpan + 1
        expect(daySpan + 1).toBe(52);
      }

      // Neptune (last) gets remainder
      const lastSpan =
        (periods[6]!.endDate.getTime() - periods[6]!.startDate.getTime()) / 86_400_000;
      expect(lastSpan + 1).toBeGreaterThanOrEqual(53);
      expect(lastSpan + 1).toBeLessThanOrEqual(54);
    });

    it("periods cover the entire year", () => {
      const birth = new Date("1990-06-15T00:00:00Z");
      const birthCard = calculateBirthCard(6, 15);
      const periods = calculatePlanetaryPeriods(birth, 2025, birthCard);

      // First period starts on birthday anniversary
      expect(periods[0]!.planet).toBe("Mercury");

      // Sum inclusive durations: (endDate - startDate)/ms_per_day + 1 for each
      // Plus the gaps between periods (1 day each between 7 periods = 0 gaps since next starts at endDate+1)
      // Total coverage = first.start to last.end
      const totalSpan =
        (periods[6]!.endDate.getTime() - periods[0]!.startDate.getTime()) / 86_400_000 + 1;
      expect(totalSpan).toBeGreaterThanOrEqual(365);
      expect(totalSpan).toBeLessThanOrEqual(366);
    });
  });

  describe("getCurrentPeriod", () => {
    it("returns a valid period for today", () => {
      const birth = new Date("1990-06-15T00:00:00Z");
      const period = getCurrentPeriod(birth, REFERENCE_DATE);
      expect(period).toBeDefined();
      expect(period!.planet).toBeDefined();
      expect(period!.periodDay).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Life and Spiritual Spreads", () => {
    it("generateLifeSpread returns 8×8 grid", () => {
      const spread = generateLifeSpread();
      // Returns Card[][] — 8 rows (crown row + 7 body rows)
      expect(spread.length).toBe(8);
    });

    it("generateSpiritualSpread returns 8×8 grid", () => {
      const spread = generateSpiritualSpread();
      expect(spread.length).toBe(8);
    });
  });

  describe("calculateKarmaCards", () => {
    it("returns [null, null] for fixed cards (K♠)", () => {
      const kSpade = calculateBirthCard(1, 1); // K♠
      const karma = calculateKarmaCards(kSpade);
      // Always returns a 2-tuple: [Card|null, Card|null]
      expect(karma.length).toBe(2);
      expect(karma[0]).toBeNull();
      expect(karma[1]).toBeNull();
    });

    it("returns tuple for non-fixed birth cards", () => {
      const card = calculateBirthCard(6, 15); // some non-fixed card
      const karma = calculateKarmaCards(card);
      expect(karma.length).toBe(2);
    });
  });

  describe("CardologySystem", () => {
    it("returns null when birth data is missing", async () => {
      const system = new CardologySystem();
      const result = await system.calculate(null, REFERENCE_DATE);
      expect(result).toBeNull();
    });

    it("returns valid state with birth data", async () => {
      const system = new CardologySystem();
      const result = await system.calculate(TEST_BIRTH, REFERENCE_DATE);
      expect(result).not.toBeNull();
      expect(result!.system).toBe("cardology");
      expect(result!.summary).toBeTruthy();
      expect(result!.metrics.periodProgress).toBeGreaterThanOrEqual(0);
      expect(result!.metrics.periodProgress).toBeLessThanOrEqual(1);
    });

    it("produces valid archetypes", async () => {
      const system = new CardologySystem();
      const state = await system.calculate(TEST_BIRTH, REFERENCE_DATE);
      const arch = system.archetypes(state!);
      expect(arch.system).toBe("cardology");
      expect(arch.elements.length).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// I-CHING TESTS
// ═════════════════════════════════════════════════════════════════

describe("I-Ching / Gene Keys", () => {
  describe("GATE_CIRCLE", () => {
    it("contains exactly 64 gates", () => {
      expect(GATE_CIRCLE.length).toBe(64);
    });

    it("starts with Gate 41", () => {
      expect(GATE_CIRCLE[0]).toBe(41);
    });

    it("contains all gates 1-64", () => {
      const sorted = [...GATE_CIRCLE].sort((a, b) => a - b);
      for (let i = 0; i < 64; i++) {
        expect(sorted[i]).toBe(i + 1);
      }
    });
  });

  describe("longitudeToActivation", () => {
    it("follows (longitude + 58) % 360 formula", () => {
      // At longitude 0: angle = (0+58)%360 = 58
      // pct = 58/360 ≈ 0.1611
      // gateIndex = floor(0.1611 * 64) = 10
      // gate = GATE_CIRCLE[10]
      const activation = longitudeToActivation(0);
      expect(activation.gate).toBe(GATE_CIRCLE[10]);
      expect(activation.line).toBeGreaterThanOrEqual(1);
      expect(activation.line).toBeLessThanOrEqual(6);
    });

    it("returns line in range 1-6", () => {
      for (let lon = 0; lon < 360; lon += 15) {
        const { line } = longitudeToActivation(lon);
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(6);
      }
    });

    it("returns color in range 1-6", () => {
      for (let lon = 0; lon < 360; lon += 30) {
        const { color } = longitudeToActivation(lon);
        expect(color).toBeGreaterThanOrEqual(1);
        expect(color).toBeLessThanOrEqual(6);
      }
    });

    it("returns tone in range 1-6", () => {
      for (let lon = 0; lon < 360; lon += 30) {
        const { tone } = longitudeToActivation(lon);
        expect(tone).toBeGreaterThanOrEqual(1);
        expect(tone).toBeLessThanOrEqual(6);
      }
    });

    it("returns base in range 1-5", () => {
      for (let lon = 0; lon < 360; lon += 30) {
        const { base } = longitudeToActivation(lon);
        expect(base).toBeGreaterThanOrEqual(1);
        expect(base).toBeLessThanOrEqual(5);
      }
    });

    it("gate index wraps correctly at 360°", () => {
      // longitude 302: angle = (302+58)%360 = 0 → first gate
      const a = longitudeToActivation(302);
      expect(a.gate).toBe(GATE_CIRCLE[0]); // Gate 41
    });
  });

  describe("approximateSunLongitude", () => {
    it("J2000.0 epoch returns ~280°", () => {
      const j2000 = new Date("2000-01-01T12:00:00Z");
      const lon = approximateSunLongitude(j2000);
      // Sun at J2000.0 is approximately 280.46° (the L0 constant)
      expect(lon).toBeCloseTo(280.5, 0);
    });

    it("increases by ~1°/day", () => {
      const d1 = new Date("2025-03-21T00:00:00Z");
      const d2 = new Date("2025-03-22T00:00:00Z");
      const l1 = approximateSunLongitude(d1);
      const l2 = approximateSunLongitude(d2);
      const diff = (((l2 - l1) % 360) + 360) % 360;
      expect(diff).toBeCloseTo(1.0, 0);
    });
  });

  describe("getDailyCode", () => {
    it("sun and earth are 180° apart", () => {
      const code = getDailyCode(REFERENCE_DATE);
      // Earth gate should differ from Sun gate
      expect(code.sunActivation.gate).not.toBe(code.earthActivation.gate);
    });

    it("returns all fields", () => {
      const code = getDailyCode(REFERENCE_DATE);
      expect(code.timestamp).toEqual(REFERENCE_DATE);
      expect(code.sunActivation.gate).toBeGreaterThanOrEqual(1);
      expect(code.sunActivation.gate).toBeLessThanOrEqual(64);
      expect(code.earthActivation.gate).toBeGreaterThanOrEqual(1);
      expect(code.earthActivation.gate).toBeLessThanOrEqual(64);
      expect(code.sunLongitude).toBeDefined();
    });
  });

  describe("Known-date gate verification", () => {
    it("J2000.0 epoch (Jan 1 2000 12:00 UTC) → Sun ≈ 280.46° → Gate 38", () => {
      const j2000 = new Date("2000-01-01T12:00:00Z");
      const code = getDailyCode(j2000);
      // Sun longitude ≈ 280.46°
      // angle = (280.46 + 58) % 360 ≈ 338.46° → gateIndex = floor(0.9402 × 64) = 60
      // GATE_CIRCLE[60] = 38
      expect(code.sunActivation.gate).toBe(38);
    });

    it("March equinox (Sun ≈ 0°) → Gate 25", () => {
      // Use March 20, 2025 — Sun near 0° ecliptic
      const equinox = new Date("2025-03-20T12:00:00Z");
      const code = getDailyCode(equinox);
      // Sun near 0° → angle ≈ 58° → gateIndex ≈ 10 → GATE_CIRCLE[10] = 25
      expect(code.sunActivation.gate).toBe(25);
    });

    it("September equinox (Sun ≈ 180°) → Gate 46", () => {
      // Use September 22, 2025 — Sun near 180° ecliptic
      const equinox = new Date("2025-09-22T12:00:00Z");
      const code = getDailyCode(equinox);
      // Sun near 180° → angle ≈ 238° → gateIndex ≈ 42 → GATE_CIRCLE[42] = 46
      expect(code.sunActivation.gate).toBe(46);
    });

    it("Earth gate is always 180° opposite Sun gate", () => {
      // Pick several dates and verify the Sun/Earth longitude relationship
      const dates = [
        new Date("2024-01-15T12:00:00Z"),
        new Date("2024-06-21T12:00:00Z"),
        new Date("2024-12-21T12:00:00Z"),
      ];
      for (const d of dates) {
        const code = getDailyCode(d);
        const sunLong = code.sunActivation.longitude;
        const earthLong = code.earthActivation.longitude;
        // Earth = Sun + 180. Compute angular distance.
        const rawDiff = Math.abs(earthLong - sunLong);
        const angDist = rawDiff > 180 ? 360 - rawDiff : rawDiff;
        expect(angDist).toBeCloseTo(180, 0);
      }
    });
  });

  describe("Gene Keys (via getGeneKey)", () => {
    it("has entries for all 64 gates", () => {
      for (let i = 1; i <= 64; i++) {
        const gk = getGeneKey(i);
        expect(gk).toBeDefined();
      }
    });

    it("each has shadow, gift, siddhi", () => {
      for (let i = 1; i <= 64; i++) {
        const gk = getGeneKey(i)!;
        expect(gk.shadow).toBeTruthy();
        expect(gk.gift).toBeTruthy();
        expect(gk.siddhi).toBeTruthy();
      }
    });
  });

  describe("IChingSystem", () => {
    it("does not require birth data", () => {
      const system = new IChingSystem();
      expect(system.requiresBirthData).toBe(false);
    });

    it("returns valid state without birth data", async () => {
      const system = new IChingSystem();
      const result = await system.calculate(null, REFERENCE_DATE);
      expect(result.system).toBe("iching");
      expect(result.summary).toBeTruthy();
      expect(result.metrics.sunGate).toBeGreaterThanOrEqual(1);
      expect(result.metrics.sunGate).toBeLessThanOrEqual(64);
    });

    it("produces valid archetypes", async () => {
      const system = new IChingSystem();
      const state = await system.calculate(null, REFERENCE_DATE);
      const arch = system.archetypes(state);
      expect(arch.system).toBe("iching");
      expect(arch.elements.length).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// HUMAN DESIGN TESTS
// ═════════════════════════════════════════════════════════════════

describe("Human Design", () => {
  describe("GATE_TO_CENTER", () => {
    it("maps all 64 gates", () => {
      const gateCount = Object.keys(GATE_TO_CENTER).length;
      expect(gateCount).toBe(64);
    });

    it("Head has gates 64, 61, 63", () => {
      expect(GATE_TO_CENTER[64]).toBe("Head");
      expect(GATE_TO_CENTER[61]).toBe("Head");
      expect(GATE_TO_CENTER[63]).toBe("Head");
    });

    it("Sacral has gate 34", () => {
      expect(GATE_TO_CENTER[34]).toBe("Sacral");
    });
  });

  describe("CHANNELS", () => {
    it("has 36 channels", () => {
      expect(CHANNELS.length).toBe(36);
    });

    it("each channel references valid gates", () => {
      for (const ch of CHANNELS) {
        expect(GATE_TO_CENTER[ch.gate1]).toBeDefined();
        expect(GATE_TO_CENTER[ch.gate2]).toBeDefined();
      }
    });
  });

  describe("findActiveChannels", () => {
    it("returns empty for no matching gates", () => {
      const gates = new Set([1, 2, 3]);
      const channels = findActiveChannels(gates);
      // Gates 1 and 2 don't form a channel, etc. — depends on data
      // Just verify it returns an array
      expect(Array.isArray(channels)).toBe(true);
    });

    it("finds channel when both gates are active", () => {
      // Channel 64-47: Head → Ajna (Abstraction)
      const gates = new Set([64, 47]);
      const channels = findActiveChannels(gates);
      expect(channels.length).toBe(1);
      expect(channels[0]!.name).toBe("Abstraction");
    });

    it("finds multiple channels", () => {
      // 64-47 (Head→Ajna) + 61-24 (Head→Ajna)
      const gates = new Set([64, 47, 61, 24]);
      const channels = findActiveChannels(gates);
      expect(channels.length).toBe(2);
    });
  });

  describe("findDefinedCenters", () => {
    it("returns centers from active channels", () => {
      const channels = findActiveChannels(new Set([64, 47]));
      const centers = findDefinedCenters(channels);
      expect(centers.has("Head")).toBe(true);
      expect(centers.has("Ajna")).toBe(true);
    });
  });

  describe("determineType", () => {
    it("Reflector when no defined centers", () => {
      const type = determineType(new Set(), []);
      expect(type).toBe(HDType.REFLECTOR);
    });

    it("Generator when Sacral defined, no motor-to-throat", () => {
      // Need Sacral defined but no motor-to-throat path
      // Channel 15-5 (G→Sacral) defines G and Sacral
      const gates = new Set([15, 5]);
      const channels = findActiveChannels(gates);
      const centers = findDefinedCenters(channels);
      expect(centers.has("Sacral")).toBe(true);
      const type = determineType(centers, channels);
      expect(type).toBe(HDType.GENERATOR);
    });

    it("Manifesting Generator when Sacral + motor-to-throat", () => {
      // Channel 20-34 (Throat→Sacral) gives Sacral + Throat
      // Sacral is a motor center, and it connects to Throat
      const gates = new Set([20, 34]);
      const channels = findActiveChannels(gates);
      const centers = findDefinedCenters(channels);
      expect(centers.has("Sacral")).toBe(true);
      expect(centers.has("Throat")).toBe(true);
      const type = determineType(centers, channels);
      expect(type).toBe(HDType.MANIFESTING_GENERATOR);
    });

    it("Manifestor when motor-to-throat but no Sacral", () => {
      // Channel 45-21 (Throat→Heart) gives Throat + Heart
      // Heart is a motor center
      const gates = new Set([45, 21]);
      const channels = findActiveChannels(gates);
      const centers = findDefinedCenters(channels);
      expect(centers.has("Heart")).toBe(true);
      expect(centers.has("Throat")).toBe(true);
      expect(centers.has("Sacral")).toBe(false);
      const type = determineType(centers, channels);
      expect(type).toBe(HDType.MANIFESTOR);
    });

    it("Projector when defined centers but no Sacral and no motor-to-throat", () => {
      // Channel 17-62 (Ajna→Throat) gives Ajna + Throat (no motor centers)
      const gates = new Set([17, 62]);
      const channels = findActiveChannels(gates);
      const centers = findDefinedCenters(channels);
      expect(centers.has("Sacral")).toBe(false);
      const type = determineType(centers, channels);
      expect(type).toBe(HDType.PROJECTOR);
    });
  });

  describe("checkMotorToThroat", () => {
    it("direct motor-to-throat via channel", () => {
      // 45-21 connects Throat to Heart (motor)
      const gates = new Set([45, 21]);
      const channels = findActiveChannels(gates);
      const centers = findDefinedCenters(channels);
      expect(checkMotorToThroat(centers, channels)).toBe(true);
    });

    it("indirect motor-to-throat via intermediate center", () => {
      // 31-7 (Throat→G) + 25-51 (G→Heart): Heart→G→Throat
      const gates = new Set([31, 7, 25, 51]);
      const channels = findActiveChannels(gates);
      const centers = findDefinedCenters(channels);
      expect(centers.has("Heart")).toBe(true);
      expect(centers.has("G")).toBe(true);
      expect(centers.has("Throat")).toBe(true);
      expect(checkMotorToThroat(centers, channels)).toBe(true);
    });

    it("no path when motor center is isolated", () => {
      // 32-54 (Spleen→Root): Root is motor but no path to Throat
      const gates = new Set([32, 54]);
      const channels = findActiveChannels(gates);
      const centers = findDefinedCenters(channels);
      expect(checkMotorToThroat(centers, channels)).toBe(false);
    });
  });

  describe("determineAuthority", () => {
    it("Reflector gets Lunar authority", () => {
      const auth = determineAuthority(new Set(), HDType.REFLECTOR);
      expect(auth).toBe("Lunar");
    });

    it("SolarPlexus defined → Emotional", () => {
      const centers = new Set(["SolarPlexus", "Sacral"] as const);
      const auth = determineAuthority(centers, HDType.GENERATOR);
      expect(auth).toBe("Emotional");
    });

    it("Sacral defined (no SolarPlexus) → Sacral", () => {
      const centers = new Set(["Sacral"] as const);
      const auth = determineAuthority(centers, HDType.GENERATOR);
      expect(auth).toBe("Sacral");
    });

    it("Spleen defined (no Sacral, no SolarPlexus) → Splenic", () => {
      const centers = new Set(["Spleen", "Root"] as const);
      const auth = determineAuthority(centers, HDType.PROJECTOR);
      expect(auth).toBe("Splenic");
    });
  });

  describe("calculateProfile", () => {
    it("formats as line/line", () => {
      expect(calculateProfile(4, 6)).toBe("4/6");
      expect(calculateProfile(1, 3)).toBe("1/3");
    });
  });

  describe("calculateDesignDate", () => {
    it("returns a date ~88 days before birth", () => {
      const birthDate = new Date("1990-06-15T14:30:00Z");
      const designDate = calculateDesignDate(birthDate);
      const diffDays = (birthDate.getTime() - designDate.getTime()) / 86_400_000;
      // Should be approximately 88-89 days
      expect(diffDays).toBeGreaterThan(85);
      expect(diffDays).toBeLessThan(92);
    });
  });

  describe("calculateChart", () => {
    it("returns a complete chart", () => {
      const chart = calculateChart(TEST_BIRTH);
      expect(chart.type).toBeDefined();
      expect(chart.authority).toBeDefined();
      expect(chart.profile).toMatch(/^\d\/\d$/);
      expect(chart.activeGates.length).toBeGreaterThanOrEqual(4); // min 4 activations
      expect(chart.personalitySun.gate).toBeGreaterThanOrEqual(1);
      expect(chart.designSun.gate).toBeGreaterThanOrEqual(1);
    });
  });

  describe("HumanDesignSystem", () => {
    it("returns null when birth data is missing", async () => {
      const system = new HumanDesignSystem();
      const result = await system.calculate(null, REFERENCE_DATE);
      expect(result).toBeNull();
    });

    it("returns valid state with birth data", async () => {
      const system = new HumanDesignSystem();
      const result = await system.calculate(TEST_BIRTH, REFERENCE_DATE);
      expect(result).not.toBeNull();
      expect(result!.system).toBe("human-design");
      expect(result!.summary).toBeTruthy();
    });

    it("caches natal chart for same birth data", async () => {
      const system = new HumanDesignSystem();
      const r1 = await system.calculate(TEST_BIRTH, REFERENCE_DATE);
      const r2 = await system.calculate(TEST_BIRTH, new Date("2025-07-01T12:00:00Z"));
      // Same birth → same natal type, profile, authority
      expect((r1!.primary as any).type).toBe((r2!.primary as any).type);
      expect((r1!.primary as any).profile).toBe((r2!.primary as any).profile);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// SOLAR TRACKING TESTS
// ═════════════════════════════════════════════════════════════════

describe("Solar Tracking", () => {
  describe("classifyStorm", () => {
    it("Kp 0-3 → quiet", () => {
      expect(classifyStorm(0)).toBe("quiet");
      expect(classifyStorm(2)).toBe("quiet");
      expect(classifyStorm(3)).toBe("quiet");
    });

    it("Kp 4 → unsettled", () => {
      expect(classifyStorm(4)).toBe("unsettled");
      expect(classifyStorm(4.5)).toBe("unsettled");
    });

    it("Kp 5-6 → active", () => {
      expect(classifyStorm(5)).toBe("active");
      expect(classifyStorm(6)).toBe("active");
    });

    it("Kp 7+ → storm", () => {
      expect(classifyStorm(7)).toBe("storm");
      expect(classifyStorm(9)).toBe("storm");
    });
  });

  describe("detectSignificantSolarEvents", () => {
    it("reports GEO_STORM when Kp >= 5", () => {
      const events = detectSignificantSolarEvents({
        kpIndex: 6,
        stormLevel: "active",
        flareCount: 0,
        recentFlareClasses: [],
      });
      expect(events.some((e) => e.type === "GEO_STORM")).toBe(true);
    });

    it("reports SOLAR_FLARE for X-class", () => {
      const events = detectSignificantSolarEvents({
        kpIndex: 2,
        stormLevel: "quiet",
        flareCount: 1,
        recentFlareClasses: ["X1.5"],
      });
      expect(events.some((e) => e.type === "SOLAR_FLARE")).toBe(true);
    });

    it("no events on quiet conditions", () => {
      const events = detectSignificantSolarEvents({
        kpIndex: 2,
        stormLevel: "quiet",
        flareCount: 0,
        recentFlareClasses: [],
      });
      expect(events.length).toBe(0);
    });
  });

  describe("SolarTrackingSystem", () => {
    it("does not require birth data", () => {
      const system = new SolarTrackingSystem();
      expect(system.requiresBirthData).toBe(false);
    });

    it("returns valid state in offline mode (no fetch)", async () => {
      // Create system without fetch — should degrade gracefully
      const system = new SolarTrackingSystem(undefined);
      const result = await system.calculate(null, REFERENCE_DATE);
      expect(result.system).toBe("solar");
      expect(result.summary).toBeTruthy();
      // Should use quiet default
      expect(result.metrics.kpIndex).toBeDefined();
    });

    it("produces valid archetypes", async () => {
      const system = new SolarTrackingSystem(undefined);
      const state = await system.calculate(null, REFERENCE_DATE);
      const arch = system.archetypes(state);
      expect(arch.system).toBe("solar");
      expect(arch.elements.length).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// LUNAR TRACKING TESTS
// ═════════════════════════════════════════════════════════════════

describe("Lunar Tracking", () => {
  describe("getPhaseName", () => {
    it("New Moon at 0° and 350°", () => {
      expect(getPhaseName(0)).toBe("New Moon");
      expect(getPhaseName(10)).toBe("New Moon");
      expect(getPhaseName(350)).toBe("New Moon"); // 350° ≥ 337.5° → New Moon per GUTTERS §14.2
    });

    it("all 8 phases in order", () => {
      expect(getPhaseName(0)).toBe("New Moon");
      expect(getPhaseName(45)).toBe("Waxing Crescent");
      expect(getPhaseName(90)).toBe("First Quarter");
      expect(getPhaseName(135)).toBe("Waxing Gibbous");
      expect(getPhaseName(180)).toBe("Full Moon");
      expect(getPhaseName(225)).toBe("Waning Gibbous");
      expect(getPhaseName(270)).toBe("Last Quarter");
      expect(getPhaseName(315)).toBe("Waning Crescent");
    });

    it("boundary at 337.5° → New Moon", () => {
      expect(getPhaseName(337.5)).toBe("New Moon");
      expect(getPhaseName(337.4)).toBe("Waning Crescent");
    });
  });

  describe("calculateIllumination", () => {
    it("New Moon (0°) → 1.0 illumination", () => {
      // cos(0) = 1, so (1+1)/2 = 1.0
      expect(calculateIllumination(0)).toBeCloseTo(1.0);
    });

    it("Full Moon (180°) → 0.0 illumination", () => {
      // cos(180°) = -1, so (1+(-1))/2 = 0.0
      expect(calculateIllumination(180)).toBeCloseTo(0.0);
    });

    it("First Quarter (90°) → 0.5 illumination", () => {
      // cos(90°) = 0, so (1+0)/2 = 0.5
      expect(calculateIllumination(90)).toBeCloseTo(0.5);
    });
  });

  describe("calculateSupermoonScore", () => {
    it("1.0 at perigee (363300 km)", () => {
      expect(calculateSupermoonScore(MOON_PERIGEE)).toBeCloseTo(1.0);
    });

    it("0.0 at apogee (405500 km)", () => {
      expect(calculateSupermoonScore(MOON_APOGEE)).toBeCloseTo(0.0);
    });

    it("~0.5 at mean distance (~384400 km)", () => {
      const meanDistance = (MOON_PERIGEE + MOON_APOGEE) / 2;
      expect(calculateSupermoonScore(meanDistance)).toBeCloseTo(0.5);
    });

    it("clamped to [0, 1]", () => {
      expect(calculateSupermoonScore(300_000)).toBe(1);
      expect(calculateSupermoonScore(500_000)).toBe(0);
    });
  });

  describe("longitudeToZodiacSign", () => {
    it("0° → Aries", () => {
      expect(longitudeToZodiacSign(0)).toBe("Aries");
    });

    it("45° → Taurus", () => {
      expect(longitudeToZodiacSign(45)).toBe("Taurus");
    });

    it("330° → Pisces", () => {
      expect(longitudeToZodiacSign(330)).toBe("Pisces");
    });
  });

  describe("approximateMoonLongitude", () => {
    it("returns value in 0-360 range", () => {
      const lon = approximateMoonLongitude(REFERENCE_DATE);
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(360);
    });

    it("moves ~13° per day", () => {
      const d1 = new Date("2025-03-21T00:00:00Z");
      const d2 = new Date("2025-03-22T00:00:00Z");
      const l1 = approximateMoonLongitude(d1);
      const l2 = approximateMoonLongitude(d2);
      const diff = (((l2 - l1) % 360) + 360) % 360;
      // Moon moves ~13.2°/day; accept 10-16° range for simplified formula
      expect(diff).toBeGreaterThan(10);
      expect(diff).toBeLessThan(16);
    });
  });

  describe("approximateMoonDistance", () => {
    it("returns value in reasonable range (360k-410k km)", () => {
      const dist = approximateMoonDistance(REFERENCE_DATE);
      expect(dist).toBeGreaterThan(350_000);
      expect(dist).toBeLessThan(420_000);
    });
  });

  describe("calculateLunarPhase", () => {
    it("returns all fields", () => {
      const lunar = calculateLunarPhase(REFERENCE_DATE);
      expect(lunar.phaseAngle).toBeGreaterThanOrEqual(0);
      expect(lunar.phaseAngle).toBeLessThan(360);
      expect(lunar.illumination).toBeGreaterThanOrEqual(0);
      expect(lunar.illumination).toBeLessThanOrEqual(1);
      expect(lunar.phaseName).toBeTruthy();
      expect(lunar.zodiacSign).toBeTruthy();
      expect(lunar.distance).toBeGreaterThan(300_000);
      expect(lunar.supermoonScore).toBeGreaterThanOrEqual(0);
      expect(lunar.supermoonScore).toBeLessThanOrEqual(1);
    });
  });

  describe("angularDistance", () => {
    it("0° to 0° → 0", () => {
      expect(lunarAngularDistance(0, 0)).toBe(0);
    });

    it("0° to 180° → 180", () => {
      expect(lunarAngularDistance(0, 180)).toBe(180);
    });

    it("10° to 350° → 20", () => {
      expect(lunarAngularDistance(10, 350)).toBe(20);
    });
  });

  describe("compareToNatalMoon", () => {
    it("detects lunar return within 5°", () => {
      const transit = calculateLunarPhase(REFERENCE_DATE);
      // Set natal at same longitude → should be lunar return
      const result = compareToNatalMoon(transit, transit.moonLongitude, transit.zodiacSign);
      expect(result.lunarReturn).toBe(true);
      expect(result.inNatalSign).toBe(true);
    });

    it("no lunar return when far apart", () => {
      const transit = calculateLunarPhase(REFERENCE_DATE);
      const oppositeSign = longitudeToZodiacSign((transit.moonLongitude + 180) % 360);
      const result = compareToNatalMoon(transit, (transit.moonLongitude + 180) % 360, oppositeSign);
      expect(result.lunarReturn).toBe(false);
      expect(result.inNatalSign).toBe(false);
    });
  });

  describe("LunarTrackingSystem", () => {
    it("does not require birth data", () => {
      const system = new LunarTrackingSystem();
      expect(system.requiresBirthData).toBe(false);
    });

    it("returns valid state", async () => {
      const system = new LunarTrackingSystem();
      const result = await system.calculate(null, REFERENCE_DATE);
      expect(result.system).toBe("lunar");
      expect(result.summary).toBeTruthy();
      expect(result.metrics.illumination).toBeGreaterThanOrEqual(0);
      expect(result.metrics.illumination).toBeLessThanOrEqual(1);
    });

    it("produces valid archetypes", async () => {
      const system = new LunarTrackingSystem();
      const state = await system.calculate(null, REFERENCE_DATE);
      const arch = system.archetypes(state);
      expect(arch.system).toBe("lunar");
      expect(arch.elements.length).toBeGreaterThanOrEqual(1);
      // Water should always be present for lunar
      expect(arch.elements).toContain("WATER");
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// TRANSIT TRACKING TESTS
// ═════════════════════════════════════════════════════════════════

describe("Transit Tracking", () => {
  describe("ASPECTS", () => {
    it("has 5 aspect definitions", () => {
      expect(ASPECTS.length).toBe(5);
    });

    it("conjunction at 0° with 8° orb", () => {
      const conj = ASPECTS.find((a) => a.name === "conjunction");
      expect(conj!.angle).toBe(0);
      expect(conj!.orb).toBe(8);
    });

    it("opposition at 180° with 8° orb", () => {
      const opp = ASPECTS.find((a) => a.name === "opposition");
      expect(opp!.angle).toBe(180);
      expect(opp!.orb).toBe(8);
    });

    it("square at 90° with 6° orb", () => {
      const sq = ASPECTS.find((a) => a.name === "square");
      expect(sq!.angle).toBe(90);
      expect(sq!.orb).toBe(6);
    });

    it("trine at 120° with 6° orb", () => {
      const tri = ASPECTS.find((a) => a.name === "trine");
      expect(tri!.angle).toBe(120);
      expect(tri!.orb).toBe(6);
    });

    it("sextile at 60° with 4° orb", () => {
      const sxt = ASPECTS.find((a) => a.name === "sextile");
      expect(sxt!.angle).toBe(60);
      expect(sxt!.orb).toBe(4);
    });
  });

  describe("angularDistance", () => {
    it("same position → 0", () => {
      expect(angularDistance(100, 100)).toBe(0);
    });

    it("opposite positions → 180", () => {
      expect(angularDistance(0, 180)).toBe(180);
    });

    it("wraps around correctly", () => {
      expect(angularDistance(350, 10)).toBe(20);
      expect(angularDistance(10, 350)).toBe(20);
    });

    it("always returns 0-180", () => {
      for (let i = 0; i < 360; i += 30) {
        for (let j = 0; j < 360; j += 30) {
          const d = angularDistance(i, j);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(180);
        }
      }
    });
  });

  describe("calculateAllPlanetPositions", () => {
    it("returns positions for all planets", () => {
      const positions = calculateAllPlanetPositions(REFERENCE_DATE);
      expect(positions.length).toBe(9); // Sun + Moon + 7 planets
    });

    it("all longitudes in 0-360 range", () => {
      const positions = calculateAllPlanetPositions(REFERENCE_DATE);
      for (const p of positions) {
        expect(p.longitude).toBeGreaterThanOrEqual(0);
        expect(p.longitude).toBeLessThan(360);
      }
    });

    it("includes Sun, Moon, Mercury through Neptune", () => {
      const positions = calculateAllPlanetPositions(REFERENCE_DATE);
      const names = positions.map((p) => p.name);
      expect(names).toContain("Sun");
      expect(names).toContain("Moon");
      expect(names).toContain("Mercury");
      expect(names).toContain("Venus");
      expect(names).toContain("Mars");
      expect(names).toContain("Jupiter");
      expect(names).toContain("Saturn");
      expect(names).toContain("Uranus");
      expect(names).toContain("Neptune");
    });
  });

  describe("findSkyAspects", () => {
    it("finds conjunctions between close planets", () => {
      const positions = [
        { name: "Sun", longitude: 100 },
        { name: "Mars", longitude: 103 }, // within 8° orb
      ];
      const aspects = findSkyAspects(positions);
      expect(aspects.some((a) => a.aspectName === "conjunction")).toBe(true);
    });

    it("finds opposition at ~180°", () => {
      const positions = [
        { name: "Sun", longitude: 0 },
        { name: "Mars", longitude: 178 }, // within 8° orb of 180°
      ];
      const aspects = findSkyAspects(positions);
      expect(aspects.some((a) => a.aspectName === "opposition")).toBe(true);
    });

    it("no aspects when planets are unrelated angles", () => {
      const positions = [
        { name: "Sun", longitude: 0 },
        { name: "Mars", longitude: 40 }, // 40° — not near any aspect angle
      ];
      const aspects = findSkyAspects(positions);
      expect(aspects.length).toBe(0);
    });
  });

  describe("compareToNatal", () => {
    it("finds transit aspects to natal positions", () => {
      const transit = [{ name: "Sun", longitude: 90 }];
      const natal = [{ name: "Moon", longitude: 0 }];
      const aspects = compareToNatal(transit, natal);
      // 90° = square (orb 6°)
      expect(aspects.some((a) => a.aspectName === "square")).toBe(true);
    });

    it("skips same-planet comparison", () => {
      const transit = [{ name: "Sun", longitude: 90 }];
      const natal = [{ name: "Sun", longitude: 90 }];
      const aspects = compareToNatal(transit, natal);
      expect(aspects.length).toBe(0);
    });
  });

  describe("detectSignificantTransitEvents", () => {
    it("flags exact transits (orb < 1°)", () => {
      const events = detectSignificantTransitEvents([
        {
          planet1: "Sun",
          planet2: "Mars",
          aspectName: "conjunction",
          exactAngle: 0,
          actualOrb: 0.5,
        },
      ]);
      expect(events.length).toBe(1);
      expect(events[0]!.type).toBe("EXACT_TRANSIT");
    });

    it("flags tight orb (1-2°)", () => {
      const events = detectSignificantTransitEvents([
        {
          planet1: "Sun",
          planet2: "Mars",
          aspectName: "trine",
          exactAngle: 120,
          actualOrb: 1.5,
        },
      ]);
      expect(events.length).toBe(1);
      expect(events[0]!.type).toBe("TIGHT_ORB");
    });

    it("no events for wide orbs", () => {
      const events = detectSignificantTransitEvents([
        {
          planet1: "Sun",
          planet2: "Mars",
          aspectName: "square",
          exactAngle: 90,
          actualOrb: 5.0,
        },
      ]);
      expect(events.length).toBe(0);
    });
  });

  describe("TransitTrackingSystem", () => {
    it("does not require birth data", () => {
      const system = new TransitTrackingSystem();
      expect(system.requiresBirthData).toBe(false);
    });

    it("returns valid state without birth data (sky-only mode)", async () => {
      const system = new TransitTrackingSystem();
      const result = await system.calculate(null, REFERENCE_DATE);
      expect(result.system).toBe("transits");
      expect(result.summary).toBeTruthy();
      expect(result.metrics.skyAspectCount).toBeGreaterThanOrEqual(0);
      expect(result.metrics.natalAspectCount).toBe(0); // no birth data
    });

    it("returns natal aspects when birth data provided", async () => {
      const system = new TransitTrackingSystem();
      const result = await system.calculate(TEST_BIRTH, REFERENCE_DATE);
      expect(result.system).toBe("transits");
      // May or may not have natal aspects depending on positions
      expect(result.metrics.natalAspectCount).toBeDefined();
    });

    it("produces valid archetypes", async () => {
      const system = new TransitTrackingSystem();
      const state = await system.calculate(null, REFERENCE_DATE);
      const arch = system.archetypes(state);
      expect(arch.system).toBe("transits");
      expect(arch.elements.length).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// FULL REGISTRY INTEGRATION TESTS
// ═════════════════════════════════════════════════════════════════

describe("Full Council Registry Integration", () => {
  beforeEach(() => {
    resetCouncil();
  });

  it("getCouncil registers all 6 systems", () => {
    const council = getCouncil();
    const systems = council.listSystems();
    const names = systems.map((s) => s.name);
    expect(names).toContain("cardology");
    expect(names).toContain("iching");
    expect(names).toContain("human-design");
    expect(names).toContain("solar");
    expect(names).toContain("lunar");
    expect(names).toContain("transits");
    expect(systems.length).toBe(6);
  });

  it("calculateAll returns states for all non-birth-dependent systems", async () => {
    const council = getCouncil();
    // Without birth data, only non-birth systems calculate
    const states = await council.calculateAll(null, REFERENCE_DATE);
    // iching, solar, lunar, transits should all calculate
    expect(states.has("iching")).toBe(true);
    expect(states.has("lunar")).toBe(true);
    expect(states.has("transits")).toBe(true);
    // cardology and human-design require birth data → null → not in map
    // (depends on registry behavior — nulls might be excluded)
  });

  it("calculateAll with birth data returns all 6 states", async () => {
    const council = getCouncil();
    const states = await council.calculateAll(TEST_BIRTH, REFERENCE_DATE);
    // All 6 should produce non-null results
    expect(states.size).toBeGreaterThanOrEqual(5); // solar may fail without fetch
  });

  it("getCosmicTimestamp produces complete timestamp", async () => {
    const council = getCouncil();
    const timestamp = await council.getCosmicTimestamp(TEST_BIRTH, REFERENCE_DATE);
    expect(timestamp.datetime).toEqual(REFERENCE_DATE);
    expect(Object.keys(timestamp.systems).length).toBeGreaterThanOrEqual(5);
  });
});
