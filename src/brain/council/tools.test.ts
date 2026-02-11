/**
 * Tests for standalone cosmic calculation tools.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  createCardologyCalculateTool,
  createIChingCalculateTool,
  createHumanDesignCalculateTool,
  createLunarCalculateTool,
  createTransitCalculateTool,
  createCosmicTools,
} from "./tools.js";

// ─── Helpers ───────────────────────────────────────────────────

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ─── Cardology Calculator ──────────────────────────────────────

describe("cardology_calculate", () => {
  it("returns birth card for a given date", async () => {
    const tool = createCardologyCalculateTool();
    const result = await tool.execute("tc-1", {
      birthMonth: 7,
      birthDay: 4,
    });
    const data = parseResult(result);

    expect(data.birthCard).toBeDefined();
    expect(data.birthCard.rank).toBeGreaterThanOrEqual(1);
    expect(data.birthCard.rank).toBeLessThanOrEqual(13);
    expect(data.birthCard.name).toBeTruthy();
    expect(data.zodiacSign).toBe("Cancer");
  });

  it("includes karma cards by default", async () => {
    const tool = createCardologyCalculateTool();
    const result = await tool.execute("tc-2", {
      birthMonth: 3,
      birthDay: 22,
    });
    const data = parseResult(result);

    expect(data.karmaCards).toBeDefined();
    // Most cards have karma cards
    expect(data.karmaCards.first !== null || data.karmaCards.second !== null).toBe(true);
  });

  it("calculates periods for a target date", async () => {
    const tool = createCardologyCalculateTool();
    const result = await tool.execute("tc-3", {
      birthMonth: 1,
      birthDay: 15,
      targetDate: "2024-06-15",
    });
    const data = parseResult(result);

    expect(data.currentPeriod).toBeDefined();
    if (data.currentPeriod) {
      expect(data.currentPeriod.planet).toBeTruthy();
      expect(data.currentPeriod.card).toBeDefined();
    }
    expect(data.allPeriods).toHaveLength(7);
  });

  it("calculates with historical date", async () => {
    const tool = createCardologyCalculateTool();
    const result = await tool.execute("tc-4", {
      birthMonth: 12,
      birthDay: 25,
      targetDate: "2020-03-15",
    });
    const data = parseResult(result);
    expect(data.birthCard).toBeDefined();
    expect(data.allPeriods.length).toBe(7);
  });

  it("includes relationship comparison", async () => {
    const tool = createCardologyCalculateTool();
    const result = await tool.execute("tc-5", {
      birthMonth: 5,
      birthDay: 10,
      includeRelationship: {
        otherBirthMonth: 11,
        otherBirthDay: 22,
      },
    });
    const data = parseResult(result);

    expect(data.relationship).toBeDefined();
    expect(data.relationship.otherBirthCard).toBeDefined();
    expect(data.relationship.otherZodiacSign).toBeTruthy();
    expect(Array.isArray(data.relationship.connections)).toBe(true);
  });
});

// ─── I-Ching Calculator ────────────────────────────────────────

describe("iching_calculate", () => {
  it("returns gate for today", async () => {
    const tool = createIChingCalculateTool();
    const result = await tool.execute("tc-6", {});
    const data = parseResult(result);

    expect(data.sunGate).toBeGreaterThanOrEqual(1);
    expect(data.sunGate).toBeLessThanOrEqual(64);
    expect(data.sunLine).toBeGreaterThanOrEqual(1);
    expect(data.sunLine).toBeLessThanOrEqual(6);
  });

  it("calculates for a specific date", async () => {
    const tool = createIChingCalculateTool();
    // Jan 1, 2000 — Sun ≈ 280.46° → known gate
    const result = await tool.execute("tc-7", { date: "2000-01-01T12:00:00Z" });
    const data = parseResult(result);

    expect(data.sunGate).toBe(38); // verified in I-Ching tests
    expect(data.sunLongitude).toBeCloseTo(280.46, 0);
  });

  it("includes earth gate by default", async () => {
    const tool = createIChingCalculateTool();
    const result = await tool.execute("tc-8", { date: "2024-03-20" });
    const data = parseResult(result);

    expect(data.earthGate).toBeDefined();
    expect(data.earthGate).toBeGreaterThanOrEqual(1);
    expect(data.earthGate).toBeLessThanOrEqual(64);
  });

  it("includes Gene Keys when requested", async () => {
    const tool = createIChingCalculateTool();
    const result = await tool.execute("tc-9", {
      date: "2024-06-15",
      includeGeneKeys: true,
    });
    const data = parseResult(result);

    expect(data.geneKey).toBeDefined();
    expect(data.geneKey.shadow).toBeTruthy();
    expect(data.geneKey.gift).toBeTruthy();
    expect(data.geneKey.siddhi).toBeTruthy();
  });

  it("calculates design date when requested", async () => {
    const tool = createIChingCalculateTool();
    const result = await tool.execute("tc-10", {
      includeDesignDate: true,
      birthDate: "1990-06-15",
    });
    const data = parseResult(result);

    expect(data.designDate).toBeDefined();
    expect(data.designDate.date).toBeTruthy();
    expect(data.designDate.sunGate).toBeGreaterThanOrEqual(1);
    expect(data.designDate.sunGate).toBeLessThanOrEqual(64);
  });
});

// ─── Human Design Calculator ───────────────────────────────────

describe("human_design_calculate", () => {
  it("returns a full chart", async () => {
    const tool = createHumanDesignCalculateTool();
    const result = await tool.execute("tc-11", {
      birthDate: "1990-06-15",
      birthTime: "14:30",
    });
    const data = parseResult(result);

    expect(data.type).toBeTruthy();
    expect(data.authority).toBeTruthy();
    expect(data.profile).toMatch(/^\d\/\d$/);
    expect(Array.isArray(data.definedCenters)).toBe(true);
    expect(Array.isArray(data.undefinedCenters)).toBe(true);
    // Total defined + undefined should be 9 centers
    expect(data.definedCenters.length + data.undefinedCenters.length).toBe(9);
    expect(data.activeGates.length).toBeGreaterThan(0);
  });

  it("marks birth time as uncertain when not provided", async () => {
    const tool = createHumanDesignCalculateTool();
    const result = await tool.execute("tc-12", {
      birthDate: "1985-01-01",
    });
    const data = parseResult(result);

    expect(data.uncertainBirthTime).toBe(true);
    expect(data.type).toBeTruthy();
  });

  it("includes personality and design gates", async () => {
    const tool = createHumanDesignCalculateTool();
    const result = await tool.execute("tc-13", {
      birthDate: "2000-07-04",
      birthTime: "08:00",
    });
    const data = parseResult(result);

    expect(data.personalitySun.gate).toBeGreaterThanOrEqual(1);
    expect(data.personalitySun.gate).toBeLessThanOrEqual(64);
    expect(data.designSun.gate).toBeGreaterThanOrEqual(1);
    expect(data.designSun.gate).toBeLessThanOrEqual(64);
  });
});

// ─── Lunar Calculator ──────────────────────────────────────────

describe("lunar_calculate", () => {
  it("returns lunar phase for today", async () => {
    const tool = createLunarCalculateTool();
    const result = await tool.execute("tc-14", {});
    const data = parseResult(result);

    expect(data.phaseName).toBeTruthy();
    expect(data.illumination).toBeGreaterThanOrEqual(0);
    expect(data.illumination).toBeLessThanOrEqual(1);
    expect(data.zodiacSign).toBeTruthy();
    expect(data.phaseAngle).toBeGreaterThanOrEqual(0);
    expect(data.phaseAngle).toBeLessThanOrEqual(360);
    expect(data.distance).toBeGreaterThan(300000);
  });

  it("calculates for a historical date", async () => {
    const tool = createLunarCalculateTool();
    const result = await tool.execute("tc-15", { date: "2024-01-11" });
    const data = parseResult(result);

    // Jan 11 2024 was a new moon
    expect(data.phaseName).toBeTruthy();
    expect(data.illumination).toBeGreaterThanOrEqual(0);
  });
});

// ─── Transit Calculator ────────────────────────────────────────

describe("transit_calculate", () => {
  it("returns planet positions for a date", async () => {
    const tool = createTransitCalculateTool();
    const result = await tool.execute("tc-16", { date: "2024-06-15" });
    const data = parseResult(result);

    expect(data.planetPositions).toBeDefined();
    expect(data.planetPositions.length).toBeGreaterThan(0);

    // Check that each planet has longitude
    for (const pos of data.planetPositions) {
      expect(pos.planet).toBeTruthy();
      expect(pos.longitude).toBeGreaterThanOrEqual(0);
      expect(pos.longitude).toBeLessThan(360);
    }
  });

  it("finds sky aspects between planets", async () => {
    const tool = createTransitCalculateTool();
    const result = await tool.execute("tc-17", { date: "2024-06-15" });
    const data = parseResult(result);

    expect(Array.isArray(data.skyAspects)).toBe(true);
    // There should be at least some aspects in any sky
    if (data.skyAspects.length > 0) {
      expect(data.skyAspects[0].planet1).toBeTruthy();
      expect(data.skyAspects[0].planet2).toBeTruthy();
      expect(data.skyAspects[0].aspect).toBeTruthy();
    }
  });

  it("compares to natal chart when birth date provided", async () => {
    const tool = createTransitCalculateTool();
    const result = await tool.execute("tc-18", {
      date: "2024-06-15",
      natalBirthDate: "1990-06-15",
      natalBirthTime: "14:30",
    });
    const data = parseResult(result);

    expect(data.natalAspects).toBeDefined();
    expect(Array.isArray(data.natalAspects)).toBe(true);
  });
});

// ─── Factory convenience ───────────────────────────────────────

describe("createCosmicTools", () => {
  it("returns 7 tools", () => {
    const tools = createCosmicTools();
    expect(tools).toHaveLength(7);
    const names = tools.map((t) => t.name);
    expect(names).toContain("cardology_calculate");
    expect(names).toContain("iching_calculate");
    expect(names).toContain("human_design_calculate");
    expect(names).toContain("solar_weather");
    expect(names).toContain("lunar_calculate");
    expect(names).toContain("transit_calculate");
    expect(names).toContain("cosmic_synthesis");
  });
});
