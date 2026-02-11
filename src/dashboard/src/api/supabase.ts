import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for direct reads (real-time subscriptions, memory queries).
 * Writes go through the Dashboard API to preserve brain-system invariants.
 */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;

  // These are injected at build time via Vite env vars
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn("[dashboard] Supabase not configured — real-time disabled");
    return null;
  }

  client = createClient(url, key);
  return client;
}
