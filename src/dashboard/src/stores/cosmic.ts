import { create } from "zustand";
import type {
  CosmicSynthesis,
  CosmicWeather,
  GateWeather,
  LunarWeather,
  TransitsWeather,
} from "../types";
import { cosmicApi } from "../api/client";

// ─── API → Store Mappers ──────────────────────────────────────────
// The backend returns raw system field names; components expect semantic names.

function mapGate(raw: Record<string, unknown> | null | undefined): GateWeather | null {
  if (!raw) return null;
  return {
    timestamp: (raw.timestamp as string) ?? new Date().toISOString(),
    number: (raw.sunGate as number) ?? (raw.number as number),
    line: (raw.sunLine as number) ?? (raw.line as number),
    name: (raw.gateName as string) ?? (raw.name as string),
    geneKeys:
      raw.shadow || raw.gift || raw.siddhi
        ? {
            shadow: raw.shadow as string | undefined,
            gift: raw.gift as string | undefined,
            siddhi: raw.siddhi as string | undefined,
          }
        : (raw.geneKeys as GateWeather["geneKeys"]),
    profile: (raw.lineArchetype as string) ?? (raw.profile as string),
    metrics: (raw.metrics as Record<string, number>) ?? {},
    summary: (raw.summary as string) ?? "",
  };
}

function mapLunar(raw: Record<string, unknown> | null | undefined): LunarWeather | null {
  if (!raw) return null;
  return {
    timestamp: (raw.timestamp as string) ?? new Date().toISOString(),
    phase: (raw.phaseName as string) ?? (raw.phase as string),
    illumination: raw.illumination as number | undefined,
    daysToNextPhase: raw.daysToNextPhase as number | undefined,
    isVoidOfCourse: raw.isVoidOfCourse as boolean | undefined,
    zodiacSign: raw.zodiacSign as string | undefined,
    metrics: (raw.metrics as Record<string, number>) ?? {},
    summary: (raw.summary as string) ?? "",
  };
}

function mapTransits(raw: Record<string, unknown> | null | undefined): TransitsWeather | null {
  if (!raw) return null;
  const skyAspects = raw.skyAspects as
    | Array<{ planets: string; aspect: string; orb: number }>
    | undefined;
  const active = skyAspects
    ? skyAspects.map((a) => ({
        planet: a.planets,
        aspect: a.aspect,
        description: `${a.aspect} (orb ${a.orb.toFixed(1)}°)`,
      }))
    : (raw.active as TransitsWeather["active"]);
  return {
    timestamp: (raw.timestamp as string) ?? new Date().toISOString(),
    active,
    retrogrades: raw.retrogrades as string[] | undefined,
    metrics: (raw.metrics as Record<string, number>) ?? {},
    summary: (raw.summary as string) ?? "",
  };
}

interface CosmicStoreState {
  weather: CosmicWeather | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetch: () => Promise<void>;
  fetchSynthesis: () => Promise<void>;
}

export const useCosmicStore = create<CosmicStoreState>((set, get) => ({
  weather: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetch: async () => {
    // Don't refetch within 5 minutes
    const last = get().lastFetched;
    if (last && Date.now() - last < 5 * 60 * 1000) return;

    set({ isLoading: true, error: null });
    try {
      // Use allSettled so individual 503s (e.g. card without birth data) don't
      // crash the entire fetch — each endpoint degrades to null independently.
      const [currentRes, cardRes, gateRes, solarRes, lunarRes, transitsRes] =
        await Promise.allSettled([
          cosmicApi.getCurrent(),
          cosmicApi.getCard(),
          cosmicApi.getGate(),
          cosmicApi.getSolar(),
          cosmicApi.getLunar(),
          cosmicApi.getTransits(),
        ]);

      const current = currentRes.status === "fulfilled" ? currentRes.value : null;
      const card = cardRes.status === "fulfilled" ? (cardRes.value?.card ?? null) : null;
      const gate =
        gateRes.status === "fulfilled"
          ? mapGate(gateRes.value?.gate as unknown as Record<string, unknown> | undefined)
          : null;
      const solar = solarRes.status === "fulfilled" ? (solarRes.value?.solar ?? null) : null;
      const lunar =
        lunarRes.status === "fulfilled"
          ? mapLunar(lunarRes.value?.lunar as unknown as Record<string, unknown> | undefined)
          : null;
      const transits =
        transitsRes.status === "fulfilled"
          ? mapTransits(transitsRes.value?.transits as unknown as Record<string, unknown> | undefined)
          : null;

      // Map harmony from /current to our synthesis shape
      const harmony = current?.harmony;
      const synthesis: CosmicSynthesis | null = harmony
        ? {
            overallResonance: harmony.overallResonance,
            resonanceType: harmony.resonanceType,
            narrative: harmony.guidance,
            elementalBalance: harmony.elementalBalance,
            confidence: harmony.confidence ?? 0.5,
          }
        : null;

      // As long as at least one system returned data, show the page
      const hasAnyData = current || card || gate || solar || lunar || transits;

      set({
        weather: hasAnyData ? { card, gate, solar, lunar, transits, synthesis } : null,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  fetchSynthesis: async () => {
    try {
      const data = await cosmicApi.getSynthesis();
      if (data.synthesis?.rendered) {
        set((state) => ({
          weather: state.weather
            ? {
                ...state.weather,
                synthesis: state.weather.synthesis
                  ? { ...state.weather.synthesis, narrative: data.synthesis!.rendered }
                  : {
                      overallResonance: 0,
                      resonanceType: "NEUTRAL",
                      narrative: data.synthesis!.rendered,
                      confidence: 0.5,
                    },
              }
            : null,
        }));
      }
    } catch {
      // Synthesis may 503 if engine isn't initialized — that's fine,
      // the page still renders other cosmic data.
    }
  },
}));
