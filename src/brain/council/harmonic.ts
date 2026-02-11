/**
 * Harmonic Synthesis Engine
 *
 * Calculates resonance between all registered systems' current states.
 * Uses the 5×5 elemental compatibility matrix from GUTTERS.
 *
 * Philosophy: Cardology = macro-coordinate (52-day terrain),
 * I-Ching = micro-coordinate (~6-day weather). Both are sovereign —
 * neither overrides the other. All systems have equal weight.
 *
 * Resonance types:
 *   HARMONIC    (≥0.8): Strong alignment between systems
 *   SUPPORTIVE  (≥0.6): Complementary energies
 *   NEUTRAL     (≥0.4): Balanced tension
 *   CHALLENGING (≥0.2): Growth opportunities
 *   DISSONANT   (<0.2): Integration required
 */

import type {
  ArchetypeMapping,
  CosmicState,
  HarmonicSynthesis,
  PairwiseResonance,
} from "./types.js";
import { Element, getResonanceType } from "./types.js";

// ─── 5×5 Elemental Compatibility Matrix (from GUTTERS) ──────────
//
// Faithfully ported from intelligence/synthesis/harmonic.py
// Each value represents compatibility between two elements (0-1).

const ELEMENTAL_MATRIX: Record<Element, Record<Element, number>> = {
  [Element.FIRE]: {
    [Element.FIRE]: 1.0,
    [Element.WATER]: 0.3,
    [Element.AIR]: 0.8,
    [Element.EARTH]: 0.5,
    [Element.ETHER]: 0.7,
  },
  [Element.WATER]: {
    [Element.FIRE]: 0.3,
    [Element.WATER]: 1.0,
    [Element.AIR]: 0.4,
    [Element.EARTH]: 0.7,
    [Element.ETHER]: 0.6,
  },
  [Element.AIR]: {
    [Element.FIRE]: 0.8,
    [Element.WATER]: 0.4,
    [Element.AIR]: 1.0,
    [Element.EARTH]: 0.2,
    [Element.ETHER]: 0.7,
  },
  [Element.EARTH]: {
    [Element.FIRE]: 0.5,
    [Element.WATER]: 0.7,
    [Element.AIR]: 0.2,
    [Element.EARTH]: 1.0,
    [Element.ETHER]: 0.5,
  },
  [Element.ETHER]: {
    [Element.FIRE]: 0.7,
    [Element.WATER]: 0.6,
    [Element.AIR]: 0.7,
    [Element.EARTH]: 0.5,
    [Element.ETHER]: 1.0,
  },
};

/**
 * Look up elemental compatibility between two elements.
 * Returns the value from the GUTTERS 5×5 matrix.
 */
export function getElementalCompatibility(a: Element, b: Element): number {
  return ELEMENTAL_MATRIX[a][b];
}

// ─── System-to-Element Mappings (from GUTTERS) ──────────────────

/** Cardology suit → element */
export const SUIT_TO_ELEMENT: Record<string, Element> = {
  "♥": Element.WATER,
  "♣": Element.FIRE,
  "♦": Element.EARTH,
  "♠": Element.AIR,
};

/** Human Design center → element */
export const CENTER_TO_ELEMENT: Record<string, Element> = {
  Head: Element.AIR,
  Ajna: Element.AIR,
  Throat: Element.ETHER,
  G: Element.ETHER,
  Heart: Element.FIRE,
  Sacral: Element.WATER,
  SolarPlexus: Element.WATER,
  Spleen: Element.EARTH,
  Root: Element.EARTH,
};

/** I-Ching trigram → element */
export const TRIGRAM_TO_ELEMENT: Record<string, Element> = {
  Heaven: Element.FIRE,
  Thunder: Element.FIRE,
  Fire: Element.FIRE,
  Earth: Element.EARTH,
  Mountain: Element.EARTH,
  Water: Element.WATER,
  Lake: Element.WATER,
  Wind: Element.AIR,
};

// ─── Synthesis Engine ────────────────────────────────────────────

/**
 * Calculate harmonic synthesis across all active systems.
 *
 * Algorithm (from GUTTERS CouncilOfSystems):
 * 1. Collect archetype mappings from each system
 * 2. Calculate pairwise elemental compatibility from the 5×5 matrix
 * 3. Overall resonance = average of all pairwise scores
 * 4. Calculate elemental balance (how much each element is represented)
 * 5. Determine dominant elements
 * 6. Generate natural language guidance
 */
