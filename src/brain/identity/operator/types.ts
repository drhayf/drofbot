/**
 * Operator Identity Vault — Types
 * Phase: 6
 *
 * Types for the operator identity substrate: voice profiles,
 * reference documents, interaction preferences, and identity synthesis.
 */

// ─── Vault Categories ──────────────────────────────────────────

export type VaultCategory =
  | "voice_pattern"
  | "reference_doc"
  | "interaction_pref"
  | "synthesis"
  | "note";

export type VaultSource =
  | "conversation_analysis"
  | "uploaded_document"
  | "explicit_preference"
  | "system_observation"
  | "manual_note";

// ─── Vault Entry ───────────────────────────────────────────────

export interface VaultEntry {
  id: string;
  category: VaultCategory;
  key: string;
  content: Record<string, unknown>;
  source: VaultSource;
  confidence: number; // 0..1
  createdAt: string;
  updatedAt: string;
}

export type VaultEntryCreate = Omit<VaultEntry, "id" | "createdAt" | "updatedAt">;

// ─── Voice Profile ─────────────────────────────────────────────

export interface VoiceProfile {
  /** Words and phrases the operator uses frequently */
  vocabularyPreferences: string[];
  /** Unique expressions / slang */
  uniqueExpressions: string[];
  /** Average sentence length (words) */
  avgSentenceLength: number;
  /** Complexity: "simple" | "moderate" | "complex" */
  sentenceComplexity: "simple" | "moderate" | "complex";
  /** Formal vs casual ratio (0 = fully casual, 1 = fully formal) */
  formalityLevel: number;
  /** Emoji usage frequency: "none" | "rare" | "moderate" | "frequent" */
  emojiUsage: "none" | "rare" | "moderate" | "frequent";
  /** Humor style observations */
  humorStyle: string;
  /** Overall tone description */
  toneDescription: string;
  /** Number of conversations analyzed */
  conversationsAnalyzed: number;
  /** Last analysis timestamp */
  lastAnalyzedAt: string;
}

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  vocabularyPreferences: [],
  uniqueExpressions: [],
  avgSentenceLength: 12,
  sentenceComplexity: "moderate",
  formalityLevel: 0.3,
  emojiUsage: "rare",
  humorStyle: "unknown",
  toneDescription: "Not yet established — building from conversations.",
  conversationsAnalyzed: 0,
  lastAnalyzedAt: new Date().toISOString(),
};

// ─── Interaction Preferences ───────────────────────────────────

export interface InteractionPreferences {
  /** When operator prefers short vs long responses */
  brevitySignals: string[];
  /** Topics that generate energy */
  engagingTopics: string[];
  /** Topics that bore or disengage */
  disengagingTopics: string[];
  /** Communication style when stressed */
  stressIndicators: string[];
  /** Communication style when relaxed */
  relaxIndicators: string[];
  /** Communication style when excited */
  excitementIndicators: string[];
  /** Does the operator enjoy cosmic/metaphysical depth in responses? */
  cosmicDepthPreference: "avoids" | "light" | "moderate" | "deep";
  /** Temporal patterns: time-of-day preferences */
  activeHours: { start: number; end: number };
}

export const DEFAULT_INTERACTION_PREFS: InteractionPreferences = {
  brevitySignals: [],
  engagingTopics: [],
  disengagingTopics: [],
  stressIndicators: [],
  relaxIndicators: [],
  excitementIndicators: [],
  cosmicDepthPreference: "moderate",
  activeHours: { start: 7, end: 23 },
};

// ─── Reference Document ───────────────────────────────────────

export interface ReferenceDocument {
  id: string;
  filename: string;
  /** MIME type or general category */
  contentType: string;
  /** Size in bytes of the original content */
  sizeBytes: number;
  /** Extracted identity-relevant observations */
  observations: string[];
  /** When the document was uploaded */
  uploadedAt: string;
  /** Processed status */
  processed: boolean;
}

// ─── Identity Synthesis ────────────────────────────────────────

export interface OperatorIdentitySynthesis {
  /** How the operator communicates (for Drofbot to mirror/complement) */
  communicationStyle: string;
  /** What matters to the operator */
  coreValues: string;
  /** What the operator doesn't want */
  avoidances: string;
  /** Current energy/mood patterns from recent interactions */
  currentState: string;
  /** Full rendered text for system prompt injection */
  rendered: string;
  /** When this synthesis was generated */
  generatedAt: string;
  /** Number of data points used */
  dataPoints: number;
}

export const EMPTY_IDENTITY_SYNTHESIS: OperatorIdentitySynthesis = {
  communicationStyle: "Not yet established.",
  coreValues: "Not yet established.",
  avoidances: "Not yet established.",
  currentState: "Not yet established.",
  rendered: "",
  generatedAt: new Date().toISOString(),
  dataPoints: 0,
};
