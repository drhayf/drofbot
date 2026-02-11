/**
 * Expression Engine — Types
 * Phase: 6
 *
 * Types for the spontaneous expression system: significance scoring,
 * expression composition, delivery tracking, and throttling.
 */

// ─── Expression Triggers ───────────────────────────────────────

export type ExpressionTriggerKind =
  | "cosmic_shift"
  | "pattern_detection"
  | "hypothesis_update"
  | "operator_echo"
  | "agent_state"
  | "curiosity_thread"
  | "serendipity";

export interface ExpressionTrigger {
  kind: ExpressionTriggerKind;
  /** Human-readable description of what triggered this */
  description: string;
  /** Source system or data */
  source: string;
  /** Raw data payload (from the triggering system) */
  data?: Record<string, unknown>;
}

// ─── Significance Scoring ──────────────────────────────────────

export interface SignificanceFactors {
  /** How novel is this observation? (0-1, 0 = recently said something similar) */
  novelty: number;
  /** How relevant to the operator's current patterns? (0-1) */
  relevance: number;
  /** How rare/notable is the underlying event? (0-1) */
  cosmicWeight: number;
  /** How many systems/patterns converge? (0-1) */
  convergence: number;
  /** Is this time-sensitive? (0-1) */
  timeSensitivity: number;
  /** Is the operator likely receptive right now? (0-1) */
  operatorReceptivity: number;
}

export interface ScoredExpression {
  triggers: ExpressionTrigger[];
  factors: SignificanceFactors;
  score: number;
  /** Brief description of the potential expression topic */
  topic: string;
}

/** Minimum score to compose and deliver an expression */
export const SIGNIFICANCE_THRESHOLD = 0.7;

// ─── Composed Expression ───────────────────────────────────────

export interface ComposedExpression {
  content: string;
  triggers: ExpressionTrigger[];
  significanceScore: number;
  topic: string;
  composedAt: string;
}

// ─── Delivered Expression ──────────────────────────────────────

export type ExpressionEngagement = "replied" | "reacted" | "ignored" | null;

export interface DeliveredExpression {
  id: string;
  content: string;
  significanceScore: number;
  triggers: ExpressionTrigger[];
  deliveredAt: string;
  channel: string;
  engagement: ExpressionEngagement;
}

// ─── Throttle Config ───────────────────────────────────────────

export interface ThrottleConfig {
  /** Maximum spontaneous messages per day */
  maxPerDay: number;
  /** Minimum milliseconds between spontaneous messages */
  cooldownMs: number;
  /** Quiet hours: no messages during this window (hour of day, 0-23) */
  quietHoursStart: number;
  quietHoursEnd: number;
  /** Don't touch the same topic within this window (ms) */
  topicCooldownMs: number;
}

export const DEFAULT_THROTTLE_CONFIG: ThrottleConfig = {
  maxPerDay: 3,
  cooldownMs: 3 * 60 * 60 * 1000, // 3 hours
  quietHoursStart: 23,
  quietHoursEnd: 7,
  topicCooldownMs: 48 * 60 * 60 * 1000, // 48 hours
};

// ─── Expression Engine Dependencies ────────────────────────────

export interface ExpressionDeps {
  /** Get current cosmic states from Council */
  getCosmicStates: () => Promise<Map<string, { summary: string; data?: Record<string, unknown> }>>;
  /** Get active hypotheses from Intelligence */
  getActiveHypotheses: () => Array<{
    description: string;
    confidence: number;
    category: string;
    status: string;
  }>;
  /** Get confirmed hypotheses */
  getConfirmedHypotheses: () => Array<{
    description: string;
    confidence: number;
    category: string;
  }>;
  /** Get recent observer insights */
  getRecentInsight: () => string | null;
  /** Get the current operator identity synthesis (rendered text) */
  getOperatorSynthesis: () => Promise<string>;
  /** Get the operator voice profile */
  getVoiceProfile: () => Promise<import("../identity/operator/types.js").VoiceProfile>;
  /** Get the operator interaction preferences */
  getInteractionPreferences: () => Promise<
    import("../identity/operator/types.js").InteractionPreferences
  >;
  /** Deliver a message to the operator */
  deliver: (message: string, channel: string) => Promise<boolean>;
  /** Get recent expression history (for deduplication/throttle) */
  getRecentExpressions: (withinMs: number) => Promise<DeliveredExpression[]>;
  /** Store a delivered expression */
  storeExpression: (expr: DeliveredExpression) => Promise<void>;
  /** Current time (injectable for testing) */
  now?: () => Date;
}
