/**
 * Quest Generator
 *
 * Generates quests based on cosmic alignment and intelligence patterns.
 * Sources (from GUTTERS):
 *
 * 1. COSMIC QUESTS: Generated from Council state
 * 2. PATTERN QUESTS: Generated from Observer patterns
 * 3. GROWTH QUESTS: Generated from Hypothesis testing
 * 4. DAILY QUESTS: Routine habits aligned with current energies
 *
 * This module provides deterministic quest templates.
 * For LLM-generated quests, the caller passes cosmic context.
 */

import type { CosmicState, HarmonicSynthesis } from "../council/types.js";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import type { Quest, QuestDifficulty, QuestType } from "./types.js";
import { HypothesisStatus } from "../intelligence/hypothesis.js";
import { calculateQuestXP } from "./types.js";

// ─── Quest Template ────────────────────────────────────────────

export interface QuestTemplate {
  title: string;
  description: string;
  questType: QuestType;
  difficulty: QuestDifficulty;
  cosmicAlignment: number | null;
  insightId: string | null;
  metadata: Record<string, unknown>;
}

// ─── Quest Generator ───────────────────────────────────────────

/**
 * Generate cosmic quests from current Council state.
 * Maps cosmic weather to actionable quests.
 */
export function generateCosmicQuests(
  cosmicStates: Map<string, CosmicState>,
  harmonic: HarmonicSynthesis | null,
): QuestTemplate[] {
  const templates: QuestTemplate[] = [];

  for (const [system, state] of cosmicStates) {
    const quest = mapCosmicStateToQuest(system, state);
    if (quest) {
      // Apply harmonic resonance as cosmic alignment
      if (harmonic) {
        quest.cosmicAlignment = harmonic.overallResonance;
      }
      templates.push(quest);
    }
  }

  return templates;
}

/**
 * Generate growth quests from hypotheses that need more data.
 */
export function generateGrowthQuests(hypotheses: Hypothesis[]): QuestTemplate[] {
  const templates: QuestTemplate[] = [];

  for (const hyp of hypotheses) {
    if (hyp.status !== HypothesisStatus.FORMING && hyp.status !== HypothesisStatus.TESTING) {
      continue;
    }

    // Hypotheses with low confidence need more evidence
    if (hyp.confidence < 0.6 && hyp.evidenceRecords.length < 5) {
      templates.push({
        title: `Observe: ${truncateTitle(hyp.statement)}`,
        description:
          `Help test this pattern by noting relevant observations today. ` +
          `Current confidence: ${(hyp.confidence * 100).toFixed(0)}%. ` +
          `Needs more data points.`,
        questType: "growth",
        difficulty: "easy",
        cosmicAlignment: null,
        insightId: hyp.id,
        metadata: {
          hypothesisId: hyp.id,
          hypothesisType: hyp.type,
          currentConfidence: hyp.confidence,
        },
      });
    }
  }

  return templates.slice(0, 3); // Max 3 growth quests per cycle
}

/**
 * Generate daily routine quests.
 */
export function generateDailyQuests(): QuestTemplate[] {
  return [
    {
      title: "Morning check-in",
      description: "Share how you're feeling this morning — mood, energy, any dreams.",
      questType: "daily",
      difficulty: "easy",
      cosmicAlignment: null,
      insightId: null,
      metadata: { category: "reflection" },
    },
    {
      title: "Evening reflection",
      description: "Reflect on the day. What went well? What challenged you?",
      questType: "daily",
      difficulty: "easy",
      cosmicAlignment: null,
      insightId: null,
      metadata: { category: "reflection" },
    },
  ];
}

/**
 * Build a Quest object from a template.
 */
export function questFromTemplate(template: QuestTemplate): Quest {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: template.title,
    description: template.description,
    questType: template.questType,
    difficulty: template.difficulty,
    xpReward: calculateQuestXP(template.difficulty, {
      insightLinked: !!template.insightId,
    }),
    status: "active",
    cosmicAlignment: template.cosmicAlignment,
    insightId: template.insightId,
    source: "agent",
    assignedAt: now,
    completedAt: null,
    expiresAt: template.questType === "daily" ? endOfDay : null,
    metadata: template.metadata,
  };
}

// ─── Internal Helpers ──────────────────────────────────────────

/**
 * Map a cosmic state to a quest template.
 * Uses system-specific keywords to produce relevant quests.
 */
function mapCosmicStateToQuest(system: string, state: CosmicState): QuestTemplate | null {
  const summary = state.summary.toLowerCase();

  // Cardology: Mercury period → mental focus quests
  if (system === "cardology" && summary.includes("mercury")) {
    return {
      title: "Deep focus session",
      description:
        `Mercury period active — historically your sharpest mental window. ` +
        `Tackle your most complex task.`,
      questType: "cosmic",
      difficulty: "hard",
      cosmicAlignment: null,
      insightId: null,
      metadata: { system: "cardology", period: "mercury" },
    };
  }

  // I-Ching: Depth gates → mastery quests
  if (system === "iching" && (summary.includes("depth") || summary.includes("mastery"))) {
    return {
      title: "Mastery practice",
      description:
        `Gate transit aligned with depth and mastery. ` +
        `Spend focused time on a skill you're developing.`,
      questType: "cosmic",
      difficulty: "medium",
      cosmicAlignment: null,
      insightId: null,
      metadata: { system: "iching", theme: "mastery" },
    };
  }

  // Solar: High Kp → awareness quests
  if (system === "solar") {
    const kpMatch = summary.match(/kp\s*(\d+)/i);
    if (kpMatch && parseInt(kpMatch[1]) >= 5) {
      return {
        title: "Solar storm awareness",
        description:
          `Kp index elevated (${kpMatch[1]}). Note how you feel — ` +
          `energy levels, focus, any physical sensations.`,
        questType: "cosmic",
        difficulty: "easy",
        cosmicAlignment: null,
        insightId: null,
        metadata: { system: "solar", kpIndex: parseInt(kpMatch[1]) },
      };
    }
  }

  return null;
}

function truncateTitle(text: string, maxLen = 40): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}
