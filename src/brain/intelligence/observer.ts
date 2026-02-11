/**
 * Observer — Pattern Detection Engine
 *
 * Ported from GUTTERS `intelligence/observer/observer.py` (§4)
 * and `intelligence/observer/cyclical.py` (§5).
 *
 * Runs periodically (cron, every 6 hours) to detect patterns in
 * episodic memory by analyzing cosmic-enriched entries:
 *
 * 1. CYCLICAL PATTERNS: Magi-period correlations
 * 2. COSMIC CORRELATIONS: Cosmic metric correlations (Kp, etc.)
 * 3. TEMPORAL PATTERNS: Time-of-day / day-of-week
 * 4. GATE PATTERNS: I-Ching gate transit correlations
 *
 * All patterns are stored in semantic memory with confidence scores.
 * Patterns feed the Hypothesis Engine.
 *
 * Minimum data requirements (GUTTERS §4.1):
 *   solar:   30 days, 10 entries
 *   lunar:   60 days, 15 entries
 *   transit: 90 days, 20 entries
 *   time:    60 days, 30 entries
 */

import type { CosmicSnapshot } from "../council/enrichment.js";
import { EvidenceType } from "./confidence.js";

// ─── Configuration Constants (GUTTERS §4.1, §5.1) ──────────────

export const MIN_DATA_REQUIREMENTS = {
  solar: { days: 30, entries: 10 },
  lunar: { days: 60, entries: 15 },
  transit: { days: 90, entries: 20 },
  time: { days: 60, entries: 30 },
} as const;

export const CYCLICAL_CONFIG = {
  MIN_PERIODS_FOR_PATTERN: 3,
  MIN_JOURNAL_ENTRIES_PER_PERIOD: 5,
  SIGNIFICANCE_THRESHOLD: 0.05,
  CORRELATION_THRESHOLD: 0.7,
  MIN_FOLD_INCREASE: 1.5,
  MIN_MOOD_DIFFERENCE: 1.5, // on 1-10 scale
  PERIOD_DAYS: 52,
  PERIODS_PER_YEAR: 7,
} as const;

// ─── Planet Themes for Keyword Detection (GUTTERS §5.5) ────────

export const PLANET_THEMES: Record<string, string[]> = {
  Mercury: [
    "communication",
    "thinking",
    "learning",
    "writing",
    "travel",
    "messaging",
    "ideas",
    "mental",
    "quick",
    "nervous",
  ],
  Venus: [
    "love",
    "beauty",
    "art",
    "relationships",
    "harmony",
    "pleasure",
    "values",
    "money",
    "comfort",
    "attraction",
  ],
  Mars: [
    "energy",
    "action",
    "conflict",
    "anger",
    "passion",
    "drive",
    "physical",
    "competition",
    "courage",
    "force",
  ],
  Jupiter: [
    "expansion",
    "luck",
    "growth",
    "abundance",
    "wisdom",
    "optimism",
    "travel",
    "philosophy",
    "blessing",
    "opportunity",
  ],
  Saturn: [
    "discipline",
    "restriction",
    "lesson",
    "karma",
    "responsibility",
    "structure",
    "limitation",
    "challenge",
    "fear",
    "authority",
  ],
  Uranus: [
    "change",
    "freedom",
    "surprise",
    "innovation",
    "rebellion",
    "awakening",
    "technology",
    "independence",
    "unusual",
    "sudden",
  ],
  Neptune: [
    "dream",
    "intuition",
    "illusion",
    "spirituality",
    "imagination",
    "confusion",
    "compassion",
    "art",
    "escape",
    "vision",
  ],
};

// ─── Pattern Types (GUTTERS §5.2) ──────────────────────────────

export enum PatternType {
  // Magi period correlations
  PERIOD_SPECIFIC_SYMPTOM = "PERIOD_SPECIFIC_SYMPTOM",
  INTER_PERIOD_MOOD_VARIANCE = "INTER_PERIOD_MOOD_VARIANCE",
  INTER_PERIOD_ENERGY_VARIANCE = "INTER_PERIOD_ENERGY_VARIANCE",
  THEME_ALIGNMENT = "THEME_ALIGNMENT",
  CROSS_YEAR_EVOLUTION = "CROSS_YEAR_EVOLUTION",

  // Cosmic correlations
  SOLAR_CORRELATION = "SOLAR_CORRELATION",
  LUNAR_CORRELATION = "LUNAR_CORRELATION",

  // Temporal patterns
  TIME_OF_DAY = "TIME_OF_DAY",
  DAY_OF_WEEK = "DAY_OF_WEEK",

