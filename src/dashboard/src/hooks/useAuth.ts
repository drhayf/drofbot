import { useCallback } from "react";
import { hasToken } from "../api/client";
import { useAuthStore } from "../stores/auth";

/**
 * Convenience hook for auth state + actions.
 */
export function useAuth() {
  const { isAuthenticated, isLoading, error, login, logout, checkAuth } = useAuthStore();

  const ensureAuth = useCallback(() => {
    if (!hasToken()) {
      window.location.href = "/login";
      return false;
    }
    return true;
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
    ensureAuth,
  };
}
