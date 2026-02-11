import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/preferences/store.js", () => ({
  getPreference: vi.fn().mockResolvedValue("test-value"),
  setPreference: vi.fn().mockResolvedValue(undefined),
}));

describe("Preferences routes", () => {
  let preferencesRouter: Router;

  beforeEach(async () => {
    const mod = await import("./preferences");
    preferencesRouter = mod.preferencesRouter;
  });

  it("exports an Express router", () => {
    expect(preferencesRouter).toBeDefined();
    expect(Array.isArray((preferencesRouter as any).stack)).toBe(true);
  });

  it("has GET / route", () => {
    const routes = (preferencesRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const get = routes.find((r: any) => r.path === "/" && r.methods.includes("get"));
    expect(get).toBeDefined();
  });

  it("has PUT / route", () => {
    const routes = (preferencesRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const put = routes.find((r: any) => r.path === "/" && r.methods.includes("put"));
    expect(put).toBeDefined();
  });

  it("has GET /briefings route", () => {
    const routes = (preferencesRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const get = routes.find((r: any) => r.path === "/briefings" && r.methods.includes("get"));
    expect(get).toBeDefined();
  });

  it("has PUT /briefings route", () => {
    const routes = (preferencesRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const put = routes.find((r: any) => r.path === "/briefings" && r.methods.includes("put"));
    expect(put).toBeDefined();
  });
});
