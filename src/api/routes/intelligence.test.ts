import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../brain/intelligence/hypothesis.js", () => ({
  getHypothesisEngine: vi.fn(() => ({
    getAll: vi.fn().mockReturnValue([
      { id: "h-1", type: "BEHAVIORAL", status: "TESTING", title: "Test", confidence: 0.8 },
      { id: "h-2", type: "ENERGETIC", status: "CONFIRMED", title: "Test2", confidence: 0.9 },
    ]),
    getActive: vi
      .fn()
      .mockReturnValue([
        { id: "h-1", type: "BEHAVIORAL", status: "TESTING", title: "Test", confidence: 0.8 },
      ]),
    getConfirmed: vi
      .fn()
      .mockReturnValue([
        { id: "h-2", type: "ENERGETIC", status: "CONFIRMED", title: "Test2", confidence: 0.9 },
      ]),
    get: vi.fn().mockReturnValue({
      id: "h-1",
      type: "BEHAVIORAL",
      status: "TESTING",
      title: "Test",
      confidence: 0.8,
      evidence: [],
    }),
    userConfirm: vi.fn().mockReturnValue({ id: "h-1", status: "CONFIRMED" }),
    userReject: vi.fn().mockReturnValue({ id: "h-1", status: "REJECTED" }),
  })),
}));

describe("Intelligence routes", () => {
  let intelligenceRouter: Router;

  beforeEach(async () => {
    const mod = await import("./intelligence");
    intelligenceRouter = mod.intelligenceRouter;
  });

  it("exports an Express router", () => {
    expect(intelligenceRouter).toBeDefined();
    expect(Array.isArray((intelligenceRouter as any).stack)).toBe(true);
  });

  it("has GET / route (list hypotheses)", () => {
    const routes = (intelligenceRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const getAll = routes.find((r: any) => r.path === "/" && r.methods.includes("get"));
    expect(getAll).toBeDefined();
  });

  it("has GET /:id route", () => {
    const routes = (intelligenceRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const getById = routes.find((r: any) => r.path === "/:id" && r.methods.includes("get"));
    expect(getById).toBeDefined();
  });

  it("has POST /:id/confirm route", () => {
    const routes = (intelligenceRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const confirm = routes.find(
      (r: any) => r.path === "/:id/confirm" && r.methods.includes("post"),
    );
    expect(confirm).toBeDefined();
  });

  it("has POST /:id/reject route", () => {
    const routes = (intelligenceRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const reject = routes.find((r: any) => r.path === "/:id/reject" && r.methods.includes("post"));
    expect(reject).toBeDefined();
  });
});