  // I-Ching gate patterns
  GATE_SPECIFIC_SYMPTOM = "GATE_SPECIFIC_SYMPTOM",
  INTER_GATE_MOOD_VARIANCE = "INTER_GATE_MOOD_VARIANCE",
  GATE_LINE_CORRELATION = "GATE_LINE_CORRELATION",
}

// ─── Pattern Output ────────────────────────────────────────────

export interface Pattern {
  type: PatternType;
  confidence: number;
  description: string;
  pValue: number;
  effectSize: number;
  /** Evidence type to use when converting to a hypothesis */
  evidenceType: EvidenceType;
  /** Additional context */
  planet?: string;
  sunGate?: number;
  gateLine?: number;
  moonPhase?: string;
  hourOfDay?: number;
  dayOfWeek?: number;
}

export interface ObservationResult {
  timestamp: Date;
  patterns: Pattern[];
  entriesAnalyzed: number;
  daysCovered: number;
  skippedReasons: string[];
}

// ─── Episodic Entry Shape (for Observer consumption) ────────────

/**
 * A simplified view of an episodic memory entry as needed by the
 * Observer. The real bank stores more fields; the Observer only
 * reads what it needs for pattern detection.
 */
export interface ObservableEntry {
  id: string;
  content: string;
  createdAt: Date;
  /** Mood score 1-10 if present */
  mood?: number;
  /** Energy score 1-10 if present */
  energy?: number;
  /** Symptom tags */
  symptoms?: string[];
  /** Cosmic snapshot from enrichment */
  cosmic?: CosmicSnapshot;
}

// ─── Statistics Helpers ────────────────────────────────────────

/**
 * Pearson correlation coefficient.
 * Returns NaN if either array has zero variance.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return NaN;

  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  // Zero-variance guard (GUTTERS §4.2)
  if (sumX2 === 0 || sumY2 === 0) return NaN;
  return sumXY / Math.sqrt(sumX2 * sumY2);
}

/**
 * Approximate two-tailed p-value for Pearson r with n observations.
 * Uses the t-distribution approximation: t = r√(n-2) / √(1-r²)
 * Then approximates p via the incomplete beta function shortcut.
 */
export function pearsonPValue(r: number, n: number): number {
  if (Number.isNaN(r) || n < 3) return 1;
  const absR = Math.abs(r);
  if (absR >= 1) return 0;

  const df = n - 2;
  const t = absR * Math.sqrt(df / (1 - absR * absR));

  // Approximation: p ≈ 2 × P(T > t) using a simple normal tail approx
  // For df > 30 this is close; for smaller df this is conservative.
  // Good enough for the Observer's significance filtering.
  const z = (t * (1 - 1 / (4 * df))) / Math.sqrt(1 + (t * t) / (2 * df));
  const p = 2 * (1 - normalCDF(z));
  return Math.max(0, Math.min(1, p));
}

/** Standard normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(z: number): number {
  if (z < -6) return 0;
  if (z > 6) return 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z);
  const t = 1.0 / (1.0 + p * z);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-z * z) / 2);
  return 0.5 * (1 + sign * y);
}

/**
 * Simple mean of a number array.
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Standard deviation.
 */
export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * One-way ANOVA F-test p-value approximation.
 * groups: array of numeric arrays (one per group).
 * Returns p (approximate via F → chi-sq → normal).
 */
export function oneWayAnovaP(groups: number[][]): number {
  const validGroups = groups.filter((g) => g.length > 0);
  if (validGroups.length < 2) return 1;

  const allValues = validGroups.flat();
  const grandMean = mean(allValues);
  const k = validGroups.length;
  const N = allValues.length;

  // Between-groups sum of squares
  let ssBetween = 0;
  for (const g of validGroups) {
    const gMean = mean(g);
    ssBetween += g.length * (gMean - grandMean) ** 2;
  }

  // Within-groups sum of squares
  let ssWithin = 0;
  for (const g of validGroups) {
    const gMean = mean(g);
    for (const v of g) {
      ssWithin += (v - gMean) ** 2;
    }
  }

  const dfBetween = k - 1;
  const dfWithin = N - k;
  if (dfWithin <= 0 || ssWithin === 0) return 1;

  const F = ssBetween / dfBetween / (ssWithin / dfWithin);

  // Approximate p from F via normal approximation for large df
  // For small samples this is conservative, which is fine
  const z = Math.sqrt(2 * F) - Math.sqrt(2 * dfBetween - 1);
  return 1 - normalCDF(z);
}

// ─── Observer Class ─────────────────────────────────────────────

