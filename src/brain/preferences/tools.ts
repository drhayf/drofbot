/**
 * Self-Configuration Tools
 *
 * Lets the operator modify Drofbot's behavior through natural conversation.
 *
 * Tools:
 *   update_briefing_config — Update briefing schedule and preferences
 *   create_reminder        — Create a one-time or recurring reminder
 *   update_preferences     — Update communication style and agent behavior
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../agent-runner/tools/common.js";
import { jsonResult, readStringParam, readNumberParam } from "../agent-runner/tools/common.js";
import { setPreference, getPreference, getAllWithPrefix, type ReminderEntry } from "./store.js";

// ─── Schemas ───────────────────────────────────────────────────

const BriefingSlotSchema = Type.Object({
  enabled: Type.Boolean({ description: "Enable or disable this briefing slot." }),
  time: Type.Optional(Type.String({ description: "HH:MM time for the briefing." })),
  daysOfWeek: Type.Optional(
    Type.Array(Type.String(), {
      description: "Days of week, e.g. ['Mon','Tue','Wed','Thu','Fri'].",
    }),
  ),
});

const UpdateBriefingConfigSchema = Type.Object({
  morning: Type.Optional(BriefingSlotSchema),
  midday: Type.Optional(BriefingSlotSchema),
  evening: Type.Optional(BriefingSlotSchema),
  cosmicAlerts: Type.Optional(
    Type.Object({
      enabled: Type.Boolean(),
      kpThreshold: Type.Optional(
        Type.Number({ description: "Kp index threshold for alerts (1-9)." }),
      ),
    }),
  ),
  style: Type.Optional(
    Type.String({ description: "Briefing style: 'concise', 'detailed', or 'poetic'." }),
  ),
});

const CreateReminderSchema = Type.Object({
  message: Type.String({ description: "The reminder message to deliver." }),
  datetime: Type.Optional(Type.String({ description: "ISO datetime for a one-time reminder." })),
  recurring: Type.Optional(
    Type.Object({
      cron: Type.String({ description: "Cron expression for recurrence." }),
      until: Type.Optional(Type.String({ description: "ISO date to stop recurring." })),
    }),
  ),
  checkUp: Type.Optional(
    Type.Boolean({ description: "If true, follow up to ask if the task was done." }),
  ),
});

const UpdatePreferencesSchema = Type.Object({
  communicationStyle: Type.Optional(
    Type.String({ description: "Preferred style: 'direct', 'warm', 'poetic', etc." }),
  ),
  notificationFrequency: Type.Optional(
    Type.String({ description: "'minimal', 'normal', or 'verbose'." }),
  ),
  timezone: Type.Optional(Type.String({ description: "IANA timezone, e.g. 'America/New_York'." })),
  wakeTime: Type.Optional(Type.String({ description: "Operator's wake time in HH:MM." })),
  sleepTime: Type.Optional(Type.String({ description: "Operator's sleep time in HH:MM." })),
  primaryChannel: Type.Optional(
    Type.String({ description: "Primary messaging channel for notifications." }),
  ),
});

// ─── Tool Factories ────────────────────────────────────────────

export function createUpdateBriefingConfigTool(): AnyAgentTool {
  return {
    label: "Update Briefing Config",
    name: "update_briefing_config",
    description:
      "Update briefing schedule and preferences. " +
      "Change times, frequency, skip conditions, content style, and cosmic alert thresholds.",
    parameters: UpdateBriefingConfigSchema,
    execute: async (_toolCallId, params) => {
      const updates: string[] = [];

      // Update each briefing slot if provided
      for (const slot of ["morning", "midday", "evening"] as const) {
        const value = params[slot];
        if (value && typeof value === "object") {
          await setPreference(`briefing.${slot}`, value as Record<string, unknown>);
          updates.push(
            `${slot}: ${(value as { enabled: boolean }).enabled ? "enabled" : "disabled"}${(value as { time?: string }).time ? ` at ${(value as { time: string }).time}` : ""}`,
          );
        }
      }

      // Cosmic alerts
      if (params.cosmicAlerts && typeof params.cosmicAlerts === "object") {
        const alerts = params.cosmicAlerts as { enabled: boolean; kpThreshold?: number };
        // Domain types are serialized to Record<string, unknown> for preference storage.
        await setPreference("briefing.cosmicAlerts", alerts as unknown as Record<string, unknown>);
        updates.push(
          `cosmic alerts: ${alerts.enabled ? "enabled" : "disabled"}` +
            (alerts.kpThreshold ? ` (Kp ≥ ${alerts.kpThreshold})` : ""),
        );
      }

      // Style
      const style = readStringParam(params, "style");
      if (style) {
        await setPreference("briefing.style", { style });
        updates.push(`style: ${style}`);
      }

      if (updates.length === 0) {
        return jsonResult({ status: "no_changes", message: "No briefing settings were provided." });
      }

      return jsonResult({
        status: "updated",
        changes: updates,
        message: `Briefing configuration updated: ${updates.join(", ")}.`,
      });
    },
  };
}

export function createCreateReminderTool(): AnyAgentTool {
  return {
    label: "Create Reminder",
    name: "create_reminder",
    description:
      "Create a one-time or recurring reminder. " +
      "Delivered via the primary channel at the specified time. " +
      "Can optionally follow up to check if the task was completed.",
    parameters: CreateReminderSchema,
    execute: async (_toolCallId, params) => {
      const message = readStringParam(params, "message", { required: true });
      const datetime = readStringParam(params, "datetime");
      const checkUp = params.checkUp === true;

      // Validate at least one timing is specified
      if (!datetime && !params.recurring) {
        return jsonResult({
          status: "error",
          message: "Either 'datetime' (for one-time) or 'recurring' (for recurring) is required.",
        });
      }

      // Build reminder entry
      const reminder: ReminderEntry = {
        id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        message,
        datetime: datetime ?? undefined,
        checkUp,
        createdAt: new Date().toISOString(),
      };

      if (params.recurring && typeof params.recurring === "object") {
        const rec = params.recurring as { cron: string; until?: string };
        reminder.recurring = {
          cron: rec.cron,
          until: rec.until,
        };
      }

      // Store in preferences under reminders array
      const existing = (await getPreference("reminders")) ?? {};
      const reminders = Array.isArray(existing.items) ? existing.items : [];
      reminders.push(reminder);
      await setPreference("reminders", { items: reminders }, false);

      const timing = reminder.recurring
        ? `recurring (${reminder.recurring.cron})`
        : `one-time at ${reminder.datetime}`;

      return jsonResult({
        status: "created",
        reminderId: reminder.id,
        message: `Reminder created: "${message}" — ${timing}${checkUp ? " (with follow-up)" : ""}.`,
      });
    },
  };
}

export function createUpdatePreferencesTool(): AnyAgentTool {
  return {
    label: "Update Preferences",
    name: "update_preferences",
    description:
      "Update operator preferences for communication style, notification frequency, " +
      "timezone, wake/sleep times, and primary channel.",
    parameters: UpdatePreferencesSchema,
    execute: async (_toolCallId, params) => {
      const updates: string[] = [];

      const commStyle = readStringParam(params, "communicationStyle");
      if (commStyle) {
        await setPreference("comm.style", { style: commStyle });
        updates.push(`communication style: ${commStyle}`);
      }

      const notifFreq = readStringParam(params, "notificationFrequency");
      if (notifFreq) {
        await setPreference("comm.notificationFrequency", { frequency: notifFreq });
        updates.push(`notification frequency: ${notifFreq}`);
      }

      const tz = readStringParam(params, "timezone");
      if (tz) {
        await setPreference("schedule.timezone", { timezone: tz });
        updates.push(`timezone: ${tz}`);
      }

      const wakeTime = readStringParam(params, "wakeTime");
      if (wakeTime) {
        await setPreference("schedule.wakeTime", { time: wakeTime });
        updates.push(`wake time: ${wakeTime}`);
      }

      const sleepTime = readStringParam(params, "sleepTime");
      if (sleepTime) {
        await setPreference("schedule.sleepTime", { time: sleepTime });
        updates.push(`sleep time: ${sleepTime}`);
      }

      const channel = readStringParam(params, "primaryChannel");
      if (channel) {
        await setPreference("channel.primary", { channel });
        updates.push(`primary channel: ${channel}`);
      }

      if (updates.length === 0) {
        return jsonResult({ status: "no_changes", message: "No preferences were provided." });
      }

      return jsonResult({
        status: "updated",
        changes: updates,
        message: `Preferences updated: ${updates.join(", ")}.`,
      });
    },
  };
}

// ─── Convenience: all self-config tools ────────────────────────

export function createSelfConfigTools(): AnyAgentTool[] {
  return [
    createUpdateBriefingConfigTool(),
    createCreateReminderTool(),
    createUpdatePreferencesTool(),
  ];
}
