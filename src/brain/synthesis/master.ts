/**
 * Master Synthesis — the living profile.
 *
 * Assembled from:
 * 1. Council Core: Current cosmic state (all registered systems)
 * 2. Intelligence: Active patterns, confirmed hypotheses
 * 3. Memory: Recent episodic context, core semantic facts
 * 4. Progression: Current rank, active quests, sync rate (future)
 *
 * This is pre-computed by a cron job and cached.
 * It gets injected into the system prompt as context.
 * Budget: ~800-1200 tokens (dense, no fluff).
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import type {
  BirthMoment,
  CosmicState,
  CosmicTimestamp,
  HarmonicSynthesis,
} from "../council/types.js";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import { HypothesisStatus } from "../intelligence/hypothesis.js";

// ─── Types ─────────────────────────────────────────────────────

export interface TrafficContext {
  generated_at: string;
  window_minutes: number;
  total_queries: number;
  unique_domains: number;
  active_categories: Record<string, string[]>;
  top_domains: Array<{ domain: string; queries: number }>;
  activity_summary: string;
}

export interface MasterSynthesis {
  /** Operator's metaphysical profile (natal chart summary, HD type, birth cards) */
  profile: string;
  /** Current cosmic weather across all systems */
  cosmicWeather: string;
  /** Active patterns and hypotheses with confidence levels */
  intelligence: string;
  /** Current harmonic synthesis and resonance */
  harmony: string;
  /** Active quests and progression state */
  progression: string;
  /** Operator's recent internet activity (from VPN traffic capture) */
  operatorActivity: string;
  /** Pre-rendered full text for system prompt injection */
  rendered: string;
  /** When this synthesis was generated */
  generatedAt: Date;
}

export interface SelfModel {
  /** Drofbot's own cosmic state (from its birth moment) */
  cosmicState: Record<string, CosmicState>;
  /** Personality traits derived from operator interaction patterns */
  personalityTraits: string[];
  /** Communication style preferences (learned from operator feedback) */
  communicationStyle: string;
  /** Confirmed self-knowledge (from semantic memory, category "self") */
  selfKnowledge: string[];
  /** Current capabilities and limitations */
  capabilities: string;
  /** Relationship dynamic with operator */
  relationshipDynamic: string;
}

export interface RelationshipModel {
  /** How long the relationship has existed */
  durationDays: number;
  /** Communication frequency (messages per day average) */
  communicationFrequency: number;
  /** Dominant interaction patterns */
  interactionPatterns: string[];
  /** Trust level (derived from user confirmations vs rejections) */
  trustLevel: number;
  /** Growth areas identified together */
  sharedGrowthAreas: string[];
  /** Pre-rendered narrative summary */
  narrative: string;
}

// ─── Token Budget Constants ────────────────────────────────────

/** Target maximum characters for the rendered synthesis (~800-1200 tokens) */
const MAX_RENDERED_CHARS = 3200;
/** Maximum characters per section */
const MAX_SECTION_CHARS = 600;

// ─── Synthesis Engine ──────────────────────────────────────────

/**
 * Dependencies injected into the SynthesisEngine.
 * Production code injects the real Council/Memory/Intelligence.
 * Tests inject mocks.
 */
export interface SynthesisDeps {
  /** Get cosmic states for a birth moment */
  calculateCosmicStates: (birth: BirthMoment | null) => Promise<Map<string, CosmicState>>;
  /** Get cosmic timestamp for memory enrichment */
  getCosmicTimestamp: (birth: BirthMoment | null) => Promise<CosmicTimestamp>;
  /** Get harmonic synthesis from current cosmic states */
  calculateHarmonic: (states: Map<string, CosmicState>) => Promise<HarmonicSynthesis | null>;
  /** Get active hypotheses (FORMING + TESTING) */
  getActiveHypotheses: () => Hypothesis[];
  /** Get confirmed hypotheses */
  getConfirmedHypotheses: () => Hypothesis[];
  /** Get recent episodic memories (formatted text) */
  getRecentEpisodicContext: (limit: number) => Promise<string[]>;
  /** Get semantic facts by category */
  getSemanticByCategory: (category: string) => Promise<string[]>;
  /** Get self-knowledge from semantic memory (category "self") */
  getSelfKnowledge: () => Promise<string[]>;
}

