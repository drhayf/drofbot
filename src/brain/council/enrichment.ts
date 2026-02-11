/**
 * Cosmic Enrichment — Memory Timestamp Injection
 *
 * Every memory stored in any bank gets enriched with the current
 * cosmic context. This creates the data layer needed for the
 * Observer to detect cyclical patterns, cosmic correlations,
 * and gate transit alignments.
 *
 * The enrichment is stored as a compact snapshot in each bank's
 * JSONB metadata column:
 *   - Episodic: `context.cosmic`
 *   - Relational: `metadata.cosmic`
 *   - Semantic: `metadata.cosmic`
 *   - Procedural: `metadata.cosmic`
 *
 * No schema migration is needed — the existing JSONB columns
 * hold arbitrary keys.
 */

import type { CosmicState, CosmicTimestamp, BirthMoment } from "./types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("council/enrichment");

// ---------------------------------------------------------------------------
// Compact Snapshot — Only the bits the Observer needs
// ---------------------------------------------------------------------------

/**
 * A compact representation of cosmic state for storage in JSONB.
 * Keeps storage costs low while preserving queryable data.
 */
export interface CosmicSnapshot {
  /** ISO 8601 timestamp */
  ts: string;
  /** Cardology: current period card, planet, period day */
  card?: { planet: string; card: string; day: number; suit: string | null };
  /** I-Ching: sun gate, line */
  gate?: { sun: number; line: number; earth: number };
  /** Lunar: phase name, illumination (0-1) */
  moon?: { phase: string; illum: number };
  /** Solar: Kp index, storm level */
  solar?: { kp: number; storm: string };
  /** Human Design: type, authority, active transit gates */
  hd?: { type: string; authority: string };
  /** Transit: count of active aspects, tightest aspect name */
  transits?: { count: number; tightest?: string };
}

/**
 * Create a compact snapshot from a full CosmicTimestamp.
 * Only extracts the fields needed for Observer pattern detection.
 */
export function createCosmicSnapshot(timestamp: CosmicTimestamp): CosmicSnapshot {
  const snap: CosmicSnapshot = {
    ts: timestamp.datetime.toISOString(),
  };

  const cardology = timestamp.systems["cardology"];
  if (cardology?.primary) {
    snap.card = {
      planet: String(cardology.primary.currentPlanet ?? ""),
      card: String(cardology.primary.currentCard ?? ""),
      day: Number(cardology.primary.periodDay ?? 0),
      suit:
        cardology.primary.birthCardSuit != null ? String(cardology.primary.birthCardSuit) : null,
    };
  }

  const iching = timestamp.systems["iching"];
  if (iching?.metrics) {
    snap.gate = {
      sun: Number(iching.metrics.sunGate ?? 0),
      line: Number(iching.metrics.sunLine ?? 0),
      earth: Number(iching.metrics.earthGate ?? 0),
    };
  }

  const lunar = timestamp.systems["lunar"];
  if (lunar?.primary) {
    snap.moon = {
      phase: String(lunar.primary.phaseName ?? ""),
      illum: Number(lunar.primary.illumination ?? 0),
    };
  }

  const solar = timestamp.systems["solar"];
  if (solar?.primary) {
    snap.solar = {
      kp: Number(solar.primary.kpIndex ?? 0),
      storm: String(solar.primary.stormLevel ?? "unknown"),
    };
  }

  const hd = timestamp.systems["human-design"];
  if (hd?.primary) {
    snap.hd = {
      type: String(hd.primary.type ?? ""),
      authority: String(hd.primary.authority ?? ""),
    };
  }

  const transits = timestamp.systems["transits"];
  if (transits?.metrics) {
    snap.transits = {
      count: Number(transits.metrics.skyAspectCount ?? transits.metrics.natalAspectCount ?? 0),
    };
    if (transits.primary?.tightestAspect) {
      snap.transits.tightest = String(transits.primary.tightestAspect);
    }
  }

  return snap;
}

