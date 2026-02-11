/**
 * Cosmic Weather — Dashboard Type Definitions
 *
 * These types define the API response contract between the backend
 * cosmic routes and the dashboard frontend. They are the single source
 * of truth for cosmic data shapes in the dashboard.
 *
 * Derived from brain/council/types.ts but adapted for JSON serialization
 * (Dates become ISO strings, Maps become Records, etc.).
 */

// ─── Individual System Responses ─────────────────────────────────

export interface CardWeather {
  timestamp: string;
  name?: string;
  rank?: number;
  rankName?: string;
  suit?: string;
  currentPlanet?: string;
  currentDay?: number;
  totalDays?: number;
  daysRemaining?: number;
  karmaDebt?: { card: string; name: string };
  karmaGift?: { card: string; name: string };
  summary: string;
}

export interface GateWeather {
  timestamp: string;
  number?: number;
  line?: number;
  name?: string;
  geneKeys?: { shadow?: string; gift?: string; siddhi?: string };
  profile?: string;
  metrics: Record<string, number>;
  summary: string;
}

export interface SolarWeather {
  timestamp: string;
  kpIndex?: number;
  solarWind?: string;
  geomagneticConditions?: string;
  metrics: Record<string, number>;
  summary: string;
}

export interface LunarWeather {
  timestamp: string;
  phase?: string;
  illumination?: number;
  daysToNextPhase?: number;
  isVoidOfCourse?: boolean;
  zodiacSign?: string;
  metrics: Record<string, number>;
  summary: string;
}

export interface TransitData {
  planet?: string;
  aspect?: string;
  description?: string;
}

export interface TransitsWeather {
  timestamp: string;
  active?: TransitData[];
  retrogrades?: string[];
  metrics: Record<string, number>;
  summary: string;
}

// ─── Synthesis / Harmonic ────────────────────────────────────────

export interface CosmicSynthesis {
  overallResonance: number;
  resonanceType: string;
  narrative: string;
  elementalBalance?: Record<string, number>;
  /** Confidence level based on number of active systems and data quality (0-1) */
  confidence: number;
}

// ─── Composite Weather Object (Store Shape) ──────────────────────

export interface CosmicWeather {
  card: CardWeather | null;
  gate: GateWeather | null;
  solar: SolarWeather | null;
  lunar: LunarWeather | null;
  transits: TransitsWeather | null;
  synthesis: CosmicSynthesis | null;
}

// ─── API Response Shapes ─────────────────────────────────────────

export interface CosmicCurrentResponse {
  timestamp: string;
  systems: Record<string, unknown>;
  harmony: {
    overallResonance: number;
    resonanceType: string;
    guidance: string;
    dominantElements?: string[];
    elementalBalance?: Record<string, number>;
    pairwise?: unknown[];
    confidence?: number;
  } | null;
}

export interface CosmicSynthesisResponse {
  synthesis: {
    rendered: string;
    cosmicWeather: string;
    harmony: string;
    generatedAt: string;
  } | null;
}
