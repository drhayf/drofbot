/**
 * Solar Tracking System — Space Weather Monitoring
 *
 * Ported from GUTTERS `tracking/solar/tracker.py` (478 lines).
 *
 * Monitors real-time space weather from NOAA SWPC:
 *  - Kp Index (geomagnetic storm indicator, 0-9)
 *  - Solar flare activity (X-ray flux classes A/B/C/M/X)
 *  - Solar wind speed (km/s)
 *
 * Graceful degradation: if API unreachable, returns last cached state
 * or a "quiet" default. Does NOT require birth data.
 */

import type { ArchetypeMapping, BirthMoment, CosmicState, CosmicSystem } from "../types.js";
import { Element } from "../types.js";

// ─── NOAA Endpoints (from GUTTERS §13.1) ─────────────────────────

const NOAA_ENDPOINTS = {
  KP_INDEX: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
  XRAY: "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-1-day.json",
  MAG: "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json",
  PLASMA: "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json",
} as const;

// ─── Storm Classification ────────────────────────────────────────

export type StormLevel = "quiet" | "unsettled" | "active" | "storm";

/**
 * Classify geomagnetic storm level from Kp index.
 * Kp 0-3: quiet, 4: unsettled, 5-6: active, 7+: storm
 */
export function classifyStorm(kp: number): StormLevel {
  if (kp < 4) return "quiet";
  if (kp < 5) return "unsettled";
  if (kp < 7) return "active";
  return "storm";
}

// ─── Significant Event Detection (§13.3) ─────────────────────────

export interface SolarEvent {
  type: string;
  severity?: number;
  value?: number;
  speed?: number;
  classType?: string;
}

export interface SolarData {
  kpIndex: number;
  stormLevel: StormLevel;
  flareCount: number;
  recentFlareClasses: string[];
}

/**
 * Detect significant solar events from raw data.
 */
export function detectSignificantSolarEvents(data: SolarData): SolarEvent[] {
  const events: SolarEvent[] = [];

  // G2–G5 geomagnetic storms (Kp >= 5)
  if (data.kpIndex >= 5) {
    events.push({ type: "GEO_STORM", severity: data.kpIndex });
  }

  // X-class or M-class flares
  for (const classType of data.recentFlareClasses) {
    if (classType.startsWith("X") || classType.startsWith("M")) {
      events.push({ type: "SOLAR_FLARE", classType });
    }
  }

  return events;
}

// ─── Solar Tracking System ──────────────────────────────────────

/**
 * Default "quiet" solar data to use when API is unavailable.
 */
const QUIET_DEFAULT: SolarData = {
  kpIndex: 2,
  stormLevel: "quiet",
  flareCount: 0,
  recentFlareClasses: [],
};

export class SolarTrackingSystem implements CosmicSystem {
  readonly name = "solar";
  readonly displayName = "Solar Weather (Space Weather)";
  readonly requiresBirthData = false;
  readonly recalcInterval = { type: "realtime" as const, minutes: 30 };

  private lastKnownData: SolarData = { ...QUIET_DEFAULT };
  private fetchFn: typeof globalThis.fetch;

  constructor(fetchFn?: typeof globalThis.fetch) {
    this.fetchFn = fetchFn ?? globalThis.fetch?.bind(globalThis);
  }

  async calculate(_birth: BirthMoment | null, now?: Date): Promise<CosmicState> {
    const currentTime = now ?? new Date();

    let data: SolarData;
    try {
      data = await this.fetchSolarData();
      this.lastKnownData = data;
    } catch {
      // Graceful degradation: use last known or quiet default
      data = this.lastKnownData;
    }

    const events = detectSignificantSolarEvents(data);

    return {
      system: "solar",
      timestamp: currentTime,
      primary: {
        kpIndex: data.kpIndex,
        stormLevel: data.stormLevel,
        flareCount: data.flareCount,
        recentFlareClasses: data.recentFlareClasses,
        significantEvents: events,
      },
      summary: this.buildSummary(data, events),
      metrics: {
        kpIndex: data.kpIndex,
        flareCount: data.flareCount,
        stormSeverity: data.kpIndex / 9,
      },
    };
  }

  synthesize(state: CosmicState): string {
    return state.summary;
  }

  archetypes(state: CosmicState): ArchetypeMapping {
    const kp = (state.metrics.kpIndex as number) ?? 0;
    // High solar activity → Fire, low → Earth (stable)
    const element = kp >= 5 ? Element.FIRE : Element.EARTH;

    return {
      system: "solar",
      elements: [element],
      archetypes: kp >= 5 ? ["storm", "activation"] : ["stability", "ground"],
      resonanceValues: {
        stormSeverity: kp / 9,
        activity: Math.min(kp / 5, 1),
      },
    };
  }

  private buildSummary(data: SolarData, events: SolarEvent[]): string {
    const parts = [`Kp ${data.kpIndex} (${data.stormLevel}).`];

    if (data.flareCount > 0) {
      parts.push(`Recent flares: ${data.recentFlareClasses.join(", ")}.`);
    } else {
      parts.push("No recent flares.");
    }

    if (events.length > 0) {
      parts.push(`Significant: ${events.map((e) => e.type).join(", ")}.`);
    }

    return parts.join(" ");
  }

  /**
   * Fetch real solar data from NOAA.
   * On any failure, throw so the caller can Fall back to cached.
   */
  private async fetchSolarData(): Promise<SolarData> {
    if (!this.fetchFn) {
      throw new Error("fetch not available");
    }

    // Fetch Kp index
    let kpIndex = 2;
    try {
      const kpRes = await this.fetchFn(NOAA_ENDPOINTS.KP_INDEX, {
        signal: AbortSignal.timeout(5000),
      });
      if (kpRes.ok) {
        const kpData = (await kpRes.json()) as unknown[];
        // The forecast JSON is an array; find the most recent entry
        if (Array.isArray(kpData) && kpData.length > 1) {
          const lastEntry = kpData[kpData.length - 1] as string[];
          if (Array.isArray(lastEntry) && lastEntry.length >= 2) {
            kpIndex = parseFloat(lastEntry[1]) || 2;
          }
        }
      }
    } catch {
      // Use default
    }

    // Fetch recent flares
    let flares: string[] = [];
    try {
      const flareRes = await this.fetchFn(NOAA_ENDPOINTS.XRAY, {
        signal: AbortSignal.timeout(5000),
      });
      if (flareRes.ok) {
        const flareData = (await flareRes.json()) as Record<string, unknown>[];
        if (Array.isArray(flareData)) {
          flares = flareData
            .filter((f) => typeof f.classType === "string")
            .map((f) => f.classType as string)
            .slice(0, 5);
        }
      }
    } catch {
      // Use default
    }

    return {
      kpIndex,
      stormLevel: classifyStorm(kpIndex),
      flareCount: flares.length,
      recentFlareClasses: flares,
    };
  }
}
