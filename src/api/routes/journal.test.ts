import { Router } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock brain systems
vi.mock("../../brain/memory/drofbot-memory.js", () => {
  const store = vi.fn().mockResolvedValue({ id: "ep-1", content: "test entry" });
  const search = vi
    .fn()
    .mockResolvedValue([
      { id: "ep-1", content: "test entry", timestamp: new Date().toISOString() },
    ]);
  return {
    getDrofbotMemory: vi.fn(() => ({
      episodic: { store, search },
    })),
  };
});

vi.mock("../../brain/intelligence/hypothesis.js", () => ({
  getHypothesisEngine: vi.fn(() => ({
    getActive: vi
      .fn()
      .mockReturnValue([
        { id: "h-1", type: "BEHAVIORAL", title: "Test hypothesis", confidence: 0.7 },
      ]),
  })),
}));

vi.mock("../../brain/enrichment.js", () => ({
  enrichWithCosmicContext: vi.fn().mockResolvedValue({
    card: "King of Spades",
    gate: 42,
  }),
}));

vi.mock("../../database/client.js", () => ({
  getSupabaseClient: vi.fn().mockReturnValue(null),
  isSupabaseConfigured: vi.fn().mockReturnValue(false),
}));

describe("Journal routes", () => {
  let journalRouter: Router;

  beforeEach(async () => {
    const mod = await import("./journal");
    journalRouter = mod.journalRouter;
  });

  it("exports an Express router", () => {
    expect(journalRouter).toBeDefined();
    // Express routers have the stack property
    expect(Array.isArray((journalRouter as any).stack)).toBe(true);
  });

  it("has POST /entry route", () => {
    const routes = (journalRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const postEntry = routes.find((r: any) => r.path === "/entry" && r.methods.includes("post"));
    expect(postEntry).toBeDefined();
  });

  it("has GET /entries route", () => {
    const routes = (journalRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const getEntries = routes.find((r: any) => r.path === "/entries" && r.methods.includes("get"));
    expect(getEntries).toBeDefined();
  });

  it("has GET /:id route", () => {
    const routes = (journalRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
    const getById = routes.find((r: any) => r.path === "/:id" && r.methods.includes("get"));
    expect(getById).toBeDefined();
  });
});