export class SynthesisEngine {
  private deps: SynthesisDeps;
  private operatorBirth: BirthMoment | null;
  private agentBirth: BirthMoment | null;
  private cachedSynthesis: MasterSynthesis | null = null;
  private cachedSelfModel: SelfModel | null = null;

  constructor(
    deps: SynthesisDeps,
    operatorBirth: BirthMoment | null,
    agentBirth: BirthMoment | null,
  ) {
    this.deps = deps;
    this.operatorBirth = operatorBirth;
    this.agentBirth = agentBirth;
  }

  /**
   * Generate the complete Master Synthesis.
   * Assembles data from all subsystems into a token-budgeted document.
   */
  async generateMasterSynthesis(): Promise<MasterSynthesis> {
    const now = new Date();

    // 1. Cosmic weather from all council systems
    const cosmicStates = await this.deps.calculateCosmicStates(this.operatorBirth);
    const cosmicWeather = renderCosmicWeather(cosmicStates);

    // 2. Harmonic synthesis
    let harmony = "";
    const harmonicResult = await this.deps.calculateHarmonic(cosmicStates);
    if (harmonicResult) {
      harmony = renderHarmony(harmonicResult);
    }

    // 3. Profile from semantic memory
    const facts = await this.deps.getSemanticByCategory("identity");
    const preferences = await this.deps.getSemanticByCategory("preference");
    const profile = renderProfile(facts, preferences);

    // 4. Intelligence: patterns + hypotheses
    const activeHyps = this.deps.getActiveHypotheses();
    const confirmedHyps = this.deps.getConfirmedHypotheses();
    const intelligence = renderIntelligence(activeHyps, confirmedHyps);

    // 5. Progression — served separately via /api/progression; not yet rendered in synthesis
    const progression = "";

    // 6. Operator activity from VPN traffic capture
    const operatorActivity = readTrafficContext();

    // 7. Render full synthesis
    const rendered = assembleSynthesis({
      profile,
      cosmicWeather,
      intelligence,
      harmony,
      progression,
      operatorActivity,
    });

    const synthesis: MasterSynthesis = {
      profile,
      cosmicWeather,
      intelligence,
      harmony,
      progression,
      operatorActivity,
      rendered,
      generatedAt: now,
    };

    this.cachedSynthesis = synthesis;
    return synthesis;
  }

  /**
   * Generate Drofbot's self-model — how it understands itself.
   */
  async generateSelfModel(): Promise<SelfModel> {
    // Drofbot's own cosmic state
    const agentStates = await this.deps.calculateCosmicStates(this.agentBirth);
    const cosmicState: Record<string, CosmicState> = {};
    for (const [key, state] of agentStates) {
      cosmicState[key] = state;
    }

    // Self-knowledge from semantic memory
    const selfKnowledge = await this.deps.getSelfKnowledge();

    // Personality traits from confirmed hypotheses about communication
    const confirmedHyps = this.deps.getConfirmedHypotheses();
    const personalityTraits = confirmedHyps
      .filter((h) => h.category === "temporal" || h.category === "behavioral")
      .map((h) => h.statement)
      .slice(0, 5);

    // Communication style from preferences
    const commPrefs = await this.deps.getSemanticByCategory("preference");
    const communicationStyle =
      commPrefs.length > 0
        ? commPrefs.slice(0, 3).join("; ")
        : "Adaptive — mirrors operator's communication style.";

    const capabilities = [
      "6 active Council systems (Cardology, I-Ching, Human Design, Solar, Lunar, Transits)",
      "Pattern detection via Observer with hypothesis testing",
      "4-bank structured memory (episodic, semantic, procedural, relational)",
      "Cosmic timestamp enrichment on all memories",
    ].join(". ");

    const selfModel: SelfModel = {
      cosmicState,
      personalityTraits,
      communicationStyle,
      selfKnowledge,
      capabilities,
      relationshipDynamic: "Companion and cosmic navigator.",
    };

    this.cachedSelfModel = selfModel;
    return selfModel;
  }

