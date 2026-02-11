/**
 * Intelligence — Dashboard Type Definitions
 *
 * Derived from brain/intelligence/hypothesis.ts and observer.ts,
 * adapted for the dashboard API response contract.
 */

export interface Evidence {
  id: string;
  evidenceType: string;
  source: string;
  description: string;
  timestamp: string;
  baseWeight: number;
  sourceReliability: number;
  recencyMultiplier: number;
  positionFactor: number;
  effectiveWeight: number;
  /** Cosmic context at the time of evidence collection */
  cosmicContext?: {
    gate?: number;
    line?: number;
    phase?: string;
    resonance?: number;
  };
}

export interface Hypothesis {
  id: string;
  type: string;
  status: string;
  statement: string;
  category: string;
  confidence: number;
  evidenceRecords: Evidence[];
  createdAt: string;
  updatedAt: string;
  lastEvidenceAt: string;
}

export interface PatternSummary {
  id: string;
  type: string;
  statement: string;
  confidence: number;
  status: string;
  evidenceCount: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}
