/**
 * Operator Identity Synthesis Generator
 * Phase: 6
 *
 * Generates the Operator Identity Synthesis — a concise document
 * (500-1000 tokens) that captures who the operator is for system
 * prompt injection. Draws from the voice profile, interaction
 * preferences, reference document observations, and manual notes.
 *
 * Regenerated daily or after significant vault updates.
 */

import type {
  OperatorIdentitySynthesis,
  VoiceProfile,
  InteractionPreferences,
  VaultEntry,
} from "./types.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import {
  getVoiceProfile,
  getInteractionPreferences,
  getVaultEntriesByCategory,
  getManualNotes,
  storeIdentitySynthesis,
} from "./vault.js";

const log = createSubsystemLogger("identity/synthesis");

/** Maximum characters for the rendered synthesis (~500-1000 tokens) */
const MAX_SYNTHESIS_CHARS = 2400;

// ─── Synthesis Generation ──────────────────────────────────────

/**
 * Generate a fresh Operator Identity Synthesis from all vault data.
 * This is the document that gets injected into the system prompt
 * alongside the Master Cosmic Synthesis.
 */
export async function generateOperatorSynthesis(): Promise<OperatorIdentitySynthesis> {
  const voice = await getVoiceProfile();
  const prefs = await getInteractionPreferences();
  const refDocs = await getVaultEntriesByCategory("reference_doc");
  const notes = await getManualNotes();

  let dataPoints = 0;

  // ── Communication Style ──
  const communicationStyle = renderCommunicationStyle(voice);
  dataPoints += voice.conversationsAnalyzed;

  // ── Core Values ──
  const observations = collectObservations(refDocs);
  const coreValues = renderCoreValues(observations, notes);
  dataPoints += observations.length + notes.length;

  // ── Avoidances ──
  const avoidances = renderAvoidances(prefs, notes);

  // ── Current State ──
  const currentState = renderCurrentState(voice, prefs);

  // ── Render full synthesis ──
  const rendered = assembleSynthesis({
    communicationStyle,
    coreValues,
    avoidances,
    currentState,
  });

  const synthesis: OperatorIdentitySynthesis = {
    communicationStyle,
    coreValues,
    avoidances,
    currentState,
    rendered,
    generatedAt: new Date().toISOString(),
    dataPoints,
  };

  // Persist
  await storeIdentitySynthesis(synthesis);

  log.info(`Identity synthesis generated: ${rendered.length} chars from ${dataPoints} data points`);

  return synthesis;
}

// ─── Rendering Helpers ─────────────────────────────────────────

function renderCommunicationStyle(voice: VoiceProfile): string {
  if (voice.conversationsAnalyzed === 0) {
    return "Communication style not yet established — building from conversations.";
  }

  const parts: string[] = [];

  // Sentence style
  const lenDesc =
    voice.avgSentenceLength < 8
      ? "short, punchy sentences"
      : voice.avgSentenceLength < 15
        ? "moderate-length sentences"
        : "longer, detailed sentences";
  parts.push(`Uses ${lenDesc} (avg ${voice.avgSentenceLength} words)`);

  // Formality
  const formalityDesc =
    voice.formalityLevel < 0.3
      ? "very casual and informal"
      : voice.formalityLevel < 0.5
        ? "conversational with casual leanings"
        : voice.formalityLevel < 0.7
          ? "balanced between casual and formal"
          : "tends toward formal language";
  parts.push(formalityDesc);

  // Complexity
  parts.push(`${voice.sentenceComplexity} sentence complexity`);

  // Emoji
  if (voice.emojiUsage !== "none") {
    parts.push(`${voice.emojiUsage} emoji usage`);
  }

  // Humor
  if (voice.humorStyle && voice.humorStyle !== "unknown") {
    parts.push(`humor: ${voice.humorStyle}`);
  }

  // Tone
  if (voice.toneDescription && !voice.toneDescription.startsWith("Not yet")) {
    parts.push(voice.toneDescription);
  }

  // Vocabulary highlights
  if (voice.vocabularyPreferences.length > 0) {
    const top = voice.vocabularyPreferences.slice(0, 5).join(", ");
    parts.push(`frequently uses: ${top}`);
  }

  // Unique expressions
  if (voice.uniqueExpressions.length > 0) {
    const exprs = voice.uniqueExpressions
      .slice(0, 3)
      .map((e) => `"${e}"`)
      .join(", ");
    parts.push(`distinctive expressions: ${exprs}`);
  }

  return parts.join(". ") + ".";
}

