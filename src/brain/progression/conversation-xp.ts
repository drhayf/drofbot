/**
 * Conversation XP Calculator
 * Phase: 7k
 *
 * Calculates XP earned from a conversation based on depth of
 * engagement with the system's intelligence layer — NOT message length.
 *
 * Tiers:
 *   1. Presence (1-5 XP)      — any interaction at all
 *   2. Substance (5-15 XP)    — memory was stored (classifier decided it mattered)
 *   3. Depth (10-25 XP each)  — higher-order brain functions activated (stackable)
 *   4. Milestones (50-100 XP) — one-time achievements
 */

// ─── Types ─────────────────────────────────────────────────────

export interface ConversationXPContext {
  userMessage: string;
  assistantResponse: string;
  /** Which memory banks were written to (from ClassificationResult.banks) */
  memoriesStored: { bank: string }[];
  /** Whether testExchangeAgainstHypotheses actually updated any hypotheses */
  hypothesisUpdated: boolean;
  /** Tool names used substantively during the exchange */
  toolsUsed: string[];
  /** Lifetime conversation count for the operator (for milestone tracking) */
  conversationCount: number;
}

export interface XPBreakdown {
  source: string;
  xp: number;
}

export interface ConversationXPResult {
  totalXP: number;
  breakdown: XPBreakdown[];
  milestones: string[];
}

// ─── Constants ─────────────────────────────────────────────────

/** Presence tier: base XP for simply interacting */
const PRESENCE_BASE = 2;
const PRESENCE_MAX = 5;

/** Substance tier: bonus for memories being stored */
const SUBSTANCE_EPISODIC_XP = 5;
const SUBSTANCE_OTHER_BANK_XP = 10;

/** Depth tier: bonus for higher-order brain function activations */
const DEPTH_SEMANTIC_XP = 10;
const DEPTH_RELATIONAL_XP = 10;
const DEPTH_PROCEDURAL_XP = 10;
const DEPTH_HYPOTHESIS_UPDATED_XP = 15;
const DEPTH_PROFILE_XP = 15;
const DEPTH_COSMIC_XP = 5;

/** Milestone conversation counts and their XP rewards */
const CONVERSATION_MILESTONES: ReadonlyMap<number, number> = new Map([
  [1, 50], // First conversation ever
  [10, 25],
  [50, 50],
  [100, 100],
  [250, 50],
  [500, 100],
  [1000, 200],
]);

/** Cosmic tool name patterns */
const COSMIC_TOOL_PATTERNS = [
  "cosmic",
  "cardology",
  "iching",
  "lunar",
  "transit",
  "solar",
] as const;

/** Profile tool name patterns */
const PROFILE_TOOL_PATTERNS = ["profile_explore", "profile_save"] as const;

// ─── Calculator ────────────────────────────────────────────────

/**
 * Calculate conversation XP based on depth of brain engagement.
 *
 * The tiers stack — a single rich conversation can earn:
 * Presence + Substance + multiple Depth bonuses + Milestones.
 */
export function calculateConversationXP(context: ConversationXPContext): ConversationXPResult {
  const breakdown: XPBreakdown[] = [];
  const milestones: string[] = [];

  // ── Tier 1: Presence ──
  // Any interaction at all earns base XP. Scale slightly by substance.
  const words = context.userMessage.trim().split(/\s+/).filter((w) => w.length > 0).length;
  const presenceXP = Math.min(PRESENCE_MAX, PRESENCE_BASE + Math.floor(words / 20));
  breakdown.push({ source: "presence", xp: presenceXP });

  // ── Tier 2: Substance ──
  // Awarded when the classifier stored something to any memory bank.
  if (context.memoriesStored.length > 0) {
    const hasEpisodic = context.memoriesStored.some((m) => m.bank === "episodic");
    const hasOtherBanks = context.memoriesStored.some((m) => m.bank !== "episodic");

    if (hasEpisodic) {
      breakdown.push({ source: "substance:episodic", xp: SUBSTANCE_EPISODIC_XP });
    }
    if (hasOtherBanks) {
      breakdown.push({ source: "substance:knowledge", xp: SUBSTANCE_OTHER_BANK_XP });
    }
  }

  // ── Tier 3: Depth (stackable) ──
  // Higher-order brain functions that activated during the exchange.

  const storedBanks = new Set(context.memoriesStored.map((m) => m.bank));

  // Semantic memory: a fact was learned about the operator
  if (storedBanks.has("semantic")) {
    breakdown.push({ source: "depth:semantic", xp: DEPTH_SEMANTIC_XP });
  }

  // Relational memory: a relationship/connection was stored
  if (storedBanks.has("relational")) {
    breakdown.push({ source: "depth:relational", xp: DEPTH_RELATIONAL_XP });
  }

  // Procedural memory: a workflow/procedure was learned
  if (storedBanks.has("procedural")) {
    breakdown.push({ source: "depth:procedural", xp: DEPTH_PROCEDURAL_XP });
  }

  // Hypothesis updated: intelligence layer refined its understanding
  if (context.hypothesisUpdated) {
    breakdown.push({ source: "depth:hypothesis", xp: DEPTH_HYPOTHESIS_UPDATED_XP });
  }

  // Profile tools used: operator explored or saved birth data / profiles
  const usedProfile = context.toolsUsed.some((tool) =>
    PROFILE_TOOL_PATTERNS.some((pat) => tool.toLowerCase().includes(pat)),
  );
  if (usedProfile) {
    breakdown.push({ source: "depth:profile", xp: DEPTH_PROFILE_XP });
  }

  // Cosmic tools used substantively
  const usedCosmic = context.toolsUsed.some((tool) =>
    COSMIC_TOOL_PATTERNS.some((pat) => tool.toLowerCase().includes(pat)),
  );
  if (usedCosmic) {
    breakdown.push({ source: "depth:cosmic", xp: DEPTH_COSMIC_XP });
  }

  // ── Tier 4: Milestones (one-time) ──
  const milestoneXP = CONVERSATION_MILESTONES.get(context.conversationCount);
  if (milestoneXP) {
    const label = `milestone:conversation_${context.conversationCount}`;
    breakdown.push({ source: label, xp: milestoneXP });
    milestones.push(
      context.conversationCount === 1
        ? "First conversation ever!"
        : `${context.conversationCount} conversations reached!`,
    );
  }

  const totalXP = breakdown.reduce((sum, b) => sum + b.xp, 0);

  return { totalXP, breakdown, milestones };
}
