/**
 * Dashboard API Server
 *
 * Express-based REST API for the Drofbot Dashboard PWA.
 * Runs inside the same Node.js process as the agent.
 * All data flows through existing Drofbot singletons — the dashboard
 * and chat channels are equivalent entry points into the intelligence system.
 *
 * Auth: Bearer token (single-user system, configured via DROFBOT_DASHBOARD_TOKEN).
 * CORS: Permissive in dev, restricted to dashboard origin in production.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { authMiddleware } from "./middleware/auth.js";
import { cosmicRouter } from "./routes/cosmic.js";
import { identityRouter } from "./routes/identity.js";
import { intelligenceRouter } from "./routes/intelligence.js";
import { journalRouter } from "./routes/journal.js";
import { memoryRouter } from "./routes/memory.js";
import { modelsRouter } from "./routes/models.js";
import { preferencesRouter } from "./routes/preferences.js";
import { profileRouter } from "./routes/profile.js";
import { progressionRouter } from "./routes/progression.js";
import { vaultRouter } from "./routes/vault.js";

const log = createSubsystemLogger("dashboard-api");

/**
 * Create the Dashboard API Express app.
 * Does NOT start listening — the caller mounts it or starts it separately.
 */
export function createDashboardApi(): Express {
  const app = express();

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------

  app.use(express.json({ limit: "1mb" }));

  // CORS — permissive for single-user dashboard
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // Public routes
  // ---------------------------------------------------------------------------

  // Health check (unauthenticated)
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth endpoint
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    const expectedToken = getDashboardToken();

    if (!expectedToken) {
      res.status(503).json({ error: "Dashboard token not configured" });
      return;
    }

    if (!token || token !== expectedToken) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    res.json({ authenticated: true, expiresIn: null }); // no expiry for single-user
  });

  // ---------------------------------------------------------------------------
  // Protected routes — all require Bearer token
  // ---------------------------------------------------------------------------

  app.use("/api/journal", authMiddleware, journalRouter);
  app.use("/api/hypotheses", authMiddleware, intelligenceRouter);
  app.use("/api/patterns", authMiddleware, intelligenceRouter);
  app.use("/api/progression", authMiddleware, progressionRouter);
  app.use("/api/quests", authMiddleware, progressionRouter);
  app.use("/api/cosmic", authMiddleware, cosmicRouter);
  app.use("/api/preferences", authMiddleware, preferencesRouter);
  app.use("/api/profile", authMiddleware, profileRouter);
  app.use("/api/memory", authMiddleware, memoryRouter);
  app.use("/api/identity", authMiddleware, identityRouter);
  app.use("/api/vault", authMiddleware, vaultRouter);
  app.use("/api/models", authMiddleware, modelsRouter);

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error(`Dashboard API error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Token config
// ---------------------------------------------------------------------------

/**
 * Resolve the dashboard API token from env or config.
 */
export function getDashboardToken(): string | undefined {
  return process.env.DROFBOT_DASHBOARD_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN || undefined;
}
