/**
 * Observer Cron Runner
 *
 * Designed to be triggered by the cron system (or called directly).
 * Runs the Observer over episodic memory, feeds patterns to the
 * Hypothesis Engine, and stores results.
 *
 * Schedule: every 6 hours (configurable).
 *
 * Flow:
 * 1. Load recent episodic entries (with cosmic snapshots)
 * 2. Run Observer.observe() to detect patterns
 * 3. Feed patterns to HypothesisEngine.generateFromPatterns()
 * 4. Refresh stale status on all hypotheses
 * 5. Return summary for logging
 */

import type { Hypothesis } from "../intelligence/hypothesis.js";
import type { ObservableEntry, ObservationResult, Pattern } from "../intelligence/observer.js";
import { HypothesisEngine } from "../intelligence/hypothesis.js";
import { Observer } from "../intelligence/observer.js";

// ─── Runner Result ─────────────────────────────────────────────

export interface ObserverRunResult {
  timestamp: Date;
  entriesAnalyzed: number;
  daysCovered: number;
  patternsDetected: number;
  hypothesesGenerated: number;
  activeHypotheses: number;
  confirmedHypotheses: number;
  errors: string[];
}

// ─── Singleton instances ───────────────────────────────────────

let _observer: Observer | null = null;
let _hypothesisEngine: HypothesisEngine | null = null;

export function getObserver(): Observer {
  if (!_observer) _observer = new Observer();
  return _observer;
}

export function getHypothesisEngine(): HypothesisEngine {
  if (!_hypothesisEngine) _hypothesisEngine = new HypothesisEngine();
  return _hypothesisEngine;
}

/** For testing: reset singletons */
export function resetIntelligenceSingletons(): void {
  _observer = null;
  _hypothesisEngine = null;
}

// ─── Entry Loader Interface ────────────────────────────────────

/**
 * Interface for loading episodic entries for the Observer.
 * In production this reads from Supabase. In tests it's mocked.
 */
export interface EntryLoader {
  loadRecentEntries(days: number): Promise<ObservableEntry[]>;
}

// ─── Runner ────────────────────────────────────────────────────

/**
 * Run a full observer cycle.
 *
 * @param loader - Provides episodic entries (injectable for testing)
 * @param lookbackDays - How many days of history to analyze (default: 90)
 */
export async function runObserverCycle(
  loader: EntryLoader,
  lookbackDays = 90,
): Promise<ObserverRunResult> {
  const now = new Date();
  const errors: string[] = [];
  const observer = getObserver();
  const engine = getHypothesisEngine();

  // 1. Load entries
  let entries: ObservableEntry[];
  try {
    entries = await loader.loadRecentEntries(lookbackDays);
  } catch (err) {
    return {
      timestamp: now,
      entriesAnalyzed: 0,
      daysCovered: 0,
      patternsDetected: 0,
      hypothesesGenerated: 0,
      activeHypotheses: engine.getActive().length,
      confirmedHypotheses: engine.getConfirmed().length,
      errors: [`Failed to load entries: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // 2. Run observation
  let observation: ObservationResult;
  try {
    observation = observer.observe(entries);
    errors.push(...observation.skippedReasons);
  } catch (err) {
    return {
      timestamp: now,
      entriesAnalyzed: entries.length,
      daysCovered: 0,
      patternsDetected: 0,
      hypothesesGenerated: 0,
      activeHypotheses: engine.getActive().length,
      confirmedHypotheses: engine.getConfirmed().length,
      errors: [`Observer error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // 3. Generate hypotheses from patterns
  let generated: Hypothesis[] = [];
  try {
    generated = engine.generateFromPatterns(observation.patterns);
  } catch (err) {
    errors.push(`Hypothesis generation error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Refresh stale status
  try {
    engine.refreshStaleStatus();
  } catch (err) {
    errors.push(`Stale refresh error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    timestamp: now,
    entriesAnalyzed: observation.entriesAnalyzed,
    daysCovered: observation.daysCovered,
    patternsDetected: observation.patterns.length,
    hypothesesGenerated: generated.length,
    activeHypotheses: engine.getActive().length,
    confirmedHypotheses: engine.getConfirmed().length,
    errors,
  };
}
