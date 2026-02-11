import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ArchetypeMapping, BirthMoment, CosmicState, CosmicSystem } from "./types.js";
import {
  calculateHarmonicSynthesis,
  getElementalCompatibility,
  ELEMENTAL_MATRIX,
} from "./harmonic.js";
import { getCouncil, resetCouncil, DROFBOT_DEFAULT_BIRTH } from "./index.js";
import { CouncilRegistry } from "./registry.js";
import {
  Element,
  ResonanceType,
  FrequencyBand,
  getResonanceType,
  getFrequencyBand,
} from "./types.js";

// ─── Test Helpers ────────────────────────────────────────────────

const TEST_BIRTH: BirthMoment = {
  datetime: new Date("1990-06-15T14:30:00Z"),
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
};

function createMockState(system: string, overrides?: Partial<CosmicState>): CosmicState {
  return {
    system,
    timestamp: new Date("2026-02-09T12:00:00Z"),
    primary: { active: true },
    summary: `${system} is active`,
    metrics: { value: 0.75 },
    ...overrides,
  };
}

function createMockSystem(
  name: string,
  opts?: {
    requiresBirthData?: boolean;
    state?: CosmicState | null;
    throwError?: boolean;
    elements?: Element[];
  },
): CosmicSystem {
  const state = opts?.state !== undefined ? opts.state : createMockState(name);
  return {
    name,
    displayName: `Test ${name}`,
    requiresBirthData: opts?.requiresBirthData ?? false,
    recalcInterval: { type: "daily" },
    calculate: opts?.throwError
      ? vi.fn().mockRejectedValue(new Error("system failure"))
      : vi.fn().mockResolvedValue(state),
    synthesize: vi.fn((s: CosmicState) => s.summary),
    archetypes: vi.fn(
      (): ArchetypeMapping => ({
        system: name,
        elements: opts?.elements ?? [Element.FIRE],
        archetypes: ["warrior"],
        resonanceValues: { strength: 0.8 },
      }),
    ),
  };
}

// ─── Types Tests ─────────────────────────────────────────────────

describe("Council Types", () => {
  describe("getResonanceType", () => {
    it("returns HARMONIC for scores >= 0.8", () => {
      expect(getResonanceType(0.8)).toBe(ResonanceType.HARMONIC);
      expect(getResonanceType(0.95)).toBe(ResonanceType.HARMONIC);
      expect(getResonanceType(1.0)).toBe(ResonanceType.HARMONIC);
    });

    it("returns SUPPORTIVE for scores 0.6-0.8", () => {
      expect(getResonanceType(0.6)).toBe(ResonanceType.SUPPORTIVE);
      expect(getResonanceType(0.75)).toBe(ResonanceType.SUPPORTIVE);
    });

    it("returns NEUTRAL for scores 0.4-0.6", () => {
      expect(getResonanceType(0.4)).toBe(ResonanceType.NEUTRAL);
      expect(getResonanceType(0.5)).toBe(ResonanceType.NEUTRAL);
    });

    it("returns CHALLENGING for scores 0.2-0.4", () => {
      expect(getResonanceType(0.2)).toBe(ResonanceType.CHALLENGING);
      expect(getResonanceType(0.35)).toBe(ResonanceType.CHALLENGING);
    });

    it("returns DISSONANT for scores < 0.2", () => {
      expect(getResonanceType(0.1)).toBe(ResonanceType.DISSONANT);
      expect(getResonanceType(0.0)).toBe(ResonanceType.DISSONANT);
    });
  });

  describe("getFrequencyBand", () => {
    it("returns SHADOW for 0-33%", () => {
      expect(getFrequencyBand(0)).toBe(FrequencyBand.SHADOW);
      expect(getFrequencyBand(33)).toBe(FrequencyBand.SHADOW);
    });
    it("returns GIFT for 34-66%", () => {
      expect(getFrequencyBand(34)).toBe(FrequencyBand.GIFT);
      expect(getFrequencyBand(66)).toBe(FrequencyBand.GIFT);
    });
    it("returns SIDDHI for 67-100%", () => {
      expect(getFrequencyBand(67)).toBe(FrequencyBand.SIDDHI);
      expect(getFrequencyBand(100)).toBe(FrequencyBand.SIDDHI);
    });
  });
});

