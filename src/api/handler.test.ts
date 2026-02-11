import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Dashboard API handler (gateway adapter)", () => {
  let createDashboardApiHandler: typeof import("./handler").createDashboardApiHandler;

  beforeEach(async () => {
    vi.unstubAllEnvs();
    // Mock all brain systems
    vi.mock("../brain/memory/drofbot-memory.js", () => ({
      getDrofbotMemory: vi.fn(() => ({
        episodic: { store: vi.fn(), search: vi.fn().mockResolvedValue([]) },
        semantic: { search: vi.fn().mockResolvedValue([]) },
        procedural: { search: vi.fn().mockResolvedValue([]) },
        relational: { search: vi.fn().mockResolvedValue([]) },
      })),
    }));
    vi.mock("../brain/intelligence/hypothesis.js", () => ({
      getHypothesisEngine: vi.fn(() => ({
        getAll: vi.fn().mockReturnValue([]),
        getActive: vi.fn().mockReturnValue([]),
        get: vi.fn(),
        userConfirm: vi.fn(),
        userReject: vi.fn(),
      })),
    }));
    vi.mock("../brain/progression/tools.js", () => ({
      getProgressionEngine: vi.fn(() => ({
        getStats: vi.fn().mockReturnValue({}),
        getAllQuests: vi.fn().mockReturnValue([]),
      })),
    }));
    vi.mock("../brain/council/index.js", () => ({
      getCouncil: vi.fn(() => ({
        registry: { getSystem: vi.fn(), getSystems: vi.fn().mockReturnValue([]) },
        calculateAll: vi.fn().mockReturnValue(new Map()),
      })),
    }));
    vi.mock("../brain/synthesis/master.js", () => ({
      getSynthesisEngine: vi.fn(() => ({ getCached: vi.fn() })),
    }));
    vi.mock("../brain/preferences/store.js", () => ({
      getPreference: vi.fn(),
      setPreference: vi.fn(),
    }));
    vi.mock("../brain/identity/observer.js", () => ({
      getObserver: vi.fn(() => ({
        getSelfModel: vi.fn(),
        getRelationshipModel: vi.fn(),
      })),
    }));
    vi.mock("../config/read-config.js", () => ({
      readConfigFileSnapshot: vi.fn().mockReturnValue({ council: {} }),
    }));
    vi.mock("../brain/council/config.js", () => ({
      parseBirthMomentConfig: vi.fn(),
    }));
    vi.mock("../brain/enrichment.js", () => ({
      enrichWithCosmicContext: vi.fn().mockResolvedValue({}),
    }));
    vi.mock("../brain/synthesis/engine.js", () => ({
      calculateHarmonicSynthesis: vi.fn(),
    }));
    vi.mock("../database/client.js", () => ({
      getSupabaseClient: vi.fn(),
      isSupabaseConfigured: vi.fn().mockReturnValue(false),
    }));

    const mod = await import("./handler");
    createDashboardApiHandler = mod.createDashboardApiHandler;
  });

  it("exports createDashboardApiHandler function", () => {
    expect(typeof createDashboardApiHandler).toBe("function");
  });

  it("returns a handler function", () => {
    const handler = createDashboardApiHandler();
    expect(typeof handler).toBe("function");
  });

  it("handler returns false for non-API URLs", async () => {
    const handler = createDashboardApiHandler();
    const req = { url: "/some/other/path", method: "GET", headers: {} } as any;
    const res = { writeHead: vi.fn(), end: vi.fn() } as any;
    const result = await handler(req, res);
    expect(result).toBe(false);
  });

  it("handler returns true for /api/ URLs", async () => {
    const handler = createDashboardApiHandler();
    const req = {
      url: "/api/health",
      method: "GET",
      headers: {},
      on: vi.fn(),
    } as any;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      statusCode: 200,
    } as any;
    const result = await handler(req, res);
    expect(result).toBe(true);
  });
});