// ---------------------------------------------------------------------------
// Enrichment Helper
// ---------------------------------------------------------------------------

/** Module-level state for lazy council import to avoid circular deps */
let _getCouncilFn:
  | (() => {
      getCosmicTimestamp: (birth: BirthMoment | null, now?: Date) => Promise<CosmicTimestamp>;
    })
  | null = null;
let _configFn: (() => { enabled?: boolean; operatorBirth?: unknown } | undefined) | null = null;

/**
 * Wire up the enrichment module with lazy accessors.
 * Called once during app initialization to avoid circular imports.
 */
export function initEnrichment(
  getCouncil: () => {
    getCosmicTimestamp: (birth: BirthMoment | null, now?: Date) => Promise<CosmicTimestamp>;
  },
  getConfig: () => { enabled?: boolean; operatorBirth?: unknown } | undefined,
): void {
  _getCouncilFn = getCouncil;
  _configFn = getConfig;
}

/**
 * Enrich an arbitrary metadata object with a cosmic snapshot.
 * Returns the original metadata (or `{}`) with a `.cosmic` key added.
 *
 * Fails gracefully — if the Council is disabled or throws, the
 * original metadata is returned unchanged.
 */
export async function enrichWithCosmic(
  metadata?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = metadata ?? {};

  try {
    if (!_getCouncilFn || !_configFn) return base;

    const config = _configFn();
    if (!config || config.enabled === false) return base;

    const council = _getCouncilFn();

    // Parse operator birth if available
    let birth: BirthMoment | null = null;
    if (config.operatorBirth && typeof config.operatorBirth === "object") {
      const ob = config.operatorBirth as Record<string, unknown>;
      if (ob.datetime) {
        birth = {
          datetime: new Date(String(ob.datetime)),
          latitude: Number(ob.latitude ?? 0),
          longitude: Number(ob.longitude ?? 0),
          timezone: String(ob.timezone ?? "UTC"),
        };
      }
    }

    const timestamp = await council.getCosmicTimestamp(birth);
    const snapshot = createCosmicSnapshot(timestamp);

    return { ...base, cosmic: snapshot };
  } catch (err) {
    log.debug(`Cosmic enrichment skipped: ${err instanceof Error ? err.message : String(err)}`);
    return base;
  }
}

// ---------------------------------------------------------------------------
// Cosmic Filters for Retrieval
// ---------------------------------------------------------------------------

/**
 * Filter criteria for cosmic-indexed memory retrieval.
 */
export interface CosmicFilter {
  /** Filter by Magi period card name (e.g., "5♠") */
  magiPeriodCard?: string;
  /** Filter by Magi period planet (e.g., "Mercury") */
  magiPeriodPlanet?: string;
  /** Filter by I-Ching gate number */
  gate?: number;
  /** Filter by moon phase name */
  moonPhase?: string;
  /** Filter by Kp index >= threshold */
  kpAbove?: number;
  /** Filter by storm level */
  stormLevel?: string;
}

/**
 * Test whether a cosmic snapshot matches a filter.
 * Used by retrieval when filtering memory entries by cosmic context.
 */
export function matchesCosmicFilter(
  snapshot: CosmicSnapshot | undefined,
  filter: CosmicFilter,
): boolean {
  if (!snapshot) return false;

  if (filter.magiPeriodCard && snapshot.card?.card !== filter.magiPeriodCard) return false;
  if (filter.magiPeriodPlanet && snapshot.card?.planet !== filter.magiPeriodPlanet) return false;
  if (filter.gate != null && snapshot.gate?.sun !== filter.gate) return false;
  if (filter.moonPhase && snapshot.moon?.phase !== filter.moonPhase) return false;
  if (filter.kpAbove != null && (snapshot.solar?.kp ?? 0) < filter.kpAbove) return false;
  if (filter.stormLevel && snapshot.solar?.storm !== filter.stormLevel) return false;

  return true;
}
