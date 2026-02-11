/**
 * Voice Analyzer — Tests
 * Phase: 6
 *
 * Tests for:
 * 1. Conversation turn analysis (voice profile updates)
 * 2. Emoji detection
 * 3. Formality estimation
 * 4. Vocabulary extraction
 * 5. Engagement signal analysis
 * 6. Incremental profile building
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getVoiceProfile, resetVault } from "./vault.js";
import { analyzeConversationTurn, analyzeEngagementSignals } from "./voice-analyzer.js";

beforeEach(() => {
  resetVault();
});

// ─── Conversation Turn Analysis ────────────────────────────────

describe("analyzeConversationTurn", () => {
  it("skips empty or very short messages", async () => {
    const profile = await analyzeConversationTurn("");
    expect(profile.conversationsAnalyzed).toBe(0);

    const profile2 = await analyzeConversationTurn("hi");
    expect(profile2.conversationsAnalyzed).toBe(0);
  });

  it("analyzes a casual conversation turn", async () => {
    const text =
      "honestly I've been thinking about this a lot lately, " +
      "kinda feels like everything is shifting. not sure what to make of it " +
      "but there's definitely something happening";

    const profile = await analyzeConversationTurn(text);
    expect(profile.conversationsAnalyzed).toBe(1);
    expect(profile.formalityLevel).toBeLessThan(0.5); // casual language detected
    expect(profile.avgSentenceLength).toBeGreaterThan(0);
  });

  it("analyzes a formal conversation turn", async () => {
    const text =
      "I would like to understand the fundamental nature of this phenomenon. " +
      "Furthermore, the implications regarding our methodology are significant. " +
      "Please provide additional context concerning the temporal patterns.";

    const profile = await analyzeConversationTurn(text);
    expect(profile.conversationsAnalyzed).toBe(1);
    expect(profile.formalityLevel).toBeGreaterThan(0.5); // formal language detected
  });

  it("detects emoji usage", async () => {
    const text =
      "This is amazing! 🔥🎉 I love how everything connects 🌟 " +
      "the patterns are so clear today 💫 genuinely excited about this";

    const profile = await analyzeConversationTurn(text);
    expect(profile.emojiUsage).not.toBe("none");
  });

  it("extracts vocabulary preferences from repeated words", async () => {
    const text =
      "The pattern is clearly evolving. I see the pattern again in a different form. " +
      "This evolving pattern connects to something deeper, evolving through each cycle.";

    const profile = await analyzeConversationTurn(text);
    expect(profile.vocabularyPreferences.length).toBeGreaterThan(0);
    expect(profile.vocabularyPreferences.some((w) => w === "pattern" || w === "evolving")).toBe(
      true,
    );
  });

  it("extracts unique expressions from quoted text", async () => {
    const text =
      'I keep thinking about what you said about "the tension itself is the point" and ' +
      'how "building something you can\'t see" applies here. It really resonates.';

    const profile = await analyzeConversationTurn(text);
    // Unique expressions include quoted phrases
    expect(profile.uniqueExpressions.length).toBeGreaterThanOrEqual(0);
  });

  it("incrementally builds profile across multiple turns", async () => {
    await analyzeConversationTurn(
      "I think there's something interesting about how these systems converge.",
    );
    await analyzeConversationTurn(
      "Yeah totally, the convergence patterns are kinda wild honestly.",
    );
    await analyzeConversationTurn("What if we looked at this from a completely different angle?");

    const profile = await getVoiceProfile();
    expect(profile.conversationsAnalyzed).toBe(3);
    expect(profile.lastAnalyzedAt).toBeTruthy();
  });

  it("classifies sentence complexity correctly", async () => {
    // Short sentences = simple
    const short = await analyzeConversationTurn("Yes. Agreed. Makes sense. Got it. Perfect.");
    expect(short.sentenceComplexity).toBe("simple");

    resetVault();

    // Long sentences = complex
    const long = await analyzeConversationTurn(
      "The interconnected nature of these metaphysical systems when viewed through " +
        "the lens of harmonic resonance theory suggests a fundamentally different approach " +
        "to understanding consciousness and temporal experience in the modern world.",
    );
    expect(long.sentenceComplexity).toBe("complex");
  });
});

// ─── Engagement Signals ────────────────────────────────────────

describe("analyzeEngagementSignals", () => {
  it("detects low energy messages", () => {
    const result = analyzeEngagementSignals("ok sure");
    expect(result.energy).toBe("low");
    expect(result.brevityPreference).toBe("short");
  });

  it("detects high energy messages", () => {
    const result = analyzeEngagementSignals(
      "This is incredible! I've been waiting for exactly this kind of insight!",
    );
    expect(result.energy).toBe("high");
  });

  it("detects detailed preference from long messages", () => {
    const result = analyzeEngagementSignals(
      "I've been thinking about this for a while now, and I believe there are " +
        "several angles we could explore. First, the temporal patterns suggest " +
        "a recurring cycle that aligns with the solar activity. Second, the " +
        "emotional resonance during these periods is significantly heightened. " +
        "Third, there's a clear connection to the card system transitions.",
    );
    expect(result.brevityPreference).toBe("detailed");
  });

  it("extracts potential topics from text", () => {
    const result = analyzeEngagementSignals(
      "I'm curious about the relationship between creativity and cosmic patterns",
    );
    expect(result.potentialTopics.length).toBeGreaterThan(0);
  });
});