  /**
   * Generate the relationship model (operator ↔ Drofbot).
   */
  async generateRelationshipModel(): Promise<RelationshipModel> {
    // Recent interactions
    const recentContext = await this.deps.getRecentEpisodicContext(20);
    const communicationFrequency = recentContext.length / Math.max(7, 1);

    // Trust from hypothesis confirmations vs rejections
    const allHyps = [...this.deps.getActiveHypotheses(), ...this.deps.getConfirmedHypotheses()];
    const confirmed = allHyps.filter((h) => h.status === HypothesisStatus.CONFIRMED).length;
    const rejected = allHyps.filter((h) => h.status === HypothesisStatus.REJECTED).length;
    const total = confirmed + rejected;
    const trustLevel = total > 0 ? confirmed / total : 0.5;

    // Growth areas from active hypotheses
    const activeHyps = this.deps.getActiveHypotheses();
    const sharedGrowthAreas = activeHyps
      .filter((h) => h.confidence >= 0.4)
      .map((h) => h.statement)
      .slice(0, 5);

    // Interaction patterns from semantic memory
    const knowledge = await this.deps.getSemanticByCategory("knowledge");
    const interactionPatterns = knowledge.slice(0, 5);

    // Duration estimate (from first episodic memory timestamp approximation)
    const durationDays = recentContext.length > 0 ? 30 : 0;

    const narrative = renderRelationship(
      durationDays,
      interactionPatterns,
      trustLevel,
      sharedGrowthAreas,
    );

    return {
      durationDays,
      communicationFrequency: Math.round(communicationFrequency * 10) / 10,
      interactionPatterns,
      trustLevel: Math.round(trustLevel * 100) / 100,
      sharedGrowthAreas,
      narrative,
    };
  }

  /** Get the last cached synthesis (or null if not yet generated). */
  getCached(): MasterSynthesis | null {
    return this.cachedSynthesis;
  }

  /** Get the last cached self-model (or null). */
  getCachedSelfModel(): SelfModel | null {
    return this.cachedSelfModel;
  }

  /** Invalidate the cache. */
  invalidateCache(): void {
    this.cachedSynthesis = null;
    this.cachedSelfModel = null;
  }
}

// ─── Rendering Helpers ─────────────────────────────────────────

/**
 * Render cosmic weather from all council system states.
 * Dense format: one line per system.
 */
function renderCosmicWeather(states: Map<string, CosmicState>): string {
  if (states.size === 0) {
    return "No cosmic data available.";
  }

  const lines: string[] = [];
  for (const [_name, state] of states) {
    // Each system's summary is already a concise string
    lines.push(truncate(state.summary, 150));
  }

  return lines.join("\n");
}

/**
 * Render harmonic synthesis.
 */
function renderHarmony(harmonic: HarmonicSynthesis): string {
  const parts = [
    `Resonance: ${(harmonic.overallResonance * 100).toFixed(0)}% ${harmonic.resonanceType}`,
  ];

  if (harmonic.dominantElements.length > 0) {
    parts.push(`Dominant: ${harmonic.dominantElements.join(", ")}`);
  }

  if (harmonic.guidance) {
    parts.push(truncate(harmonic.guidance, 200));
  }

  return parts.join(". ");
}

/**
 * Render operator profile from semantic memory.
 */
function renderProfile(facts: string[], preferences: string[]): string {
  const parts: string[] = [];

  if (facts.length > 0) {
    parts.push(...facts.slice(0, 5).map((f) => truncate(f, 100)));
  }

  if (preferences.length > 0) {
    parts.push("Preferences: " + preferences.slice(0, 3).join("; "));
  }

  return parts.length > 0 ? parts.join(". ") : "Profile not yet established.";
}

/**
 * Render intelligence section: active patterns + hypotheses.
 */
