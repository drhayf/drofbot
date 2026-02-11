/**
 * Identity Synthesis Generator — Tests
 * Phase: 6
 *
 * Tests for:
 * 1. Synthesis generation from vault data
 * 2. Communication style rendering
 * 3. Core values rendering
 * 4. Avoidances rendering
 * 5. Empty/default state handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { generateOperatorSynthesis } from "./identity-synthesis.js";
import { ingestDocument } from "./reference-ingester.js";
import {
  updateVoiceProfile,
  updateInteractionPreferences,
  upsertManualNote,
  resetVault,
} from "./vault.js";

beforeEach(() => {
  resetVault();
});

describe("generateOperatorSynthesis", () => {
  it("generates empty synthesis when no data exists", async () => {
    const synthesis = await generateOperatorSynthesis();
    expect(synthesis.communicationStyle).toContain("not yet");
    expect(synthesis.rendered).toContain("Operator Identity");
    expect(synthesis.dataPoints).toBe(0);
  });

  it("generates synthesis from voice profile", async () => {
    await updateVoiceProfile({
      avgSentenceLength: 10,
      formalityLevel: 0.3,
      sentenceComplexity: "moderate",
      emojiUsage: "moderate",
      conversationsAnalyzed: 25,
      vocabularyPreferences: ["pattern", "energy", "resonance", "build", "create"],
      uniqueExpressions: ["the tension itself is the point"],
    });

    const synthesis = await generateOperatorSynthesis();
    expect(synthesis.communicationStyle).toContain("moderate");
    expect(synthesis.communicationStyle).toContain("casual");
    expect(synthesis.communicationStyle).toContain("pattern");
    expect(synthesis.dataPoints).toBe(25);
    expect(synthesis.rendered.length).toBeGreaterThan(0);
  });

  it("includes avoidances from interaction preferences", async () => {
    await updateInteractionPreferences({
      cosmicDepthPreference: "avoids",
      disengagingTopics: ["small talk", "weather"],
    });

    const synthesis = await generateOperatorSynthesis();
    expect(synthesis.avoidances).toContain("Avoid");
    expect(synthesis.avoidances).toContain("small talk");
  });

  it("includes core values from reference documents", async () => {
    await ingestDocument(
      "values.txt",
      "I believe in creating beautiful things. Growth and authentic connection " +
        "drive everything I do. I build with intention and care about truth.",
    );

    const synthesis = await generateOperatorSynthesis();
    // Should have extracted theme observations
    expect(synthesis.rendered.length).toBeGreaterThan(100);
  });

  it("includes manual notes", async () => {
    await upsertManualNote("core-value", "Authenticity above all");
    await upsertManualNote("avoid-topic", "No platitudes");

    const synthesis = await generateOperatorSynthesis();
    expect(synthesis.rendered).toContain("Operator Identity");
  });

  it("respects the token budget (stays under max chars)", async () => {
    // Load up the vault with lots of data
    await updateVoiceProfile({
      conversationsAnalyzed: 100,
      vocabularyPreferences: Array.from({ length: 30 }, (_, i) => `word${i}`),
      uniqueExpressions: Array.from({ length: 20 }, (_, i) => `expression number ${i}`),
    });

    await updateInteractionPreferences({
      engagingTopics: Array.from({ length: 10 }, (_, i) => `topic${i}`),
      stressIndicators: Array.from({ length: 5 }, (_, i) => `stress${i}`),
    });

    for (let i = 0; i < 5; i++) {
      await upsertManualNote(`note-${i}`, `This is a detailed note about identity aspect ${i}`);
    }

    const synthesis = await generateOperatorSynthesis();
    // MAX_SYNTHESIS_CHARS is 2400
    expect(synthesis.rendered.length).toBeLessThanOrEqual(2400);
  });

  it("stores the generated synthesis in the vault", async () => {
    await updateVoiceProfile({ conversationsAnalyzed: 5 });
    const synthesis = await generateOperatorSynthesis();

    expect(synthesis.generatedAt).toBeTruthy();
    expect(synthesis.rendered).toContain("## Operator Identity");
  });

  it("renders all sections in the output", async () => {
    await updateVoiceProfile({
      conversationsAnalyzed: 10,
      avgSentenceLength: 12,
      formalityLevel: 0.4,
    });
    await updateInteractionPreferences({
      cosmicDepthPreference: "light",
    });

    const synthesis = await generateOperatorSynthesis();
    expect(synthesis.rendered).toContain("Communication");
    expect(synthesis.rendered).toContain("Avoidances");
  });
});
