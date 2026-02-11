import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/council/index.js", () => ({
  getCouncil: vi.fn(() => ({
    registry: {
      getSystem: vi.fn().mockReturnValue({
        getCurrentState: vi.fn().mockReturnValue({ card: "Ace of Hearts" }),
      }),
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

vi.mock("../../brain/synthesis/engine.js", () => ({
  calculateHarmonicSynthesis: vi.fn().mockReturnValue({
    summary: "Test synthesis",
  }),
}));

vi.mock("../../config/read-config.js", () => ({
  readConfigFileSnapshot: vi.fn().mockReturnValue({
    council: { operatorBirth: null },
  }),
}));

vi.mock("../../brain/council/config.js", () => ({
  parseBirthMomentConfig: vi.fn().mockReturnValue(null),
}));

describe("Cosmic routes", () => {
  let cosmicRouter: Router;

  beforeEach(async () => {
    const mod = await import("./cosmic");
    cosmicRouter = mod.cosmicRouter;
  });

  it("exports an Express router", () => {
    expect(cosmicRouter).toBeDefined();
    expect(Array.isArray((cosmicRouter as any).stack)).toBe(true);
  });

  const expectedRoutes = [
    { path: "/current", method: "get" },
    { path: "/synthesis", method: "get" },
    { path: "/card", method: "get" },
    { path: "/gate", method: "get" },
    { path: "/solar", method: "get" },
    { path: "/lunar", method: "get" },
    { path: "/transits", method: "get" },
    { path: "/calculate", method: "post" },
  ];

  for (const { path, method } of expectedRoutes) {
    it(`has ${method.toUpperCase()} ${path} route`, () => {
      const routes = (cosmicRouter as any).stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));
      const found = routes.find((r: any) => r.path === path && r.methods.includes(method));
      expect(found).toBeDefined();
    });
  }
});
