import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Auth middleware imports getDashboardToken from server.ts, which imports
// route files that import brain systems. Mock them all to isolate the test.
vi.mock("../../brain/memory/drofbot-memory.js", () => ({
  getDrofbotMemory: vi.fn(() => ({
    episodic: { store: vi.fn(), search: vi.fn().mockResolvedValue([]) },
    semantic: { search: vi.fn().mockResolvedValue([]) },
    procedural: { search: vi.fn().mockResolvedValue([]) },
    relational: { search: vi.fn().mockResolvedValue([]) },
  })),
}));
vi.mock("../../brain/intelligence/hypothesis.js", () => ({
  getHypothesisEngine: vi.fn(() => ({
    getAll: vi.fn().mockReturnValue([]),
    getActive: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    userConfirm: vi.fn(),
    userReject: vi.fn(),
  })),
}));
vi.mock("../../brain/progression/tools.js", () => ({
  getProgressionEngine: vi.fn(() => ({
    getStats: vi.fn().mockReturnValue({}),
    getAllQuests: vi.fn().mockReturnValue([]),
  })),
}));
vi.mock("../../brain/council/index.js", () => ({
  getCouncil: vi.fn(() => ({
    registry: { getSystem: vi.fn(), getSystems: vi.fn().mockReturnValue([]) },
    calculateAll: vi.fn().mockReturnValue(new Map()),
  })),
}));
vi.mock("../../brain/synthesis/master.js", () => ({
  getSynthesisEngine: vi.fn(() => ({ getCached: vi.fn() })),
}));
vi.mock("../../brain/preferences/store.js", () => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));
vi.mock("../../brain/identity/observer.js", () => ({
  getObserver: vi.fn(() => ({
    getSelfModel: vi.fn(),
    getRelationshipModel: vi.fn(),
  })),
}));
vi.mock("../../config/read-config.js", () => ({
  readConfigFileSnapshot: vi.fn().mockReturnValue({ council: {} }),
}));
vi.mock("../../brain/council/config.js", () => ({
  parseBirthMomentConfig: vi.fn(),
}));
vi.mock("../../brain/enrichment.js", () => ({
  enrichWithCosmicContext: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../brain/synthesis/engine.js", () => ({
  calculateHarmonicSynthesis: vi.fn(),
}));
vi.mock("../../database/client.js", () => ({
  getSupabaseClient: vi.fn(),
  isSupabaseConfigured: vi.fn().mockReturnValue(false),
}));

describe("Auth middleware", () => {
  let authMiddleware: (req: Request, res: Response, next: NextFunction) => void;

  beforeEach(async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("DROFBOT_DASHBOARD_TOKEN", "valid-token");
    // Re-import to pick up env
    const mod = await import("./auth");
    authMiddleware = mod.authMiddleware;
  });

  it("rejects requests without Authorization header", () => {
    const req = { headers: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid Bearer token", () => {
    const req = { headers: { authorization: "Bearer wrong-token" } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts valid Bearer token and calls next", () => {
    const req = { headers: { authorization: "Bearer valid-token" } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects non-Bearer auth schemes", () => {
    const req = { headers: { authorization: "Basic dXNlcjpwYXNz" } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