export function calculateHarmonicSynthesis(
  states: Map<string, CosmicState>,
  archetypeMappings: ArchetypeMapping[],
): HarmonicSynthesis {
  // Short-circuit: no systems active
  if (archetypeMappings.length === 0) {
    return createEmptySynthesis();
  }

  // Single system: no pairwise comparisons possible
  if (archetypeMappings.length === 1) {
    return createSingleSystemSynthesis(archetypeMappings[0]);
  }

  // Calculate pairwise resonance
  const pairwise = calculatePairwiseResonance(archetypeMappings);

  // Overall resonance = average of all pairwise scores
  const overallResonance =
    pairwise.length > 0 ? pairwise.reduce((sum, p) => sum + p.score, 0) / pairwise.length : 0.5;

  // Calculate elemental balance across all systems
  const elementalBalance = calculateElementalBalance(archetypeMappings);

  // Determine dominant elements (highest balance values)
  const dominantElements = getDominantElements(elementalBalance);

  // Generate guidance text
  const guidance = generateGuidance(overallResonance, dominantElements, archetypeMappings, states);

  // Calculate confidence based on number of active systems and data quality
  // Max systems = 6 (cardology, iching, lunar, solar, transits, human-design)
  // Confidence scales with system coverage and pairwise consistency
  const confidence = calculateConfidence(archetypeMappings.length, pairwise);

  return {
    overallResonance,
    resonanceType: getResonanceType(overallResonance),
    pairwise,
    dominantElements,
    elementalBalance,
    guidance,
    confidence,
  };
}

/**
 * Calculate confidence level for the synthesis.
 * Based on:
 * - Number of active systems (more = higher confidence)
 * - Pairwise consistency (lower variance = higher confidence)
 */
