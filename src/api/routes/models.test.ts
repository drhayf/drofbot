import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/model-routing/registry.js", () => ({
  fetchModels: vi.fn().mockResolvedValue([]),
  findModel: vi.fn().mockResolvedValue(undefined),
  searchModels: vi.fn().mockResolvedValue([]),
  refreshModels: vi.fn().mockResolvedValue([]),
  formatPricing: vi.fn().mockReturnValue("$0 / $0"),
}));

vi.mock("../../brain/model-routing/active-model.js", () => ({
  getActiveModel: vi.fn().mockResolvedValue({ model: "test/model", source: "fallback" }),
  setModelPreference: vi.fn().mockResolvedValue(true),
  clearModelPreference: vi.fn().mockResolvedValue(true),
  getEnvDefaultModel: vi.fn().mockReturnValue("test/model"),
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("Models routes", () => {
  let modelsRouter: Router;

  beforeEach(async () => {
    const mod = await import("./models");
    modelsRouter = mod.modelsRouter;
  });

  it("exports an Express router", () => {
    expect(modelsRouter).toBeDefined();
    expect(Array.isArray((modelsRouter as any).stack)).toBe(true);
  });

  it("has GET / route (list models)", () => {
    const routes = (modelsRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const get = routes.find((r: any) => r.path === "/" && r.methods.includes("get"));
    expect(get).toBeDefined();
  });

  it("has GET /current route", () => {
    const routes = (modelsRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const get = routes.find((r: any) => r.path === "/current" && r.methods.includes("get"));
    expect(get).toBeDefined();
  });

  it("has PUT /current route", () => {
    const routes = (modelsRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const put = routes.find((r: any) => r.path === "/current" && r.methods.includes("put"));
    expect(put).toBeDefined();
  });

  it("has DELETE /current route", () => {
    const routes = (modelsRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const del = routes.find((r: any) => r.path === "/current" && r.methods.includes("delete"));
    expect(del).toBeDefined();
  });

  it("has GET /refresh route", () => {
    const routes = (modelsRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const get = routes.find((r: any) => r.path === "/refresh" && r.methods.includes("get"));
    expect(get).toBeDefined();
  });
});
