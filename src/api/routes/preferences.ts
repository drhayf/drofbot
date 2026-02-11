/**
 * Dashboard API — Preferences Routes
 *
 * GET    /api/preferences            — All current preferences
 * PUT    /api/preferences            — Update preferences
 * GET    /api/preferences/briefings  — Briefing configuration
 * PUT    /api/preferences/briefings  — Update briefing configuration
 */

import { Router, type Request, type Response } from "express";
import { getPreference, setPreference } from "../../brain/preferences/store.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("dashboard-api/preferences");

export const preferencesRouter: Router = Router();

/** Well-known preference keys */
const BRIEFING_KEYS = [
  "briefing.morning",
  "briefing.midday",
  "briefing.evening",
  "briefing.cosmicAlerts",
  "briefing.style",
];

const ALL_KNOWN_KEYS = [
  ...BRIEFING_KEYS,
  "comm.style",
  "comm.notificationFrequency",
  "schedule.timezone",
  "schedule.wakeTime",
  "schedule.sleepTime",
  "channel.primary",
];

/**
 * GET /api/preferences
 * Returns all current preferences.
 */
preferencesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const preferences: Record<string, Record<string, unknown> | undefined> = {};

    // Fetch all known keys
    for (const key of ALL_KNOWN_KEYS) {
      preferences[key] = await getPreference(key);
    }

    res.json({ preferences });
  } catch (err) {
    log.error(`Failed to get preferences: ${err}`);
    res.status(500).json({ error: "Failed to get preferences" });
  }
});

/**
 * PUT /api/preferences
 * Update preferences. Accepts a map of key → value.
 */
preferencesRouter.put("/", async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, Record<string, unknown>>;

    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      res.status(400).json({ error: "Body must be an object of key → value pairs" });
      return;
    }

    const results: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== "object" || value === null) {
        results[key] = false;
        continue;
      }
      results[key] = await setPreference(key, value);
    }

    res.json({ updated: results });
  } catch (err) {
    log.error(`Failed to update preferences: ${err}`);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

/**
 * GET /api/preferences/briefings
 * Returns briefing-specific configuration.
 */
preferencesRouter.get("/briefings", async (_req: Request, res: Response) => {
  try {
    const briefings: Record<string, Record<string, unknown> | undefined> = {};
    for (const key of BRIEFING_KEYS) {
      briefings[key] = await getPreference(key);
    }

    res.json({ briefings });
  } catch (err) {
    log.error(`Failed to get briefing config: ${err}`);
    res.status(500).json({ error: "Failed to get briefing config" });
  }
});

/**
 * PUT /api/preferences/briefings
 * Update briefing configuration.
 */
preferencesRouter.put("/briefings", async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, Record<string, unknown>>;

    if (!updates || typeof updates !== "object") {
      res.status(400).json({ error: "Body must be an object" });
      return;
    }

    const results: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!BRIEFING_KEYS.includes(key)) {
        results[key] = false;
        continue;
      }
      if (typeof value !== "object" || value === null) {
        results[key] = false;
        continue;
      }
      results[key] = await setPreference(key, value);
    }

    res.json({ updated: results });
  } catch (err) {
    log.error(`Failed to update briefing config: ${err}`);
    res.status(500).json({ error: "Failed to update briefing config" });
  }
});
