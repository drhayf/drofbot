import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearToken, setToken } from "../api/client";
import { useAuthStore } from "../stores/auth";

describe("Auth store", () => {
  beforeEach(() => {
    clearToken();
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it("initial state reflects localStorage", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("login sets isAuthenticated on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const result = await useAuthStore.getState().login("valid-token");
    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("login sets error on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await useAuthStore.getState().login("bad-token");
    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBe("Invalid token");
  });

  it("logout clears auth state", () => {
    setToken("test");
    useAuthStore.setState({ isAuthenticated: true });

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("checkAuth reads from localStorage", () => {
    setToken("test-token");
    useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