function calculateConfidence(systemCount: number, pairwise: PairwiseResonance[]): number {
  // Base confidence from system coverage (6 systems max)
  const systemCoverage = Math.min(1, systemCount / 6);

  // Consistency factor: how consistent are the pairwise scores?
  // Lower variance = higher consistency = higher confidence
  let consistencyFactor = 0.5;
  if (pairwise.length > 1) {
    const scores = pairwise.map((p) => p.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    // Variance ranges from 0 (perfect consistency) to 0.25 (max variance)
    // Invert and scale to 0-1
    consistencyFactor = Math.max(0, 1 - variance * 4);
  } else if (pairwise.length === 1) {
    consistencyFactor = 0.7; // Single pair = moderate consistency
  }

  // Weighted combination: system coverage matters more
  return systemCoverage * 0.7 + consistencyFactor * 0.3;
}

/**
 * Calculate pairwise resonance between each pair of systems.
 * Uses the 5×5 ELEMENTAL_MATRIX for compatibility scores.
 *
 * For systems with multiple elements, we average the pairwise
 * element compatibilities across all element combinations.
 */
function calculatePairwiseResonance(mappings: ArchetypeMapping[]): PairwiseResonance[] {
  const pairwise: PairwiseResonance[] = [];

  for (let i = 0; i < mappings.length; i++) {
    for (let j = i + 1; j < mappings.length; j++) {
      const a = mappings[i];
      const b = mappings[j];

      // Calculate element-level compatibility
      const score = calculateElementResonance(a.elements, b.elements);

      // Find shared elements
      const sharedElements = a.elements.filter((e) => b.elements.includes(e));

      pairwise.push({
        systemA: a.system,
        systemB: b.system,
        score,
        resonanceType: getResonanceType(score),
        sharedElements,
      });
    }
  }

  return pairwise;
}

/**
 * Calculate resonance between two sets of elements.
 * Average pairwise compatibility from the 5×5 matrix.
 */
function calculateElementResonance(elementsA: Element[], elementsB: Element[]): number {
  if (elementsA.length === 0 || elementsB.length === 0) return 0.5;

  let totalScore = 0;
  let pairs = 0;

  for (const a of elementsA) {
    for (const b of elementsB) {
      totalScore += ELEMENTAL_MATRIX[a][b];
      pairs++;
    }
  }

  return pairs > 0 ? totalScore / pairs : 0.5;
}

/**
 * Calculate elemental balance — how much each element is represented
 * across all active systems.
 */
function calculateElementalBalance(mappings: ArchetypeMapping[]): Record<Element, number> {
  const counts: Record<Element, number> = {
    [Element.FIRE]: 0,
    [Element.WATER]: 0,
    [Element.AIR]: 0,
    [Element.EARTH]: 0,
    [Element.ETHER]: 0,
  };

  let total = 0;
  for (const mapping of mappings) {
    for (const element of mapping.elements) {
      counts[element]++;
      total++;
    }
  }

  // Normalize to 0-1
  if (total === 0) {
    return counts;
  }

  const balance: Record<Element, number> = { ...counts };
  for (const el of Object.values(Element)) {
    balance[el] = counts[el] / total;
  }

  return balance;
}

/**
 * Get the dominant elements (those above average representation).
 */
function getDominantElements(balance: Record<Element, number>): Element[] {
  const entries = Object.entries(balance) as [Element, number][];
  if (entries.length === 0) return [];

  const avg = entries.reduce((sum, [, v]) => sum + v, 0) / entries.length;

  return entries
    .filter(([, v]) => v > avg)
    .sort(([, a], [, b]) => b - a)
    .map(([e]) => e);
}

/**
 * Generate natural language guidance from the synthesis.
 */
function generateGuidance(
  resonance: number,
  dominantElements: Element[],
  mappings: ArchetypeMapping[],
  states: Map<string, CosmicState>,
): string {
  const resonanceType = getResonanceType(resonance);
  const elementStr =
    dominantElements.length > 0
      ? dominantElements.map((e) => e.toLowerCase()).join(", ")
      : "balanced";

  const systemSummaries: string[] = [];
  for (const [name, state] of states) {
    if (state.summary) {
      systemSummaries.push(state.summary);
    }
  }

  const archetypeStr = mappings
    .flatMap((m) => m.archetypes)
    .filter((v, i, arr) => arr.indexOf(v) === i) // unique
    .slice(0, 5)
    .join(", ");

  const resonanceDescriptions: Record<string, string> = {
    HARMONIC: "Strong alignment across systems — favorable for intentional action.",
    SUPPORTIVE: "Complementary energies at play — good conditions for growth.",
    NEUTRAL: "Balanced tension — awareness and adaptability recommended.",
    CHALLENGING: "Growth opportunities present — lean into discomfort consciously.",
    DISSONANT: "Integration required — patience and reflection serve you best.",
  };

  const parts = [
    `Council resonance: ${(resonance * 100).toFixed(0)}% ${resonanceType}.`,
    resonanceDescriptions[resonanceType] ?? "",
    dominantElements.length > 0 ? `Dominant elements: ${elementStr}.` : "",
    archetypeStr ? `Active archetypes: ${archetypeStr}.` : "",
  ].filter(Boolean);

  return parts.join(" ");
}

// ─── Empty / Single System Helpers ───────────────────────────────

function createEmptySynthesis(): HarmonicSynthesis {
  return {
    overallResonance: 0.5,
    resonanceType: getResonanceType(0.5),
    pairwise: [],
    dominantElements: [],
    elementalBalance: {
      [Element.FIRE]: 0,
      [Element.WATER]: 0,
      [Element.AIR]: 0,
      [Element.EARTH]: 0,
      [Element.ETHER]: 0,
    },
    guidance: "No active cosmic systems. Council awaiting registration.",
    confidence: 0,
  };
}

function createSingleSystemSynthesis(mapping: ArchetypeMapping): HarmonicSynthesis {
  const balance = calculateElementalBalance([mapping]);

  return {
    overallResonance: 0.5,
    resonanceType: getResonanceType(0.5),
    pairwise: [],
    dominantElements: mapping.elements.slice(0, 3),
    elementalBalance: balance,
    guidance: `Single system active (${mapping.system}). Cross-system resonance requires additional systems.`,
    confidence: 0.17, // 1/6 systems = ~17% coverage
  };
}

// ─── Exports ─────────────────────────────────────────────────────

export { ELEMENTAL_MATRIX };
