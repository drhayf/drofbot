/**
 * Preference Store
 *
 * Key-value preference storage backed by Supabase `preferences` table.
 * Provides typed get/set for operator preferences, briefing config,
 * and reminders. Falls back to in-memory store when Supabase is unavailable.
 *
 * Well-known keys:
 *   - `briefing.morning`, `briefing.midday`, `briefing.evening`
 *   - `briefing.cosmicAlerts`, `briefing.style`
 *   - `comm.style`, `comm.notificationFrequency`
 *   - `schedule.timezone`, `schedule.wakeTime`, `schedule.sleepTime`
 *   - `channel.primary`
 *   - `reminders` (array of pending reminders)
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../shared/database/client.js";

const log = createSubsystemLogger("preferences");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefingSlotConfig {
  enabled: boolean;
  time?: string; // HH:MM
  daysOfWeek?: string[]; // ["Mon","Tue",...]
}

export interface CosmicAlertConfig {
  enabled: boolean;
  kpThreshold?: number;
}

export interface ReminderEntry {
  id: string;
  message: string;
  datetime?: string;
  recurring?: { cron: string; until?: string };
  checkUp?: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// In-Memory Fallback
// ---------------------------------------------------------------------------

const _inMemory = new Map<string, Record<string, unknown>>();

// ---------------------------------------------------------------------------
// Store API
// ---------------------------------------------------------------------------

/**
 * Get a preference value by key.
 * Returns `undefined` if not set.
 */
export async function getPreference(key: string): Promise<Record<string, unknown> | undefined> {
  if (!isSupabaseConfigured()) {
    return _inMemory.get(key);
  }

  const client = getSupabaseClient();
  if (!client) return _inMemory.get(key);

  try {
    const { data, error } = await client
      .from("preferences")
      .select("value")
      .eq("key", key)
      .single();

    if (error || !data) return _inMemory.get(key);
    return data.value as Record<string, unknown>;
  } catch {
    return _inMemory.get(key);
  }
}

/**
 * Set a preference value (upsert).
 * Merges with existing value if `merge` is true.
 */
export async function setPreference(
  key: string,
  value: Record<string, unknown>,
  merge = true,
): Promise<boolean> {
  // Always update in-memory
  if (merge) {
    const existing = _inMemory.get(key) ?? {};
    _inMemory.set(key, { ...existing, ...value });
  } else {
    _inMemory.set(key, value);
  }

  if (!isSupabaseConfigured()) return true;

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    let finalValue = value;
    if (merge) {
      const existing = await getPreference(key);
      if (existing) {
        finalValue = { ...existing, ...value };
      }
    }

    const { error } = await client.from("preferences").upsert(
      {
        key,
        value: finalValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      log.error(`Failed to set preference '${key}': ${error.message}`);
      return false;
    }

    log.debug(`Preference '${key}' updated`);
    return true;
  } catch (err) {
    log.error(`Preference set error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Get all preferences matching a key prefix.
 * E.g., `getAllWithPrefix("briefing.")` returns all briefing preferences.
 */
export async function getAllWithPrefix(
  prefix: string,
): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>();

  // Always include in-memory entries
  for (const [k, v] of _inMemory) {
    if (k.startsWith(prefix)) result.set(k, v);
  }

  if (!isSupabaseConfigured()) return result;

  const client = getSupabaseClient();
  if (!client) return result;

  try {
    const { data, error } = await client
      .from("preferences")
      .select("key, value")
      .like("key", `${prefix}%`);

    if (error || !data) return result;

    for (const row of data) {
      result.set(row.key, row.value as Record<string, unknown>);
    }
  } catch {
    // Fall through with in-memory results
  }

  return result;
}

/**
 * Delete a preference by key.
 */
export async function deletePreference(key: string): Promise<boolean> {
  _inMemory.delete(key);

  if (!isSupabaseConfigured()) return true;

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const { error } = await client.from("preferences").delete().eq("key", key);
    if (error) {
      log.error(`Failed to delete preference '${key}': ${error.message}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset in-memory store (for testing).
 */
export function resetInMemoryPreferences(): void {
  _inMemory.clear();
}
