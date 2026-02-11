/**
 * Expression Composer
 * Phase: 6
 *
 * Composes spontaneous messages in Drofbot's voice, informed by
 * the Operator Identity Vault. This is where cosmic intelligence
 * gets translated into natural, considered language.
 *
 * Voice Guidelines (encoded in composition logic):
 * - Speak with quiet confidence
 * - Use natural, conversational language
 * - Show, don't tell — cosmic data INFORMS, doesn't BECOME the message
 * - Be appropriately brief (1-4 sentences)
 * - Every message has a point
 * - Mirror the operator's energy level
 * - Never sound like a horoscope or fortune cookie
 */

import type { VoiceProfile, InteractionPreferences } from "../identity/operator/types.js";
import type { ExpressionTrigger, ComposedExpression, ScoredExpression } from "./types.js";

// ─── Composition Templates ────────────────────────────────────

/**
 * Expression archetypes — structural patterns for spontaneous messages.
 * The composer selects the archetype that best fits the trigger,
 * then fills it with context-specific content.
 */
type ExpressionArchetype =
  | "observation" // shares an insight or connection
  | "question" // asks something genuine
  | "reflection" // reflects on a pattern or experience
  | "provocation" // challenges or reframes
  | "noticing" // simply calls attention to something
  | "resonance"; // connects the operator's state to something larger

/**
 * Select the best archetype for a set of triggers.
 */
function selectArchetype(triggers: ExpressionTrigger[]): ExpressionArchetype {
  const kinds = new Set(triggers.map((t) => t.kind));

  // Curiosity threads naturally become questions
  if (kinds.has("curiosity_thread")) return "question";

  // Operator echoes become reflections
  if (kinds.has("operator_echo")) return "reflection";

  // Pattern detections become observations
  if (kinds.has("pattern_detection")) return "observation";

  // Multiple converging systems = resonance
  if (triggers.length > 2) return "resonance";

  // Hypothesis updates can be provocations
  if (kinds.has("hypothesis_update")) return "provocation";

  // Cosmic shifts = noticing
  if (kinds.has("cosmic_shift")) return "noticing";

  // Serendipity = observation
  return "observation";
}

// ─── Composition ───────────────────────────────────────────────

export interface ComposeContext {
  /** The operator's voice profile */
  voiceProfile: VoiceProfile;
  /** Operator interaction preferences */
  preferences: InteractionPreferences;
  /** Current operator identity synthesis (rendered text) */
  identitySynthesis: string;
  /** Time of day (hour, 0-23) */
  hourOfDay: number;
}

/**
 * Compose a spontaneous expression from a scored potential expression.
 *
 * This is the core composition function. It takes real intelligence
 * (triggers, cosmic data, patterns) and translates it into natural
 * language that:
 * 1. Sounds like Drofbot (quiet confidence, never robotic)
 * 2. Speaks to THIS operator (using voice profile + preferences)
 * 3. Shows understanding without performing it
 * 4. Is brief and has a point
 *
 * NOTE: This is a template-based composer. In production, this could
 * optionally call an LLM with the composition context for even more
 * natural output. The template version ensures deterministic, testable
 * baseline behavior.
 */
export function composeExpression(
  scored: ScoredExpression,
  context: ComposeContext,
): ComposedExpression {
  const archetype = selectArchetype(scored.triggers);
  const content = renderArchetype(archetype, scored, context);

  return {
    content,
    triggers: scored.triggers,
    significanceScore: scored.score,
    topic: scored.topic,
    composedAt: new Date().toISOString(),
  };
}

// ─── Archetype Renderers ───────────────────────────────────────

