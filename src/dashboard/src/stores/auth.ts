import { create } from "zustand";
import { authApi, hasToken, clearToken } from "../api/client";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: hasToken(),
  isLoading: false,
  error: null,

  login: async (token: string) => {
    set({ isLoading: true, error: null });
    const ok = await authApi.login(token);
    if (ok) {
      set({ isAuthenticated: true, isLoading: false });
    } else {
      set({ isAuthenticated: false, isLoading: false, error: "Invalid token" });
    }
    return ok;
  },

  logout: () => {
    clearToken();
    set({ isAuthenticated: false });
  },

  checkAuth: () => {
    set({ isAuthenticated: hasToken() });
  },
}));