export class Observer {
  /**
   * Run a full observation cycle over the provided entries.
   * In production, entries come from episodic memory bank.
   * This method is pure (no side effects) — the caller stores results.
   */
  observe(entries: ObservableEntry[]): ObservationResult {
    const now = new Date();
    const patterns: Pattern[] = [];
    const skippedReasons: string[] = [];

    if (entries.length === 0) {
      return {
        timestamp: now,
        patterns: [],
        entriesAnalyzed: 0,
        daysCovered: 0,
        skippedReasons: ["no entries"],
      };
    }

    // Calculate days covered
    const dates = entries.map((e) => e.createdAt.getTime());
    const daysCovered = (Math.max(...dates) - Math.min(...dates)) / 86_400_000;

    // Run all detection methods
    try {
      patterns.push(...this.detectCyclicalPatterns(entries));
    } catch {
      skippedReasons.push("cyclical detection error");
    }
    try {
      patterns.push(...this.detectCosmicCorrelations(entries));
    } catch {
      skippedReasons.push("cosmic correlation error");
    }
    try {
      patterns.push(...this.detectTemporalPatterns(entries));
    } catch {
      skippedReasons.push("temporal detection error");
    }
    try {
      patterns.push(...this.detectGatePatterns(entries));
    } catch {
      skippedReasons.push("gate detection error");
    }

    return {
      timestamp: now,
      patterns,
      entriesAnalyzed: entries.length,
      daysCovered,
      skippedReasons,
    };
  }

  // ─── Cyclical Patterns (GUTTERS §5.3–§5.6) ───────────────────