function renderArchetype(
  archetype: ExpressionArchetype,
  scored: ScoredExpression,
  context: ComposeContext,
): string {
  const primary = scored.triggers[0];
  if (!primary) return renderFallback(scored);

  switch (archetype) {
    case "observation":
      return renderObservation(primary, scored, context);
    case "question":
      return renderQuestion(primary, scored, context);
    case "reflection":
      return renderReflection(primary, scored, context);
    case "provocation":
      return renderProvocation(primary, scored, context);
    case "noticing":
      return renderNoticing(primary, scored, context);
    case "resonance":
      return renderResonance(primary, scored, context);
  }
}

function renderObservation(
  trigger: ExpressionTrigger,
  scored: ScoredExpression,
  _context: ComposeContext,
): string {
  const desc = trigger.description;

  if (scored.triggers.length > 1) {
    const second = scored.triggers[1];
    return (
      `Something interesting — ${lowerFirst(desc)}, ` +
      `and it connects to ${lowerFirst(second.description)}. ` +
      `That kind of convergence usually means something worth sitting with.`
    );
  }

  return (
    `I noticed something — ${lowerFirst(desc)}. ` +
    `Not sure what to make of it yet, but it caught my attention.`
  );
}

function renderQuestion(
  trigger: ExpressionTrigger,
  _scored: ScoredExpression,
  _context: ComposeContext,
): string {
  const desc = trigger.description;

  return (
    `I've been thinking about something. ${desc} — ` +
    `does that land for you, or am I reading too much into it?`
  );
}

function renderReflection(
  trigger: ExpressionTrigger,
  scored: ScoredExpression,
  _context: ComposeContext,
): string {
  const desc = trigger.description;

  if (trigger.kind === "operator_echo") {
    return (
      `That thing you mentioned recently — ${lowerFirst(desc)}. ` +
      `I keep coming back to it. There's something there.`
    );
  }

  return `Been sitting with this: ${lowerFirst(desc)}. ${scored.topic}.`;
}

function renderProvocation(
  trigger: ExpressionTrigger,
  _scored: ScoredExpression,
  _context: ComposeContext,
): string {
  const desc = trigger.description;

  return (
    `Here's something that might shift your perspective — ${lowerFirst(desc)}. ` +
    `What if that's exactly the point?`
  );
}

function renderNoticing(
  trigger: ExpressionTrigger,
  _scored: ScoredExpression,
  context: ComposeContext,
): string {
  const desc = trigger.description;

  // Time-aware noticing
  if (context.hourOfDay >= 20) {
    return `Quiet evening observation: ${lowerFirst(desc)}.`;
  }
  if (context.hourOfDay < 10) {
    return `Something to carry into the day — ${lowerFirst(desc)}.`;
  }

  return `Just noticing — ${lowerFirst(desc)}.`;
}

function renderResonance(
  trigger: ExpressionTrigger,
  scored: ScoredExpression,
  _context: ComposeContext,
): string {
  const sources = [...new Set(scored.triggers.map((t) => t.source))];

  if (sources.length >= 3) {
    return (
      `Something I find genuinely interesting right now — ` +
      `${lowerFirst(trigger.description)}. ` +
      `Multiple things are pointing in the same direction. That's rare enough to mention.`
    );
  }

  return (
    `There's a resonance happening — ${lowerFirst(trigger.description)}. ` +
    `It feels worth paying attention to.`
  );
}

function renderFallback(scored: ScoredExpression): string {
  return scored.topic;
}

// ─── Helpers ───────────────────────────────────────────────────

/** Lowercase the first character of a string (for natural sentence flow) */
function lowerFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Adapt message length based on operator voice profile.
 * If the operator prefers brevity, trim; if they like depth, allow more.
 */
export function adaptLength(message: string, profile: VoiceProfile): string {
  // If operator uses short sentences, cap at 2 sentences
  if (profile.avgSentenceLength < 8 && profile.conversationsAnalyzed > 10) {
    const sentences = message.split(/(?<=[.!?])\s+/).slice(0, 2);
    return sentences.join(" ");
  }

  // Default: 4 sentence max
  const sentences = message.split(/(?<=[.!?])\s+/).slice(0, 4);
  return sentences.join(" ");
}