function renderCoreValues(observations: string[], notes: VaultEntry[]): string {
  const parts: string[] = [];

  // From reference document observations
  const themeObs = observations.filter((o) => o.startsWith("Recurring theme:"));
  if (themeObs.length > 0) {
    parts.push(
      "Themes from personal writing: " +
        themeObs
          .map((o) => o.replace("Recurring theme: ", "").replace(/\.$/, ""))
          .slice(0, 5)
          .join("; ") +
        ".",
    );
  }

  // From manual notes
  const valueNotes = notes.filter(
    (n) =>
      typeof n.content.text === "string" &&
      (n.key.includes("value") || n.key.includes("core") || n.key.includes("important")),
  );
  if (valueNotes.length > 0) {
    parts.push(
      "Self-described values: " +
        valueNotes
          .map((n) => n.content.text as string)
          .slice(0, 3)
          .join("; ") +
        ".",
    );
  }

  // From writing style observations
  const styleObs = observations.filter(
    (o) => o.startsWith("Writing style:") || o.startsWith("Tone:"),
  );
  if (styleObs.length > 0) {
    parts.push(styleObs.slice(0, 3).join(" "));
  }

  if (parts.length === 0) {
    return "Core values not yet established — upload reference documents or add identity notes.";
  }

  return parts.join(" ");
}

function renderAvoidances(prefs: InteractionPreferences, notes: VaultEntry[]): string {
  const parts: string[] = [];

  // Cosmic depth preference
  if (prefs.cosmicDepthPreference === "avoids") {
    parts.push(
      "Avoid cosmic/metaphysical system language — reference insights obliquely, never name-drop systems.",
    );
  } else if (prefs.cosmicDepthPreference === "light") {
    parts.push("Keep cosmic references light and occasional — one mention at most, never lecture.");
  }

  // Disengaging topics
  if (prefs.disengagingTopics.length > 0) {
    parts.push(
      "Topics to avoid or keep brief: " + prefs.disengagingTopics.slice(0, 3).join(", ") + ".",
    );
  }

  // Manual avoidance notes
  const avoidNotes = notes.filter(
    (n) =>
      typeof n.content.text === "string" &&
      (n.key.includes("avoid") || n.key.includes("dont") || n.key.includes("dislike")),
  );
  if (avoidNotes.length > 0) {
    parts.push(avoidNotes.map((n) => n.content.text as string).join("; "));
  }

  if (parts.length === 0) {
    return "No specific avoidances identified yet.";
  }

  return parts.join(" ");
}

function renderCurrentState(voice: VoiceProfile, prefs: InteractionPreferences): string {
  const parts: string[] = [];

  if (voice.conversationsAnalyzed > 0) {
    parts.push(`Based on ${voice.conversationsAnalyzed} conversations analyzed.`);
  }

  if (prefs.activeHours.start !== 7 || prefs.activeHours.end !== 23) {
    parts.push(`Active hours: ${prefs.activeHours.start}:00–${prefs.activeHours.end}:00.`);
  }

  // Stress/relaxation patterns
  if (prefs.stressIndicators.length > 0) {
    parts.push(`When stressed, tends to: ${prefs.stressIndicators.slice(0, 2).join(", ")}.`);
  }

  if (parts.length === 0) {
    return "Current state baseline not yet established.";
  }

  return parts.join(" ");
}

// ─── Assembly ──────────────────────────────────────────────────

function assembleSynthesis(sections: {
  communicationStyle: string;
  coreValues: string;
  avoidances: string;
  currentState: string;
}): string {
  const parts: string[] = ["## Operator Identity"];

  if (sections.communicationStyle) {
    parts.push("### Communication");
    parts.push(truncate(sections.communicationStyle, 600));
  }

  if (sections.coreValues) {
    parts.push("### Core Values");
    parts.push(truncate(sections.coreValues, 600));
  }

  if (sections.avoidances) {
    parts.push("### Avoidances");
    parts.push(truncate(sections.avoidances, 400));
  }

  if (sections.currentState) {
    parts.push("### Current State");
    parts.push(truncate(sections.currentState, 300));
  }

  return truncate(parts.join("\n"), MAX_SYNTHESIS_CHARS);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Collect all observations from reference document entries.
 */
function collectObservations(refDocs: VaultEntry[]): string[] {
  const all: string[] = [];
  for (const entry of refDocs) {
    const content = entry.content;
    if (Array.isArray(content.observations)) {
      all.push(...(content.observations as string[]));
    }
  }
  return all;
}
