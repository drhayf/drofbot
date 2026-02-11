import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Supabase client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null when env vars not configured", async () => {
    // Default: no env vars set
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    const mod = await import("../api/supabase");
    expect(mod.getSupabase()).toBeNull();
  });
});
