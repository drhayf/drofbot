/**
 * Drofbot — Database Client
 *
 * Provides a Supabase client with environment-based config and connection management.
 * The memory system gracefully degrades when Supabase is not configured — the existing
 * QMD/markdown memory continues to work independently.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Env var names with backward-compat OPENCLAW_ prefixes
const ENV_SUPABASE_URL = "DROFBOT_SUPABASE_URL";
const ENV_SUPABASE_URL_COMPAT = "OPENCLAW_SUPABASE_URL";
const ENV_SUPABASE_ANON_KEY = "DROFBOT_SUPABASE_ANON_KEY";
const ENV_SUPABASE_ANON_KEY_COMPAT = "OPENCLAW_SUPABASE_ANON_KEY";
const ENV_SUPABASE_SERVICE_KEY = "DROFBOT_SUPABASE_SERVICE_KEY";
const ENV_SUPABASE_SERVICE_KEY_COMPAT = "OPENCLAW_SUPABASE_SERVICE_KEY";

export interface DatabaseConfig {
  url: string;
  anonKey?: string;
  serviceKey?: string;
}

/**
 * Resolve database config from environment variables.
 * Returns config with whatever env vars are set — callers decide if it's sufficient.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const url =
    process.env[ENV_SUPABASE_URL] ?? process.env[ENV_SUPABASE_URL_COMPAT] ?? "";
  const anonKey =
    process.env[ENV_SUPABASE_ANON_KEY] ?? process.env[ENV_SUPABASE_ANON_KEY_COMPAT];
  const serviceKey =
    process.env[ENV_SUPABASE_SERVICE_KEY] ?? process.env[ENV_SUPABASE_SERVICE_KEY_COMPAT];

  return { url, anonKey, serviceKey };
}

/**
 * Check whether Supabase is configured (URL + at least one key).
 * When false, structured memory banks are unavailable; QMD memory still works.
 */
export function isSupabaseConfigured(): boolean {
  const cfg = getDatabaseConfig();
  return !!(cfg.url && (cfg.serviceKey ?? cfg.anonKey));
}

let _client: SupabaseClient | null = null;

/**
 * Get (or create) the singleton Supabase client.
 * Prefers service key over anon key for full access to memory tables.
 *
 * Throws if Supabase is not configured — callers should guard with `isSupabaseConfigured()`.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const cfg = getDatabaseConfig();
  const key = cfg.serviceKey ?? cfg.anonKey;

  if (!cfg.url || !key) {
    throw new Error(
      "Supabase not configured. Set DROFBOT_SUPABASE_URL and DROFBOT_SUPABASE_SERVICE_KEY (or ANON_KEY) in .env",
    );
  }

  _client = createClient(cfg.url, key);
  return _client;
}

/**
 * Get a service-role client for admin operations (migrations, etc.).
 * Throws if the service key is not set.
 */
export function getServiceClient(): SupabaseClient {
  const cfg = getDatabaseConfig();
  if (!cfg.url || !cfg.serviceKey) {
    throw new Error(
      `Missing ${ENV_SUPABASE_SERVICE_KEY}. Set it in your .env for admin operations.`,
    );
  }
  return createClient(cfg.url, cfg.serviceKey);
}

/**
 * Reset the singleton client (for testing).
 */
export function resetSupabaseClient(): void {
  _client = null;
}
