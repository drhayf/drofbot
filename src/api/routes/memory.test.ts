import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/memory/drofbot-memory.js", () => ({
  getDrofbotMemory: vi.fn(() => ({
    episodic: { search: vi.fn().mockResolvedValue([]) },
    semantic: { search: vi.fn().mockResolvedValue([]) },
    procedural: { search: vi.fn().mockResolvedValue([]) },
    relational: { search: vi.fn().mockResolvedValue([]) },
  })),
}));

vi.mock("../../database/client.js", () => ({
  getSupabaseClient: vi.fn().mockReturnValue(null),
  isSupabaseConfigured: vi.fn().mockReturnValue(false),
}));

describe("Memory routes", () => {
  let memoryRouter: Router;

  beforeEach(async () => {
    const mod = await import("./memory");
    memoryRouter = mod.memoryRouter;
  });

  it("exports an Express router", () => {
    expect(memoryRouter).toBeDefined();
    expect(Array.isArray((memoryRouter as any).stack)).toBe(true);
  });

  it("has GET /recent route", () => {
    const routes = (memoryRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const recent = routes.find((r: any) => r.path === "/recent" && r.methods.includes("get"));
    expect(recent).toBeDefined();
  });

  it("has GET /search route", () => {
    const routes = (memoryRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const search = routes.find((r: any) => r.path === "/search" && r.methods.includes("get"));
    expect(search).toBeDefined();
  });

  it("has GET /stats route", () => {
    const routes = (memoryRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const stats = routes.find((r: any) => r.path === "/stats" && r.methods.includes("get"));
    expect(stats).toBeDefined();
  });
});
