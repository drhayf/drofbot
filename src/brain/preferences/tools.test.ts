/**
 * Tests for Self-Configuration Tools (Phase 4 — Area 5).
 *
 * Tests update_briefing_config, create_reminder, update_preferences
 * tools and the preference store.
 */

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase (preference store falls back to in-memory without it)
// ---------------------------------------------------------------------------

vi.mock("../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  getPreference,
  setPreference,
  getAllWithPrefix,
  resetInMemoryPreferences,
} from "./store.js";
import {
  createUpdateBriefingConfigTool,
  createCreateReminderTool,
  createUpdatePreferencesTool,
  createSelfConfigTools,
} from "./tools.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Self-Configuration Tools", () => {
  beforeEach(() => {
    resetInMemoryPreferences();
  });

  // ── Factory ──────────────────────────────────────────────

  describe("createSelfConfigTools", () => {
    it("returns 3 tools", () => {
      const tools = createSelfConfigTools();
      expect(tools).toHaveLength(3);
      const names = tools.map((t) => t.name);
      expect(names).toContain("update_briefing_config");
      expect(names).toContain("create_reminder");
      expect(names).toContain("update_preferences");
    });
  });

  // ── Briefing Config ──────────────────────────────────────

  describe("update_briefing_config", () => {
    it("updates morning briefing schedule", async () => {
      const tool = createUpdateBriefingConfigTool();
      const result = await tool.execute("tc-1", {
        morning: { enabled: true, time: "07:30" },
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toContain("morning: enabled at 07:30");

      // Verify preference was stored
      const pref = await getPreference("briefing.morning");
      expect(pref?.enabled).toBe(true);
      expect(pref?.time).toBe("07:30");
    });

    it("disables midday briefing", async () => {
      const tool = createUpdateBriefingConfigTool();
      const result = await tool.execute("tc-2", {
        midday: { enabled: false },
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toContain("midday: disabled");
    });

    it("updates cosmic alert threshold", async () => {
      const tool = createUpdateBriefingConfigTool();
      const result = await tool.execute("tc-3", {
        cosmicAlerts: { enabled: true, kpThreshold: 7 },
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes[0]).toContain("Kp ≥ 7");

      const pref = await getPreference("briefing.cosmicAlerts");
      expect(pref?.kpThreshold).toBe(7);
    });

    it("updates briefing style", async () => {
      const tool = createUpdateBriefingConfigTool();
      const result = await tool.execute("tc-4", {
        style: "poetic",
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toContain("style: poetic");
    });

    it("handles multiple updates at once", async () => {
      const tool = createUpdateBriefingConfigTool();
      const result = await tool.execute("tc-5", {
        morning: { enabled: true, time: "06:00", daysOfWeek: ["Mon", "Wed", "Fri"] },
        evening: { enabled: true, time: "21:00" },
        style: "concise",
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toHaveLength(3);
    });

    it("returns no_changes when nothing provided", async () => {
      const tool = createUpdateBriefingConfigTool();
      const result = await tool.execute("tc-6", {});
      const data = parseResult(result);

      expect(data.status).toBe("no_changes");
    });
  });

  // ── Create Reminder ──────────────────────────────────────

  describe("create_reminder", () => {
    it("creates a one-time reminder", async () => {
      const tool = createCreateReminderTool();
      const result = await tool.execute("tc-7", {
        message: "Call the bank",
        datetime: "2024-06-15T14:00:00Z",
      });
      const data = parseResult(result);

      expect(data.status).toBe("created");
      expect(data.reminderId).toBeTruthy();
      expect(data.message).toContain("Call the bank");
      expect(data.message).toContain("one-time");

      // Verify stored reminder
      const pref = await getPreference("reminders");
      expect(pref?.items).toHaveLength(1);
      const rem = (pref!.items as Array<{ message: string }>)[0];
      expect(rem.message).toBe("Call the bank");
    });

    it("creates a recurring reminder", async () => {
      const tool = createCreateReminderTool();
      const result = await tool.execute("tc-8", {
        message: "Take vitamins",
        recurring: { cron: "0 8 * * *" },
      });
      const data = parseResult(result);

      expect(data.status).toBe("created");
      expect(data.message).toContain("recurring");
    });

    it("creates a reminder with follow-up", async () => {
      const tool = createCreateReminderTool();
      const result = await tool.execute("tc-9", {
        message: "Submit report",
        datetime: "2024-06-15T17:00:00Z",
        checkUp: true,
      });
      const data = parseResult(result);

      expect(data.status).toBe("created");
      expect(data.message).toContain("follow-up");

      const pref = await getPreference("reminders");
      const rem = (pref!.items as Array<{ checkUp: boolean }>)[0];
      expect(rem.checkUp).toBe(true);
    });

    it("stores multiple reminders", async () => {
      const tool = createCreateReminderTool();
      await tool.execute("tc-10a", {
        message: "First",
        datetime: "2024-06-15T10:00:00Z",
      });
      await tool.execute("tc-10b", {
        message: "Second",
        datetime: "2024-06-15T14:00:00Z",
      });

      const pref = await getPreference("reminders");
      expect(pref?.items).toHaveLength(2);
    });

    it("fails when no timing specified", async () => {
      const tool = createCreateReminderTool();
      const result = await tool.execute("tc-11", {
        message: "No time specified",
      });
      const data = parseResult(result);

      expect(data.status).toBe("error");
    });
  });

  // ── Update Preferences ──────────────────────────────────

  describe("update_preferences", () => {
    it("updates communication style", async () => {
      const tool = createUpdatePreferencesTool();
      const result = await tool.execute("tc-12", {
        communicationStyle: "warm",
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toContain("communication style: warm");

      const pref = await getPreference("comm.style");
      expect(pref?.style).toBe("warm");
    });

    it("updates timezone and wake/sleep times", async () => {
      const tool = createUpdatePreferencesTool();
      const result = await tool.execute("tc-13", {
        timezone: "America/New_York",
        wakeTime: "06:30",
        sleepTime: "22:00",
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toHaveLength(3);
      expect(data.changes).toContain("timezone: America/New_York");
      expect(data.changes).toContain("wake time: 06:30");
      expect(data.changes).toContain("sleep time: 22:00");
    });

    it("updates primary channel", async () => {
      const tool = createUpdatePreferencesTool();
      const result = await tool.execute("tc-14", {
        primaryChannel: "telegram",
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toContain("primary channel: telegram");
    });

    it("returns no_changes when nothing provided", async () => {
      const tool = createUpdatePreferencesTool();
      const result = await tool.execute("tc-15", {});
      const data = parseResult(result);

      expect(data.status).toBe("no_changes");
    });

    it("updates notification frequency", async () => {
      const tool = createUpdatePreferencesTool();
      const result = await tool.execute("tc-16", {
        notificationFrequency: "minimal",
      });
      const data = parseResult(result);

      expect(data.status).toBe("updated");
      expect(data.changes).toContain("notification frequency: minimal");

      const pref = await getPreference("comm.notificationFrequency");
      expect(pref?.frequency).toBe("minimal");
    });
  });

  // ── Preference Store ──────────────────────────────────────

  describe("preference store (in-memory)", () => {
    it("stores and retrieves a preference", async () => {
      await setPreference("test.key", { value: 42 });
      const pref = await getPreference("test.key");
      expect(pref?.value).toBe(42);
    });

    it("merges preferences by default", async () => {
      await setPreference("test.merge", { a: 1 });
      await setPreference("test.merge", { b: 2 });
      const pref = await getPreference("test.merge");
      expect(pref?.a).toBe(1);
      expect(pref?.b).toBe(2);
    });

    it("replaces when merge is false", async () => {
      await setPreference("test.replace", { a: 1 });
      await setPreference("test.replace", { b: 2 }, false);
      const pref = await getPreference("test.replace");
      expect(pref?.a).toBeUndefined();
      expect(pref?.b).toBe(2);
    });

    it("returns undefined for unset keys", async () => {
      const pref = await getPreference("nonexistent");
      expect(pref).toBeUndefined();
    });

    it("gets all with prefix", async () => {
      await setPreference("app.color", { value: "blue" });
      await setPreference("app.font", { value: "mono" });
      await setPreference("other.key", { value: "x" });

      const prefs = await getAllWithPrefix("app.");
      expect(prefs.size).toBe(2);
      expect(prefs.get("app.color")?.value).toBe("blue");
      expect(prefs.get("app.font")?.value).toBe("mono");
    });
  });
});
