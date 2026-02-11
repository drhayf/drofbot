/**
 * Dashboard API client — thin fetch wrapper with Bearer token auth.
 * All API calls go through here for consistent auth + error handling.
 */

import type {
  CardWeather,
  CosmicCurrentResponse,
  CosmicSynthesisResponse,
  GateWeather,
  Hypothesis,
  JournalEntry,
  LunarWeather,
  PatternSummary,
  PlayerStats,
  Quest,
  SolarWeather,
  TransitsWeather,
} from "../types";

const API_BASE = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("drofbot_token");
}

export function setToken(token: string): void {
  localStorage.setItem("drofbot_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("drofbot_token");
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// -- Endpoint modules --

export const journalApi = {
  getEntries: (page = 1, limit = 20) =>
    api.get<{ entries: JournalEntry[]; total: number }>(
      `/journal/entries?page=${page}&limit=${limit}`,
    ),
  getEntry: (id: string) => api.get<{ entry: JournalEntry }>(`/journal/${id}`),
  createEntry: (data: { content: string; mood?: string; tags?: string[] }) =>
    api.post<{ id: string; matchedHypotheses: string[]; timestamp: string }>(
      "/journal/entry",
      data,
    ),
};

export const intelligenceApi = {
  getHypotheses: (status?: string) =>
    api.get<{ hypotheses: Hypothesis[]; total: number }>(
      `/hypotheses${status ? `?status=${status}` : ""}`,
    ),
  getHypothesis: (id: string) => api.get<Hypothesis>(`/hypotheses/${id}`),
  confirmHypothesis: (id: string) => api.post<Hypothesis>(`/hypotheses/${id}/confirm`),
  rejectHypothesis: (id: string) => api.post<Hypothesis>(`/hypotheses/${id}/reject`),
  getPatterns: () => api.get<{ patterns: PatternSummary[]; total: number }>("/patterns"),
};

export const progressionApi = {
  getStats: () => api.get<{ stats: PlayerStats }>("/progression"),
  getQuests: () => api.get<{ quests: Quest[]; total: number }>("/progression/quests"),
  completeQuest: (id: string) => api.post<Quest>(`/progression/quests/${id}/complete`),
  createQuest: (data: { title: string; description: string; difficulty: string }) =>
    api.post<Quest>("/progression/quests", data),
};

export const cosmicApi = {
  getCurrent: () => api.get<CosmicCurrentResponse>("/cosmic/current"),
  getSynthesis: () => api.get<CosmicSynthesisResponse>("/cosmic/synthesis"),
  getCard: () => api.get<{ card: CardWeather }>("/cosmic/card"),
  getGate: () => api.get<{ gate: GateWeather }>("/cosmic/gate"),
  getSolar: () => api.get<{ solar: SolarWeather }>("/cosmic/solar"),
  getLunar: () => api.get<{ lunar: LunarWeather }>("/cosmic/lunar"),
  getTransits: () => api.get<{ transits: TransitsWeather }>("/cosmic/transits"),
};

export const preferencesApi = {
  getAll: () =>
    api.get<{ preferences: Record<string, Record<string, unknown> | undefined> }>("/preferences"),
  update: (prefs: Record<string, unknown>) =>
    api.put<{ updated: Record<string, boolean> }>("/preferences", prefs),
  getBriefings: () =>
    api.get<{ briefings: Record<string, Record<string, unknown> | undefined> }>(
      "/preferences/briefings",
    ),
  updateBriefings: (config: Record<string, unknown>) =>
    api.put<{ updated: Record<string, boolean> }>("/preferences/briefings", config),
};

export const profileApi = {
  get: () => api.get<{ profile: unknown }>("/profile"),
  getSynthesis: () => api.get<{ synthesis: unknown }>("/profile/synthesis"),
};

export const vaultApi = {
  getSynthesis: () => api.get<{ synthesis: unknown }>("/vault/synthesis"),
  getVoiceProfile: () => api.get<{ profile: unknown }>("/vault/voice-profile"),
  getPreferences: () =>
    api.get<{ preferences: Record<string, unknown> }>("/vault/preferences"),
  getNotes: () => api.get<{ notes: unknown[] }>("/vault/notes"),
  getReferences: () => api.get<{ documents: unknown[] }>("/vault/references"),
};

export const memoryApi = {
  getRecent: (limit = 20) =>
    api.get<{ memories: unknown[] }>(`/memory/recent?limit=${limit}`),
  search: (query: string) =>
    api.get<{ results: unknown[] }>(
      `/memory/search?q=${encodeURIComponent(query)}`,
    ),
  getStats: () => api.get<{ stats: Record<string, { count: number }> }>("/memory/stats"),
};

export const identityApi = {
  getSelf: () =>
    api.get<{ birthMoment: unknown; systems: unknown; harmony: unknown }>("/identity/self"),
  getRelationship: () =>
    api.get<{
      operator: { birthMoment: unknown; harmony: unknown };
      agent: { birthMoment: unknown; harmony: unknown };
    }>("/identity/relationship"),
};

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  promptPrice: number;
  completionPrice: number;
  contextLength: number;
  pricing: string;
}

export interface CurrentModelInfo {
  model: string;
  source: "preference" | "env" | "fallback";
  envDefault: string;
  pricing: string | null;
  contextLength: number | null;
  name: string | null;
}

export const modelsApi = {
  list: (query?: string) =>
    api.get<{
      models: ModelInfo[];
      total: number;
      cache: { fetchedAt: string | null; stale: boolean };
    }>(`/models${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  getCurrent: () => api.get<CurrentModelInfo>("/models/current"),
  setCurrent: (model: string) =>
    api.put<{
      status: string;
      previous: string;
      current: string;
      name: string;
      pricing: string;
      contextLength: number;
    }>("/models/current", { model }),
  clearCurrent: () =>
    api.delete<{ status: string; previous: string; activeNow: string; source: string }>(
      "/models/current",
    ),
  refresh: () => api.get<{ status: string; count: number; fetchedAt: string }>("/models/refresh"),
};

export const authApi = {
  login: async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setToken(token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};
