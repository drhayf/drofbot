/**
 * Journal — Dashboard Type Definitions
 *
 * Derived from brain/memory types, adapted for the dashboard
 * API response contract.
 */

/** Transit data for journal cosmic context */
export interface JournalTransitData {
  planets?: string;
  aspect?: string;
  orb?: number;
}

/** Cosmic weather snapshot recorded alongside a journal entry. */
export interface JournalCosmicContext {
  card?: string;
  moonPhase?: string;
  moonIllumination?: number;
  kpIndex?: number;
  gate?: string;
  transits?: JournalTransitData[];
}

export interface JournalEntry {
  id: string;
  content: string;
  mood?: string;
  tags: string[];
  cosmicContext?: JournalCosmicContext;
  /** Hypothesis IDs matched at creation time (best-effort). */
  matchedHypotheses?: string[];
  createdAt: string;
}