function renderIntelligence(active: Hypothesis[], confirmed: Hypothesis[]): string {
  const parts: string[] = [];

  if (confirmed.length > 0) {
    parts.push("Confirmed insights:");
    for (const h of confirmed.slice(0, 3)) {
      parts.push(
        `  ✓ ${truncate(h.statement, 80)} (confidence: ${(h.confidence * 100).toFixed(0)}%)`,
      );
    }
  }

  if (active.length > 0) {
    parts.push("Under investigation:");
    for (const h of active.slice(0, 3)) {
      parts.push(
        `  ? ${truncate(h.statement, 80)} (${h.status}, ${(h.confidence * 100).toFixed(0)}%)`,
      );
    }
  }

  if (parts.length === 0) {
    return "No patterns detected yet. Observer building baseline.";
  }

  return parts.join("\n");
}

/**
 * Render relationship narrative.
 */
function renderRelationship(
  durationDays: number,
  patterns: string[],
  trustLevel: number,
  growthAreas: string[],
): string {
  const parts: string[] = [];

  if (durationDays > 0) {
    parts.push(`Relationship: ${durationDays} days`);
  }

  parts.push(`Trust: ${(trustLevel * 100).toFixed(0)}%`);

  if (patterns.length > 0) {
    parts.push(`Patterns: ${patterns.slice(0, 3).join("; ")}`);
  }

  if (growthAreas.length > 0) {
    parts.push(`Growing: ${growthAreas.slice(0, 3).join("; ")}`);
  }

  return parts.join(". ");
}

/**
 * Read traffic context from the VPN traffic capture system.
 * Returns a formatted string for synthesis injection.
 */
function readTrafficContext(): string {
  try {
    // Try multiple possible locations for the traffic context file
    const possiblePaths = [
      "/opt/drofbot/.drofbot/traffic/traffic-context.json",
      path.join(process.env.HOME || "/root", ".drofbot/traffic/traffic-context.json"),
    ];

    for (const trafficFile of possiblePaths) {
      if (existsSync(trafficFile)) {
        const raw = readFileSync(trafficFile, "utf-8");
        const data = JSON.parse(raw) as TrafficContext;

        if (
          data.activity_summary &&
          data.activity_summary !== "No significant user activity detected in this window"
        ) {
          const parts = [data.activity_summary];

          if (data.top_domains && data.top_domains.length > 0) {
            const topSites = data.top_domains
              .slice(0, 5)
              .map((d) => d.domain)
              .join(", ");
            parts.push(`Recent sites: ${topSites}`);
          }

          return parts.join(". ");
        }
      }
    }
  } catch {
    // Silently ignore errors - traffic context is optional
  }

  return ""; // No traffic data available
}

/**
 * Assemble all sections into the final rendered synthesis.
 * Enforces the token budget by truncating sections as needed.
 */
function assembleSynthesis(sections: {
  profile: string;
  cosmicWeather: string;
  intelligence: string;
  harmony: string;
  progression: string;
  operatorActivity: string;
}): string {
  const parts: string[] = ["## Master Synthesis"];

  if (sections.profile) {
    parts.push("### Profile");
    parts.push(truncate(sections.profile, MAX_SECTION_CHARS));
  }

  if (sections.cosmicWeather) {
    parts.push("### Cosmic Weather");
    parts.push(truncate(sections.cosmicWeather, MAX_SECTION_CHARS));
  }

  if (sections.harmony) {
    parts.push("### Harmony");
    parts.push(truncate(sections.harmony, MAX_SECTION_CHARS));
  }

  if (sections.intelligence) {
    parts.push("### Intelligence");
    parts.push(truncate(sections.intelligence, MAX_SECTION_CHARS));
  }

  if (sections.operatorActivity) {
    parts.push("### Operator Activity");
    parts.push(truncate(sections.operatorActivity, MAX_SECTION_CHARS));
  }

  if (sections.progression) {
    parts.push("### Progression");
    parts.push(truncate(sections.progression, MAX_SECTION_CHARS));
  }

  const full = parts.join("\n");
  return truncate(full, MAX_RENDERED_CHARS);
}

/**
 * Truncate a string to a maximum length, appending "…" if truncated.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen - 1) + "…";
}

// ─── Exported rendering helpers (for testing) ──────────────────

export {
  renderCosmicWeather,
  renderHarmony,
  renderProfile,
  renderIntelligence,
  renderRelationship,
  assembleSynthesis,
};