// ─── Registry Tests ──────────────────────────────────────────────

describe("CouncilRegistry", () => {
  let registry: CouncilRegistry;

  beforeEach(() => {
    registry = new CouncilRegistry();
  });

  describe("registration", () => {
    it("registers and retrieves a system", () => {
      const system = createMockSystem("cardology");
      registry.register(system);

      expect(registry.getSystem("cardology")).toBe(system);
      expect(registry.size).toBe(1);
    });

    it("lists all registered systems", () => {
      registry.register(createMockSystem("cardology"));
      registry.register(createMockSystem("iching"));
      registry.register(createMockSystem("solar"));

      const systems = registry.listSystems();
      expect(systems).toHaveLength(3);
      expect(systems.map((s) => s.name)).toEqual(["cardology", "iching", "solar"]);
    });

    it("replaces existing system on re-registration", () => {
      const sys1 = createMockSystem("cardology");
      const sys2 = createMockSystem("cardology");
      registry.register(sys1);
      registry.register(sys2);

      expect(registry.getSystem("cardology")).toBe(sys2);
      expect(registry.size).toBe(1);
    });

    it("unregisters a system", () => {
      registry.register(createMockSystem("cardology"));
      registry.unregister("cardology");

      expect(registry.getSystem("cardology")).toBeUndefined();
      expect(registry.size).toBe(0);
    });

    it("returns undefined for unknown system", () => {
      expect(registry.getSystem("nonexistent")).toBeUndefined();
    });
  });

  describe("calculateAll", () => {
    it("calculates all registered systems", async () => {
      registry.register(createMockSystem("cardology"));
      registry.register(createMockSystem("iching"));

      const results = await registry.calculateAll(TEST_BIRTH);
      expect(results.size).toBe(2);
      expect(results.has("cardology")).toBe(true);
      expect(results.has("iching")).toBe(true);
    });

    it("skips systems that return null (birth data required but missing)", async () => {
      registry.register(
        createMockSystem("cardology", {
          requiresBirthData: true,
          state: null,
        }),
      );
      registry.register(createMockSystem("solar"));

      const results = await registry.calculateAll(null);
      expect(results.size).toBe(1);
      expect(results.has("solar")).toBe(true);
      expect(results.has("cardology")).toBe(false);
    });

    it("gracefully handles system errors", async () => {
      registry.register(createMockSystem("cardology"));
      registry.register(createMockSystem("broken", { throwError: true }));
      registry.register(createMockSystem("iching"));

      const results = await registry.calculateAll(TEST_BIRTH);
      expect(results.size).toBe(2);
      expect(results.has("cardology")).toBe(true);
      expect(results.has("iching")).toBe(true);
      expect(results.has("broken")).toBe(false);
    });

    it("uses cache when fresh", async () => {
      const system = createMockSystem("cardology");
      registry.register(system);

      const now = new Date("2026-02-09T12:00:00Z");
      await registry.calculateAll(TEST_BIRTH, now);
      await registry.calculateAll(TEST_BIRTH, now);

      // calculate should be called only once (second call uses cache)
      expect(system.calculate).toHaveBeenCalledTimes(1);
    });

    it("recalculates after cache expires", async () => {
      const system = createMockSystem("cardology");
      // daily recalc interval
      registry.register(system);

      const t1 = new Date("2026-02-09T12:00:00Z");
      await registry.calculateAll(TEST_BIRTH, t1);

      // 25 hours later — cache should be expired
      const t2 = new Date("2026-02-10T13:00:00Z");
      await registry.calculateAll(TEST_BIRTH, t2);

      expect(system.calculate).toHaveBeenCalledTimes(2);
    });

    it("passes the now parameter to calculate", async () => {
      const system = createMockSystem("cardology");
      registry.register(system);

      const now = new Date("2026-02-09T15:30:00Z");
      await registry.calculateAll(TEST_BIRTH, now);

      expect(system.calculate).toHaveBeenCalledWith(TEST_BIRTH, now);
    });
  });

  describe("getCosmicTimestamp", () => {
    it("returns a complete cosmic timestamp", async () => {
      registry.register(createMockSystem("cardology"));
      registry.register(createMockSystem("iching"));

      const now = new Date("2026-02-09T12:00:00Z");
      const timestamp = await registry.getCosmicTimestamp(TEST_BIRTH, now);

      expect(timestamp.datetime).toEqual(now);
      expect(Object.keys(timestamp.systems)).toEqual(["cardology", "iching"]);
      expect(timestamp.systems.cardology.system).toBe("cardology");
      expect(timestamp.systems.iching.system).toBe("iching");
    });

    it("returns empty systems when all require birth data and none is given", async () => {
      registry.register(createMockSystem("cardology", { requiresBirthData: true, state: null }));

      const timestamp = await registry.getCosmicTimestamp(null);
      expect(Object.keys(timestamp.systems)).toEqual([]);
    });
  });

  describe("cache management", () => {
    it("invalidates cache for a specific system", async () => {
      const system = createMockSystem("cardology");
      registry.register(system);

      const now = new Date("2026-02-09T12:00:00Z");
      await registry.calculateAll(TEST_BIRTH, now);

      registry.invalidateCache("cardology");

      // Should recalculate after invalidation
      await registry.calculateAll(TEST_BIRTH, now);
      expect(system.calculate).toHaveBeenCalledTimes(2);
    });

    it("invalidates all caches", async () => {
      const sys1 = createMockSystem("cardology");
      const sys2 = createMockSystem("iching");
      registry.register(sys1);
      registry.register(sys2);

      const now = new Date("2026-02-09T12:00:00Z");
      await registry.calculateAll(TEST_BIRTH, now);

      registry.invalidateCache(); // all

      await registry.calculateAll(TEST_BIRTH, now);
      expect(sys1.calculate).toHaveBeenCalledTimes(2);
      expect(sys2.calculate).toHaveBeenCalledTimes(2);
    });

    it("invalidates cache on re-registration", async () => {
      const sys1 = createMockSystem("cardology");
      registry.register(sys1);

      const now = new Date("2026-02-09T12:00:00Z");
      await registry.calculateAll(TEST_BIRTH, now);

      const sys2 = createMockSystem("cardology");
      registry.register(sys2);

      await registry.calculateAll(TEST_BIRTH, now);
      // sys2 should be called (cache was invalidated on re-registration)
      expect(sys2.calculate).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── Harmonic Synthesis Tests ────────────────────────────────────

describe("Harmonic Synthesis", () => {
  describe("ELEMENTAL_MATRIX", () => {
    it("is symmetric", () => {
      for (const a of Object.values(Element)) {
        for (const b of Object.values(Element)) {
          expect(ELEMENTAL_MATRIX[a][b]).toBe(ELEMENTAL_MATRIX[b][a]);
        }
      }
    });

    it("has 1.0 on the diagonal (same element = perfect compatibility)", () => {
      for (const e of Object.values(Element)) {
        expect(ELEMENTAL_MATRIX[e][e]).toBe(1.0);
      }
    });

    it("matches exact GUTTERS values", () => {
      // Spot-check key values from GUTTERS
      expect(getElementalCompatibility(Element.FIRE, Element.WATER)).toBe(0.3);
      expect(getElementalCompatibility(Element.FIRE, Element.AIR)).toBe(0.8);
      expect(getElementalCompatibility(Element.AIR, Element.EARTH)).toBe(0.2);
      expect(getElementalCompatibility(Element.WATER, Element.EARTH)).toBe(0.7);
      expect(getElementalCompatibility(Element.ETHER, Element.FIRE)).toBe(0.7);
      expect(getElementalCompatibility(Element.ETHER, Element.WATER)).toBe(0.6);
      expect(getElementalCompatibility(Element.ETHER, Element.AIR)).toBe(0.7);
      expect(getElementalCompatibility(Element.ETHER, Element.EARTH)).toBe(0.5);
    });

    it("all values are in [0, 1]", () => {
      for (const a of Object.values(Element)) {
        for (const b of Object.values(Element)) {
          expect(ELEMENTAL_MATRIX[a][b]).toBeGreaterThanOrEqual(0);
          expect(ELEMENTAL_MATRIX[a][b]).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe("calculateHarmonicSynthesis", () => {
    it("returns empty synthesis when no systems active", () => {
      const result = calculateHarmonicSynthesis(new Map(), []);
      expect(result.overallResonance).toBe(0.5);
      expect(result.pairwise).toHaveLength(0);
      expect(result.guidance).toContain("awaiting registration");
    });

    it("returns single-system synthesis when one system active", () => {
      const states = new Map([["cardology", createMockState("cardology")]]);
      const mappings: ArchetypeMapping[] = [
        {
          system: "cardology",
          elements: [Element.FIRE],
          archetypes: ["warrior"],
          resonanceValues: { strength: 0.8 },
        },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      expect(result.overallResonance).toBe(0.5);
      expect(result.pairwise).toHaveLength(0);
      expect(result.guidance).toContain("Single system");
    });

    it("calculates pairwise resonance between two same-element systems", () => {
      const states = new Map([
        ["a", createMockState("a")],
        ["b", createMockState("b")],
      ]);
      const mappings: ArchetypeMapping[] = [
        {
          system: "a",
          elements: [Element.FIRE],
          archetypes: ["warrior"],
          resonanceValues: {},
        },
        {
          system: "b",
          elements: [Element.FIRE],
          archetypes: ["leader"],
          resonanceValues: {},
        },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      expect(result.overallResonance).toBe(1.0); // FIRE-FIRE = 1.0
      expect(result.resonanceType).toBe(ResonanceType.HARMONIC);
      expect(result.pairwise).toHaveLength(1);
      expect(result.pairwise[0].score).toBe(1.0);
      expect(result.pairwise[0].sharedElements).toEqual([Element.FIRE]);
    });

    it("calculates pairwise resonance between opposing elements", () => {
      const states = new Map([
        ["a", createMockState("a")],
        ["b", createMockState("b")],
      ]);
      const mappings: ArchetypeMapping[] = [
        {
          system: "a",
          elements: [Element.AIR],
          archetypes: ["thinker"],
          resonanceValues: {},
        },
        {
          system: "b",
          elements: [Element.EARTH],
          archetypes: ["builder"],
          resonanceValues: {},
        },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      expect(result.overallResonance).toBe(0.2); // AIR-EARTH = 0.2
      expect(result.resonanceType).toBe(ResonanceType.CHALLENGING);
    });

    it("calculates correct resonance with 3+ systems", () => {
      const states = new Map([
        ["a", createMockState("a")],
        ["b", createMockState("b")],
        ["c", createMockState("c")],
      ]);
      const mappings: ArchetypeMapping[] = [
        { system: "a", elements: [Element.FIRE], archetypes: [], resonanceValues: {} },
        { system: "b", elements: [Element.AIR], archetypes: [], resonanceValues: {} },
        { system: "c", elements: [Element.WATER], archetypes: [], resonanceValues: {} },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      // Pairwise: FIRE-AIR=0.8, FIRE-WATER=0.3, AIR-WATER=0.4
      // Average = (0.8 + 0.3 + 0.4) / 3 = 0.5
      expect(result.overallResonance).toBe(0.5);
      expect(result.resonanceType).toBe(ResonanceType.NEUTRAL);
      expect(result.pairwise).toHaveLength(3);
    });

    it("handles multi-element systems correctly", () => {
      const states = new Map([
        ["a", createMockState("a")],
        ["b", createMockState("b")],
      ]);
      const mappings: ArchetypeMapping[] = [
        {
          system: "a",
          elements: [Element.FIRE, Element.AIR],
          archetypes: [],
          resonanceValues: {},
        },
        {
          system: "b",
          elements: [Element.WATER, Element.EARTH],
          archetypes: [],
          resonanceValues: {},
        },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      // Pairs: FIRE-WATER=0.3, FIRE-EARTH=0.5, AIR-WATER=0.4, AIR-EARTH=0.2
      // Average = (0.3 + 0.5 + 0.4 + 0.2) / 4 = 0.35
      expect(result.overallResonance).toBeCloseTo(0.35);
      expect(result.resonanceType).toBe(ResonanceType.CHALLENGING);
    });

    it("calculates elemental balance", () => {
      const states = new Map([
        ["a", createMockState("a")],
        ["b", createMockState("b")],
      ]);
      const mappings: ArchetypeMapping[] = [
        {
          system: "a",
          elements: [Element.FIRE, Element.FIRE],
          archetypes: [],
          resonanceValues: {},
        },
        { system: "b", elements: [Element.WATER], archetypes: [], resonanceValues: {} },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      // 2 FIRE + 1 WATER = 3 total; FIRE = 2/3, WATER = 1/3
      expect(result.elementalBalance[Element.FIRE]).toBeCloseTo(2 / 3);
      expect(result.elementalBalance[Element.WATER]).toBeCloseTo(1 / 3);
      expect(result.elementalBalance[Element.AIR]).toBe(0);
    });

    it("identifies dominant elements", () => {
      const states = new Map([
        ["a", createMockState("a")],
        ["b", createMockState("b")],
        ["c", createMockState("c")],
      ]);
      const mappings: ArchetypeMapping[] = [
        { system: "a", elements: [Element.FIRE], archetypes: [], resonanceValues: {} },
        { system: "b", elements: [Element.FIRE], archetypes: [], resonanceValues: {} },
        { system: "c", elements: [Element.WATER], archetypes: [], resonanceValues: {} },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      expect(result.dominantElements).toContain(Element.FIRE);
    });

    it("generates guidance text", () => {
      const states = new Map([
        ["a", createMockState("a")],
        ["b", createMockState("b")],
      ]);
      const mappings: ArchetypeMapping[] = [
        { system: "a", elements: [Element.FIRE], archetypes: ["warrior"], resonanceValues: {} },
        { system: "b", elements: [Element.FIRE], archetypes: ["leader"], resonanceValues: {} },
      ];

      const result = calculateHarmonicSynthesis(states, mappings);
      expect(result.guidance).toBeTruthy();
      expect(result.guidance.length).toBeGreaterThan(10);
      expect(result.guidance).toContain("HARMONIC");
    });
  });
});

// ─── Singleton Tests ─────────────────────────────────────────────

describe("Council Singleton", () => {
  beforeEach(() => {
    resetCouncil();
  });

  it("returns a singleton registry", () => {
    const c1 = getCouncil();
    const c2 = getCouncil();
    expect(c1).toBe(c2);
  });

  it("resets the singleton", () => {
    const c1 = getCouncil();
    resetCouncil();
    const c2 = getCouncil();
    expect(c1).not.toBe(c2);
  });

  it("starts with all 6 cosmic systems registered", () => {
    const council = getCouncil();
    expect(council.size).toBe(6);
    expect(council.listSystems().length).toBe(6);
  });

  it("has a valid default birth moment", () => {
    expect(DROFBOT_DEFAULT_BIRTH.datetime).toBeInstanceOf(Date);
    expect(DROFBOT_DEFAULT_BIRTH.latitude).toBe(0);
    expect(DROFBOT_DEFAULT_BIRTH.longitude).toBe(0);
    expect(DROFBOT_DEFAULT_BIRTH.timezone).toBe("UTC");
  });
});
