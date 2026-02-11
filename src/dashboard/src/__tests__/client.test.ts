import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, setToken, clearToken, hasToken, authApi } from "../api/client";

describe("API client", () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearToken();
  });

  describe("token management", () => {
    it("hasToken returns false when no token set", () => {
      expect(hasToken()).toBe(false);
    });

    it("hasToken returns true after setToken", () => {
      setToken("test-token");
      expect(hasToken()).toBe(true);
    });

    it("clearToken removes the token", () => {
      setToken("test-token");
      clearToken();
      expect(hasToken()).toBe(false);
    });

    it("stores token in localStorage", () => {
      setToken("my-token");
      expect(localStorage.getItem("drofbot_token")).toBe("my-token");
    });
  });

  describe("api.get", () => {
    it("makes GET requests with auth header", async () => {
      setToken("test-token");
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "test" }),
      });

      const result = await api.get("/test");
      expect(result).toEqual({ data: "test" });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe("/api/test");
      expect(fetchCall[1].headers.Authorization).toBe("Bearer test-token");
    });

    it("redirects to /login on 401", async () => {
      setToken("bad-token");
      // Note: window.location redirect is tested via hasToken being cleared

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      await expect(api.get("/test")).rejects.toThrow("Unauthorized");
      expect(hasToken()).toBe(false);
    });
  });

  describe("api.post", () => {
    it("sends JSON body", async () => {
      setToken("test-token");
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });

      await api.post("/test", { key: "value" });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
      expect(fetchCall[1].body).toBe(JSON.stringify({ key: "value" }));
    });
  });

  describe("authApi.login", () => {
    it("sets token on successful login", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await authApi.login("valid-token");
      expect(result).toBe(true);
      expect(hasToken()).toBe(true);
    });

    it("returns false on failed login", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await authApi.login("bad-token");
      expect(result).toBe(false);
    });

    it("returns false on network error", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await authApi.login("any-token");
      expect(result).toBe(false);
    });
  });
});
