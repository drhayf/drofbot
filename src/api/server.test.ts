import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock brain systems before importing server
vi.mock("../brain/memory/drofbot-memory.js", () => ({
  getDrofbotMemory: vi.fn(() => ({
    episodic: {
      store: vi.fn().mockResolvedValue({ id: "ep-1" }),
      search: vi.fn().mockResolvedValue([]),
    },
    semantic: { search: vi.fn().mockResolvedValue([]) },
    procedural: { search: vi.fn().mockResolvedValue([]) },
    relational: { search: vi.fn().mockResolvedValue([]) },
  })),
}));

vi.mock("../brain/intelligence/hypothesis.js", () => ({
  getHypothesisEngine: vi.fn(() => ({
    getAll: vi.fn().mockReturnValue([]),
    getActive: vi.fn().mockReturnValue([]),
    getConfirmed: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
    userConfirm: vi.fn(),
    userReject: vi.fn(),
  })),
}));

vi.mock("../brain/progression/tools.js", () => ({
  getProgressionEngine: vi.fn(() => ({
    getStats: vi.fn().mockReturnValue({ level: 5, xp: 100, rank: "D" }),
    getAllQuests: vi.fn().mockReturnValue([]),
    completeQuest: vi.fn(),
    createQuest: vi.fn().mockReturnValue({ id: "q-1" }),
  })),
}));

vi.mock("../brain/council/index.js", () => ({
  getCouncil: vi.fn(() => ({
    registry: {
      getSystem: vi.fn().mockReturnValue(null),
      getSystems: vi.fn().mockReturnValue([]),
    },
    calculateAll: vi.fn().mockReturnValue(new Map()),
  })),
}));

vi.mock("../brain/synthesis/master.js", () => ({
  getSynthesisEngine: vi.fn(() => ({
    getCached: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock("../brain/preferences/store.js", () => ({
  getPreference: vi.fn().mockResolvedValue(null),
  setPreference: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../brain/identity/observer.js", () => ({
  getObserver: vi.fn().mockReturnValue({
    getSelfModel: vi.fn().mockReturnValue(null),
    getRelationshipModel: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("../config/read-config.js", () => ({
  readConfigFileSnapshot: vi.fn().mockReturnValue({
    council: { operatorBirth: null },
  }),
}));

vi.mock("../brain/council/config.js", () => ({
  parseBirthMomentConfig: vi.fn().mockReturnValue(null),
}));

vi.mock("../brain/enrichment.js", () => ({
  enrichWithCosmicContext: vi.fn().mockResolvedValue({}),
}));

vi.mock("../brain/synthesis/engine.js", () => ({
  calculateHarmonicSynthesis: vi.fn().mockReturnValue(null),
}));

vi.mock("../database/client.js", () => ({
  getSupabaseClient: vi.fn().mockReturnValue(null),
  isSupabaseConfigured: vi.fn().mockReturnValue(false),
}));

describe("Dashboard API server", () => {
  let createDashboardApi: typeof import("./server").createDashboardApi;
  let getDashboardToken: typeof import("./server").getDashboardToken;

  beforeEach(async () => {
    vi.unstubAllEnvs();
    const mod = await import("./server");
    createDashboardApi = mod.createDashboardApi;
    getDashboardToken = mod.getDashboardToken;
  });

  it("exports createDashboardApi function", () => {
    expect(typeof createDashboardApi).toBe("function");
  });

  it("exports getDashboardToken function", () => {
    expect(typeof getDashboardToken).toBe("function");
  });

  it("getDashboardToken reads DROFBOT_DASHBOARD_TOKEN", () => {
    vi.stubEnv("DROFBOT_DASHBOARD_TOKEN", "test-token-123");
    expect(getDashboardToken()).toBe("test-token-123");
  });

  it("getDashboardToken falls back to OPENCLAW_GATEWAY_TOKEN", () => {
    vi.stubEnv("DROFBOT_DASHBOARD_TOKEN", "");
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "gw-token");
    expect(getDashboardToken()).toBe("gw-token");
  });

  it("creates an Express app", () => {
    const app = createDashboardApi();
    expect(app).toBeDefined();
    // Express apps have .use, .get, etc.
    expect(typeof app.use).toBe("function");
    expect(typeof app.get).toBe("function");
  });
});
