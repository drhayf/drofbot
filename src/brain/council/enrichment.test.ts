/**
 * Tests for Cosmic Enrichment & Retrieval Filtering (Step 3)
 *
 * Tests the enrichment pipeline (creating snapshots, enriching metadata)
 * and the cosmic filter matching used by the retriever.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CosmicTimestamp, CosmicState, BirthMoment } from "./types.js";
import {
  createCosmicSnapshot,
  enrichWithCosmic,
  initEnrichment,
  matchesCosmicFilter,
  type CosmicFilter,
  type CosmicSnapshot,
} from "./enrichment.js";

// ═════════════════════════════════════════════════════════════════
// Test Fixtures
// ═════════════════════════════════════════════════════════════════

const TEST_DATE = new Date("2025-06-15T12:00:00Z");

function makeState(
  system: string,
  primary: Record<string, unknown>,
  metrics: Record<string, unknown>,
): CosmicState {
  return {
    system,
    timestamp: TEST_DATE,
    primary,
    summary: `Test ${system} state`,
    metrics,
  };
}

const FULL_TIMESTAMP: CosmicTimestamp = {
  datetime: TEST_DATE,
  systems: {
    cardology: makeState(
      "cardology",
      {
        currentPlanet: "Neptune",
        currentCard: "5♠",
        periodDay: 35,
        birthCardSuit: "♦",
      },
      { periodProgress: 0.67 },
    ),
    iching: makeState(
      "iching",
      {
        sunGate: 48,
        sunLine: 3,
      },
      { sunGate: 48, sunLine: 3, earthGate: 21, earthLine: 3 },
    ),
    lunar: makeState(
      "lunar",
      {
        phaseName: "Waxing Gibbous",
        illumination: 0.78,
      },
      { illumination: 0.78 },
    ),
    solar: makeState(
      "solar",
      {
        kpIndex: 3,
        stormLevel: "quiet",
      },
      { kpIndex: 3 },
    ),
    "human-design": makeState(
      "human-design",
      {
        type: "Projector",
        authority: "Splenic",
      },
      { definedCenterCount: 4 },
    ),
    transits: makeState(
      "transits",
      {
        tightestAspect: "Sun conjunction Venus",
      },
      { skyAspectCount: 5 },
    ),
  },
};

// ═════════════════════════════════════════════════════════════════
// createCosmicSnapshot
// ═════════════════════════════════════════════════════════════════

describe("createCosmicSnapshot", () => {
  it("creates a compact snapshot from a full timestamp", () => {
    const snap = createCosmicSnapshot(FULL_TIMESTAMP);

    expect(snap.ts).toBe("2025-06-15T12:00:00.000Z");
    expect(snap.card).toEqual({
      planet: "Neptune",
      card: "5♠",
      day: 35,
      suit: "♦",
    });
    expect(snap.gate).toEqual({ sun: 48, line: 3, earth: 21 });
    expect(snap.moon).toEqual({ phase: "Waxing Gibbous", illum: 0.78 });
    expect(snap.solar).toEqual({ kp: 3, storm: "quiet" });
    expect(snap.hd).toEqual({ type: "Projector", authority: "Splenic" });
    expect(snap.transits).toEqual({ count: 5, tightest: "Sun conjunction Venus" });
  });

  it("handles partial timestamp (only some systems present)", () => {
    const partial: CosmicTimestamp = {
      datetime: TEST_DATE,
      systems: {
        iching: FULL_TIMESTAMP.systems["iching"],
      },
    };
    const snap = createCosmicSnapshot(partial);

    expect(snap.ts).toBeDefined();
    expect(snap.gate).toEqual({ sun: 48, line: 3, earth: 21 });
    expect(snap.card).toBeUndefined();
    expect(snap.moon).toBeUndefined();
    expect(snap.solar).toBeUndefined();
    expect(snap.hd).toBeUndefined();
  });

  it("handles empty systems", () => {
    const empty: CosmicTimestamp = { datetime: TEST_DATE, systems: {} };
    const snap = createCosmicSnapshot(empty);

    expect(snap.ts).toBeDefined();
    expect(snap.card).toBeUndefined();
    expect(snap.gate).toBeUndefined();
    expect(snap.moon).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════
// matchesCosmicFilter
// ═════════════════════════════════════════════════════════════════

describe("matchesCosmicFilter", () => {
  const snap: CosmicSnapshot = {
    ts: "2025-06-15T12:00:00.000Z",
    card: { planet: "Neptune", card: "5♠", day: 35, suit: "♦" },
    gate: { sun: 48, line: 3, earth: 21 },
    moon: { phase: "Waxing Gibbous", illum: 0.78 },
    solar: { kp: 3, storm: "quiet" },
  };

  it("matches by Magi period card", () => {
    expect(matchesCosmicFilter(snap, { magiPeriodCard: "5♠" })).toBe(true);
    expect(matchesCosmicFilter(snap, { magiPeriodCard: "K♥" })).toBe(false);
  });

  it("matches by Magi period planet", () => {
    expect(matchesCosmicFilter(snap, { magiPeriodPlanet: "Neptune" })).toBe(true);
    expect(matchesCosmicFilter(snap, { magiPeriodPlanet: "Mercury" })).toBe(false);
  });

  it("matches by I-Ching gate", () => {
    expect(matchesCosmicFilter(snap, { gate: 48 })).toBe(true);
    expect(matchesCosmicFilter(snap, { gate: 1 })).toBe(false);
  });

  it("matches by moon phase", () => {
    expect(matchesCosmicFilter(snap, { moonPhase: "Waxing Gibbous" })).toBe(true);
    expect(matchesCosmicFilter(snap, { moonPhase: "Full Moon" })).toBe(false);
  });

  it("matches by Kp threshold", () => {
    expect(matchesCosmicFilter(snap, { kpAbove: 2 })).toBe(true);
    expect(matchesCosmicFilter(snap, { kpAbove: 5 })).toBe(false);
  });

  it("matches by storm level", () => {
    expect(matchesCosmicFilter(snap, { stormLevel: "quiet" })).toBe(true);
    expect(matchesCosmicFilter(snap, { stormLevel: "storm" })).toBe(false);
  });

  it("matches multiple criteria (AND logic)", () => {
    expect(matchesCosmicFilter(snap, { gate: 48, moonPhase: "Waxing Gibbous" })).toBe(true);
    expect(matchesCosmicFilter(snap, { gate: 48, moonPhase: "Full Moon" })).toBe(false);
  });

  it("returns false for undefined snapshot", () => {
    expect(matchesCosmicFilter(undefined, { gate: 48 })).toBe(false);
  });

  it("returns true for empty filter (matches everything)", () => {
    expect(matchesCosmicFilter(snap, {})).toBe(true);
  });

  it("handles snapshot with missing sections", () => {
    const minimal: CosmicSnapshot = { ts: "2025-06-15T12:00:00Z" };
    expect(matchesCosmicFilter(minimal, { gate: 48 })).toBe(false);
    expect(matchesCosmicFilter(minimal, {})).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════
// enrichWithCosmic
// ═════════════════════════════════════════════════════════════════

describe("enrichWithCosmic", () => {
  beforeEach(() => {
    // Reset enrichment wiring
    initEnrichment(
      () => ({
        getCosmicTimestamp: async () => FULL_TIMESTAMP,
      }),
      () => ({ enabled: true }),
    );
  });

  it("adds cosmic key to empty metadata", async () => {
    const result = await enrichWithCosmic();
    expect(result.cosmic).toBeDefined();
    const snap = result.cosmic as CosmicSnapshot;
    expect(snap.ts).toBe("2025-06-15T12:00:00.000Z");
    expect(snap.card?.planet).toBe("Neptune");
    expect(snap.gate?.sun).toBe(48);
  });

  it("preserves existing metadata keys", async () => {
    const original = { session: "abc", channel: "telegram" };
    const result = await enrichWithCosmic(original);
    expect(result.session).toBe("abc");
    expect(result.channel).toBe("telegram");
    expect(result.cosmic).toBeDefined();
  });

  it("returns original metadata when Council is disabled", async () => {
    initEnrichment(
      () => ({ getCosmicTimestamp: async () => FULL_TIMESTAMP }),
      () => ({ enabled: false }),
    );
    const original = { foo: "bar" };
    const result = await enrichWithCosmic(original);
    expect(result).toEqual({ foo: "bar" });
    expect(result.cosmic).toBeUndefined();
  });

  it("returns original metadata when no config function wired", async () => {
    initEnrichment(
      () => ({ getCosmicTimestamp: async () => FULL_TIMESTAMP }),
      () => undefined,
    );
    const result = await enrichWithCosmic({ x: 1 });
    expect(result).toEqual({ x: 1 });
  });

  it("fails gracefully when council throws", async () => {
    initEnrichment(
      () => ({
        getCosmicTimestamp: async () => {
          throw new Error("Network error");
        },
      }),
      () => ({ enabled: true }),
    );
    const result = await enrichWithCosmic({ y: 2 });
    expect(result).toEqual({ y: 2 });
  });

  it("parses operator birth from config", async () => {
    let capturedBirth: BirthMoment | null = null;
    initEnrichment(
      () => ({
        getCosmicTimestamp: async (birth: BirthMoment | null) => {
          capturedBirth = birth;
          return FULL_TIMESTAMP;
        },
      }),
      () => ({
        enabled: true,
        operatorBirth: {
          datetime: "1990-06-15T06:00:00Z",
          latitude: 40.7,
          longitude: -74,
          timezone: "America/New_York",
        },
      }),
    );

    await enrichWithCosmic();
    expect(capturedBirth).not.toBeNull();
    expect(capturedBirth!.latitude).toBeCloseTo(40.7);
    expect(capturedBirth!.timezone).toBe("America/New_York");
  });
});
