/**
 * Intelligence Integration — Post-Turn Evidence Testing
 *
 * After each conversation turn, the structured memory integration
 * stores classified memories. This module additionally tests the
 * exchange against active hypotheses in the Hypothesis Engine.
 *
 * Wired into the post-turn pipeline as a secondary, non-blocking step.
 * Graceful degradation: if the intelligence engine is unavailable
 * or has no active hypotheses, this is a no-op.
 */

import type { HypothesisUpdate, HypothesisType } from "./hypothesis.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { EvidenceType } from "./confidence.js";
import { getHypothesisEngine } from "./observer-runner.js";

const log = createSubsystemLogger("intelligence/integration");

// ─── Evidence Extraction ───────────────────────────────────────

/**
 * Simple keyword-based evidence extraction from a conversation exchange.
 * Returns evidence descriptors that can be tested against hypotheses.
 */
export interface ExtractedEvidence {
  type: EvidenceType;
  source: string;
  description: string;
  /** Optional: which hypothesis types this evidence applies to */
  relevantTypes?: HypothesisType[];
}

/**
 * Extract potential evidence from a user+agent exchange.
 * Looks for mood/energy mentions, confirmations, rejections, etc.
 */
export function extractEvidenceFromExchange(
  userMessage: string,
  agentResponse: string,
): ExtractedEvidence[] {
  const evidences: ExtractedEvidence[] = [];
  const lower = userMessage.toLowerCase();

  // Mood indicators
  const moodPatterns: Array<{ pattern: RegExp; description: string }> = [
    {
      pattern: /\b(?:feeling|felt|mood)\b.*\b(?:great|amazing|wonderful|fantastic)\b/i,
      description: "User reports very positive mood",
    },
    {
      pattern: /\b(?:feeling|felt|mood)\b.*\b(?:bad|terrible|awful|horrible|low|down)\b/i,
      description: "User reports negative mood",
    },
    {
      pattern: /\b(?:anxious|anxiety|worried|stress(?:ed)?|nervous)\b/i,
      description: "User reports anxiety/stress",
    },
    {
      pattern: /\b(?:energized|energetic|productive|motivated)\b/i,
      description: "User reports high energy",
    },
    {
      pattern: /\b(?:tired|exhausted|drained|fatigued|lethargic)\b/i,
      description: "User reports low energy",
    },
  ];

  for (const { pattern, description } of moodPatterns) {
    if (pattern.test(userMessage)) {
      evidences.push({
        type: EvidenceType.JOURNAL_ENTRY,
        source: "journal_analysis",
        description,
      });
    }
  }

  // User confirmation patterns
  if (
    /\b(?:you(?:'re| are) right|that(?:'s| is) true|exactly|spot on|accurate|confirmed)\b/i.test(
      lower,
    )
  ) {
    evidences.push({
      type: EvidenceType.USER_EXPLICIT_FEEDBACK,
      source: "user",
      description: "User confirmed or agreed with an observation",
    });
  }

  // User rejection patterns
  if (
    /\b(?:that(?:'s| is) (?:wrong|incorrect|not true|not right)|no(?:pe)?[,.]?\s*that|I disagree)\b/i.test(
      lower,
    )
  ) {
    evidences.push({
      type: EvidenceType.MISMATCH_EVIDENCE,
      source: "user",
      description: "User disagreed with or rejected an observation",
    });
  }

  return evidences;
}

// ─── Post-Turn Hook ────────────────────────────────────────────

/**
 * Test a conversation exchange against active hypotheses.
 * Called fire-and-forget after classifyAndStorePostTurn().
 *
 * Returns the list of hypothesis updates (for logging/debugging).
 * Never throws — all errors are caught and logged.
 */
export async function testExchangeAgainstHypotheses(
  userMessage: string,
  agentResponse: string,
): Promise<HypothesisUpdate[]> {
  try {
    const engine = getHypothesisEngine();
    const active = engine.getActive();

    // No active hypotheses — nothing to test
    if (active.length === 0) return [];

    const evidences = extractEvidenceFromExchange(userMessage, agentResponse);
    if (evidences.length === 0) return [];

    const allUpdates: HypothesisUpdate[] = [];

    for (const evidence of evidences) {
      try {
        const updates = engine.testEvidence(
          evidence.type,
          evidence.source,
          evidence.description,
          // Match all active hypotheses for now.
          // A more sophisticated matcher could filter by relevantTypes.
          () => true,
        );
        allUpdates.push(...updates);
      } catch (err) {
        log.error(`Evidence testing error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (allUpdates.length > 0) {
      log.debug(
        `Post-turn intelligence: ${allUpdates.length} hypothesis updates from ${evidences.length} evidence pieces`,
      );
    }

    return allUpdates;
  } catch (err) {
    log.error(`Post-turn intelligence error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
