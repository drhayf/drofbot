import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/council/index.js", () => ({
  getCouncil: vi.fn(() => ({
    registry: {
      getSystem: vi.fn().mockReturnValue(null),
      getSystems: vi.fn().mockReturnValue([]),
    },
    calculateAll: vi.fn().mockReturnValue(new Map()),
  })),
}));

vi.mock("../../brain/synthesis/master.js", () => ({
  getSynthesisEngine: vi.fn(() => ({
    getCached: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock("../../brain/intelligence/hypothesis.js", () => ({
  getHypothesisEngine: vi.fn(() => ({
    getConfirmed: vi
      .fn()
      .mockReturnValue([{ id: "h-1", title: "Confirmed insight", type: "BEHAVIORAL" }]),
  })),
}));

vi.mock("../../config/read-config.js", () => ({
  readConfigFileSnapshot: vi.fn().mockReturnValue({
    council: {
      operatorBirth: { year: 1990, month: 6, day: 15 },
    },
  }),
}));

vi.mock("../../brain/council/config.js", () => ({
  parseBirthMomentConfig: vi.fn().mockReturnValue({
    year: 1990,
    month: 6,
    day: 15,
  }),
}));

describe("Profile routes", () => {
  let profileRouter: Router;

  beforeEach(async () => {
    const mod = await import("./profile");
    profileRouter = mod.profileRouter;
  });

  it("exports an Express router", () => {
    expect(profileRouter).toBeDefined();
    expect(Array.isArray((profileRouter as any).stack)).toBe(true);
  });

  it("has GET / route", () => {
    const routes = (profileRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const get = routes.find((r: any) => r.path === "/" && r.methods.includes("get"));
    expect(get).toBeDefined();
  });

  it("has GET /synthesis route", () => {
    const routes = (profileRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const synth = routes.find((r: any) => r.path === "/synthesis" && r.methods.includes("get"));
    expect(synth).toBeDefined();
  });
});