  /**
   * Detect patterns aligned to 52-day Magi periods.
   */
  detectCyclicalPatterns(entries: ObservableEntry[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Group entries by planet from cosmic snapshot
    const byPlanet = this.groupByPlanet(entries);
    const planets = Object.keys(byPlanet);

    if (planets.length < CYCLICAL_CONFIG.MIN_PERIODS_FOR_PATTERN) {
      return patterns;
    }

    // Inter-period mood variance (GUTTERS §5.4)
    patterns.push(...this.detectInterPeriodMoodVariance(byPlanet));

    // Theme alignment (GUTTERS §5.5)
    patterns.push(...this.detectThemeAlignment(byPlanet));

    return patterns;
  }

  /**
   * Mood variance across planetary periods.
   * Runs one-way ANOVA, looking for significant differences.
   */
  private detectInterPeriodMoodVariance(byPlanet: Record<string, ObservableEntry[]>): Pattern[] {
    const patterns: Pattern[] = [];
    const groups: number[][] = [];
    const planetNames: string[] = [];

    for (const [planet, entries] of Object.entries(byPlanet)) {
      const moods = entries.filter((e) => e.mood != null).map((e) => e.mood!);
      if (moods.length >= CYCLICAL_CONFIG.MIN_JOURNAL_ENTRIES_PER_PERIOD) {
        groups.push(moods);
        planetNames.push(planet);
      }
    }

    if (groups.length < 2) return patterns;

    const pValue = oneWayAnovaP(groups);
    if (pValue >= CYCLICAL_CONFIG.SIGNIFICANCE_THRESHOLD) return patterns;

    // Find best and worst periods
    const means = groups.map((g) => mean(g));
    const best = planetNames[means.indexOf(Math.max(...means))];
    const worst = planetNames[means.indexOf(Math.min(...means))];
    const effectSize = Math.max(...means) - Math.min(...means);

    if (effectSize < CYCLICAL_CONFIG.MIN_MOOD_DIFFERENCE) return patterns;

    patterns.push({
      type: PatternType.INTER_PERIOD_MOOD_VARIANCE,
      confidence: 1 - pValue,
      description: `Mood is highest during ${best} periods and lowest during ${worst} periods (diff: ${effectSize.toFixed(1)})`,
      pValue,
      effectSize,
      evidenceType: EvidenceType.CYCLICAL_PATTERN,
      planet: best,
    });

    return patterns;
  }

  /**
   * Theme keyword alignment with planetary archetypes.
   */
  private detectThemeAlignment(byPlanet: Record<string, ObservableEntry[]>): Pattern[] {
    const patterns: Pattern[] = [];
    const BASELINE_ALIGNMENT = 0.15;

    for (const [planet, entries] of Object.entries(byPlanet)) {
      const keywords = PLANET_THEMES[planet];
      if (!keywords || entries.length < CYCLICAL_CONFIG.MIN_JOURNAL_ENTRIES_PER_PERIOD) continue;

      const allText = entries.map((e) => e.content.toLowerCase()).join(" ");
      const words = allText.split(/\s+/);
      if (words.length === 0) continue;

      const matchCount = keywords.reduce((count, kw) => {
        return count + (allText.includes(kw) ? 1 : 0);
      }, 0);
      const alignment = matchCount / keywords.length;

      if (alignment > BASELINE_ALIGNMENT + 0.1) {
        const effectSize = alignment - BASELINE_ALIGNMENT;
        patterns.push({
          type: PatternType.THEME_ALIGNMENT,
          confidence: Math.min(alignment, 0.9),
          description: `Entries during ${planet} periods align with ${planet} themes (${(alignment * 100).toFixed(0)}% keyword match)`,
          pValue: 0.05, // approximation — theme alignment is heuristic
          effectSize,
          evidenceType: EvidenceType.THEME_ALIGNMENT,
          planet,
        });
      }
    }

    return patterns;
  }

  // ─── Cosmic Correlations (GUTTERS §4.2–§4.3) ────────────────

  /**
   * Correlate Kp index and moon phase with mood/symptoms.
   */
  detectCosmicCorrelations(entries: ObservableEntry[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Solar: correlate Kp with mood (GUTTERS §4.2)
    const solarEntries = entries.filter((e) => e.cosmic?.solar != null && e.mood != null);

    if (solarEntries.length >= MIN_DATA_REQUIREMENTS.solar.entries) {
      const kpValues = solarEntries.map((e) => e.cosmic!.solar!.kp);
      const moods = solarEntries.map((e) => e.mood!);
      const r = pearsonCorrelation(kpValues, moods);
      const p = pearsonPValue(r, solarEntries.length);

      if (!Number.isNaN(r) && Math.abs(r) >= 0.6 && p < 0.05) {
        const direction = r > 0 ? "positively" : "negatively";
        patterns.push({
          type: PatternType.SOLAR_CORRELATION,
          confidence: 1 - p,
          description: `Mood ${direction} correlates with geomagnetic activity (Kp index) r=${r.toFixed(2)}`,
          pValue: p,
          effectSize: Math.abs(r),
          evidenceType: EvidenceType.COSMIC_CORRELATION,
        });
      }
    }

    // Lunar: group mood by phase (GUTTERS §4.3)
    const lunarEntries = entries.filter((e) => e.cosmic?.moon != null && e.mood != null);

    if (lunarEntries.length >= MIN_DATA_REQUIREMENTS.lunar.entries) {
      const byPhase: Record<string, number[]> = {};
      for (const entry of lunarEntries) {
        const phase = entry.cosmic!.moon!.phase;
        if (!byPhase[phase]) byPhase[phase] = [];
        byPhase[phase].push(entry.mood!);
      }

      const groups = Object.values(byPhase).filter((g) => g.length >= 3);
      if (groups.length >= 2) {
        const pValue = oneWayAnovaP(groups);
        if (pValue < 0.05) {
          const phaseMeans: Record<string, number> = {};
          for (const [phase, moods] of Object.entries(byPhase)) {
            phaseMeans[phase] = mean(moods);
          }
          const phases = Object.keys(phaseMeans);
          const best = phases.reduce((a, b) => (phaseMeans[a] > phaseMeans[b] ? a : b));
          const effectSize =
            Math.max(...Object.values(phaseMeans)) - Math.min(...Object.values(phaseMeans));

          if (effectSize >= 1.0) {
            patterns.push({
              type: PatternType.LUNAR_CORRELATION,
              confidence: 1 - pValue,
              description: `Mood varies by moon phase; highest during ${best} (diff: ${effectSize.toFixed(1)})`,
              pValue,
              effectSize,
              evidenceType: EvidenceType.COSMIC_CORRELATION,
              moonPhase: best,
            });
          }
        }
      }
    }

    return patterns;
  }

  // ─── Temporal Patterns ──────────────────────────────────────

  /**
   * Detect time-of-day and day-of-week patterns.
   */
  detectTemporalPatterns(entries: ObservableEntry[]): Pattern[] {
    const patterns: Pattern[] = [];
    const entriesWithMood = entries.filter((e) => e.mood != null);

    if (entriesWithMood.length < MIN_DATA_REQUIREMENTS.time.entries) {
      return patterns;
    }

    // Time-of-day: group by 4-hour blocks
    const byHourBlock: Record<number, number[]> = {};
    for (const entry of entriesWithMood) {
      const block = Math.floor(entry.createdAt.getUTCHours() / 4); // 0-5
      if (!byHourBlock[block]) byHourBlock[block] = [];
      byHourBlock[block].push(entry.mood!);
    }

    const hourGroups = Object.values(byHourBlock).filter((g) => g.length >= 3);
    if (hourGroups.length >= 2) {
      const pValue = oneWayAnovaP(hourGroups);
      if (pValue < 0.05) {
        const blockMeans = Object.entries(byHourBlock).map(([block, moods]) => ({
          block: Number(block),
          mean: mean(moods),
        }));
        const best = blockMeans.reduce((a, b) => (a.mean > b.mean ? a : b));
        const hourLabels = ["12-4am", "4-8am", "8am-12pm", "12-4pm", "4-8pm", "8pm-12am"];
        const effectSize =
          Math.max(...blockMeans.map((b) => b.mean)) - Math.min(...blockMeans.map((b) => b.mean));

        if (effectSize >= 1.0) {
          patterns.push({
            type: PatternType.TIME_OF_DAY,
            confidence: 1 - pValue,
            description: `Mood peaks during ${hourLabels[best.block]} (avg: ${best.mean.toFixed(1)})`,
            pValue,
            effectSize,
            evidenceType: EvidenceType.OBSERVER_PATTERN,
            hourOfDay: best.block * 4,
          });
        }
      }
    }

    // Day-of-week
    const byDay: Record<number, number[]> = {};
    for (const entry of entriesWithMood) {
      const day = entry.createdAt.getUTCDay(); // 0=Sun, 6=Sat
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(entry.mood!);
    }

    const dayGroups = Object.values(byDay).filter((g) => g.length >= 3);
    if (dayGroups.length >= 2) {
      const pValue = oneWayAnovaP(dayGroups);
      if (pValue < 0.05) {
        const dayMeans = Object.entries(byDay).map(([day, moods]) => ({
          day: Number(day),
          mean: mean(moods),
        }));
        const best = dayMeans.reduce((a, b) => (a.mean > b.mean ? a : b));
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const effectSize =
          Math.max(...dayMeans.map((d) => d.mean)) - Math.min(...dayMeans.map((d) => d.mean));

        if (effectSize >= 1.0) {
          patterns.push({
            type: PatternType.DAY_OF_WEEK,
            confidence: 1 - pValue,
            description: `Mood peaks on ${dayNames[best.day]}s (avg: ${best.mean.toFixed(1)})`,
            pValue,
            effectSize,
            evidenceType: EvidenceType.OBSERVER_PATTERN,
            dayOfWeek: best.day,
          });
        }
      }
    }

    return patterns;
  }

  // ─── Gate Patterns (GUTTERS §5.7) ────────────────────────────

  /**
   * Detect I-Ching gate transit correlations.
   */
  detectGatePatterns(entries: ObservableEntry[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Group entries by sun gate
    const byGate: Record<number, ObservableEntry[]> = {};
    for (const entry of entries) {
      const gate = entry.cosmic?.gate?.sun;
      if (gate != null) {
        if (!byGate[gate]) byGate[gate] = [];
        byGate[gate].push(entry);
      }
    }

    const gates = Object.keys(byGate).map(Number);
    if (gates.length < 3) return patterns;

    // Mood variance across gates (similar to inter-period variance)
    const groups: number[][] = [];
    const gateNumbers: number[] = [];
    for (const gate of gates) {
      const moods = byGate[gate].filter((e) => e.mood != null).map((e) => e.mood!);
      if (moods.length >= 3) {
        groups.push(moods);
        gateNumbers.push(gate);
      }
    }

    if (groups.length >= 2) {
      const pValue = oneWayAnovaP(groups);
      if (pValue < 0.05) {
        const means = groups.map((g) => mean(g));
        const bestIdx = means.indexOf(Math.max(...means));
        const effectSize = Math.max(...means) - Math.min(...means);

        if (effectSize >= 1.5) {
          patterns.push({
            type: PatternType.INTER_GATE_MOOD_VARIANCE,
            confidence: 1 - pValue,
            description: `Mood varies by I-Ching gate transit; highest during Gate ${gateNumbers[bestIdx]} (diff: ${effectSize.toFixed(1)})`,
            pValue,
            effectSize,
            evidenceType: EvidenceType.CYCLICAL_PATTERN,
            sunGate: gateNumbers[bestIdx],
          });
        }
      }
    }

    return patterns;
  }

  // ─── Helpers ────────────────────────────────────────────────

  private groupByPlanet(entries: ObservableEntry[]): Record<string, ObservableEntry[]> {
    const groups: Record<string, ObservableEntry[]> = {};
    for (const entry of entries) {
      const planet = entry.cosmic?.card?.planet;
      if (planet) {
        if (!groups[planet]) groups[planet] = [];
        groups[planet].push(entry);
      }
    }
    return groups;
  }
}
