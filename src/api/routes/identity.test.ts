import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/identity/observer.js", () => ({
  getObserver: vi.fn(() => ({
    getSelfModel: vi.fn().mockReturnValue({
      name: "Drofbot",
      personality: "curious",
    }),
    getRelationshipModel: vi.fn().mockReturnValue({
      trust: 0.8,
      rapport: 0.9,
    }),
  })),
}));

vi.mock("../../brain/council/index.js", () => ({
  getCouncil: vi.fn(() => ({
    calculateAll: vi.fn().mockReturnValue(new Map()),
  })),
}));

vi.mock("../../config/read-config.js", () => ({
  readConfigFileSnapshot: vi.fn().mockReturnValue({
    council: { agentBirth: null },
  }),
}));

vi.mock("../../brain/council/config.js", () => ({
  parseBirthMomentConfig: vi.fn().mockReturnValue(null),
}));

describe("Identity routes", () => {
  let identityRouter: Router;

  beforeEach(async () => {
    const mod = await import("./identity");
    identityRouter = mod.identityRouter;
  });

  it("exports an Express router", () => {
    expect(identityRouter).toBeDefined();
    expect(Array.isArray((identityRouter as any).stack)).toBe(true);
  });

  it("has GET /self route", () => {
    const routes = (identityRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const self = routes.find((r: any) => r.path === "/self" && r.methods.includes("get"));
    expect(self).toBeDefined();
  });

  it("has GET /relationship route", () => {
    const routes = (identityRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const rel = routes.find((r: any) => r.path === "/relationship" && r.methods.includes("get"));
    expect(rel).toBeDefined();
  });
});
