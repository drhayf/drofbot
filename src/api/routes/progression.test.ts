import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/progression/tools.js", () => ({
  getProgressionEngine: vi.fn(() => ({
    getStats: vi.fn().mockReturnValue({
      level: 5,
      xp: 230,
      rank: "D",
      xpToNextLevel: 400,
      totalQuests: 10,
      completedQuests: 3,
    }),
    getAllQuests: vi.fn().mockReturnValue([
      { id: "q-1", title: "Quest 1", status: "ACTIVE", xpReward: 50 },
      { id: "q-2", title: "Quest 2", status: "COMPLETED", xpReward: 30 },
    ]),
    completeQuest: vi.fn().mockReturnValue({ id: "q-1", status: "COMPLETED" }),
    createQuest: vi.fn().mockReturnValue({ id: "q-3", title: "New Quest" }),
  })),
}));

describe("Progression routes", () => {
  let progressionRouter: Router;

  beforeEach(async () => {
    const mod = await import("./progression");
    progressionRouter = mod.progressionRouter;
  });

  it("exports an Express router", () => {
    expect(progressionRouter).toBeDefined();
    expect(Array.isArray((progressionRouter as any).stack)).toBe(true);
  });

  it("has GET / route (stats)", () => {
    const routes = (progressionRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const getStats = routes.find((r: any) => r.path === "/" && r.methods.includes("get"));
    expect(getStats).toBeDefined();
  });

  it("has GET /quests route", () => {
    const routes = (progressionRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const getQuests = routes.find((r: any) => r.path === "/quests" && r.methods.includes("get"));
    expect(getQuests).toBeDefined();
  });

  it("has POST /quests/:id/complete route", () => {
    const routes = (progressionRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const complete = routes.find(
      (r: any) => r.path === "/quests/:id/complete" && r.methods.includes("post"),
    );
    expect(complete).toBeDefined();
  });

  it("has POST /quests route (create)", () => {
    const routes = (progressionRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const create = routes.find((r: any) => r.path === "/quests" && r.methods.includes("post"));
    expect(create).toBeDefined();
  });
});
