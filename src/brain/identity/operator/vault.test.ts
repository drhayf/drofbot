/**
 * Operator Identity Vault — Tests
 * Phase: 6
 *
 * Tests for:
 * 1. Vault CRUD operations
 * 2. Voice profile get/update
 * 3. Interaction preferences
 * 4. Identity synthesis storage
 * 5. Reference document management
 * 6. Manual notes
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { VoiceProfile, ReferenceDocument, OperatorIdentitySynthesis } from "./types.js";
import {
  DEFAULT_VOICE_PROFILE,
  DEFAULT_INTERACTION_PREFS,
  EMPTY_IDENTITY_SYNTHESIS,
} from "./types.js";
import {
  upsertVaultEntry,
  getVaultEntry,
  getVaultEntriesByCategory,
  deleteVaultEntry,
  deleteVaultEntryById,
  getVoiceProfile,
  updateVoiceProfile,
  getInteractionPreferences,
  updateInteractionPreferences,
  getIdentitySynthesis,
  storeIdentitySynthesis,
  getReferenceDocuments,
  storeReferenceDocument,
  deleteReferenceDocument,
  getManualNotes,
  upsertManualNote,
  resetVault,
} from "./vault.js";

beforeEach(() => {
  resetVault();
});

// ─── Vault CRUD ────────────────────────────────────────────────

describe("Vault CRUD", () => {
  it("upserts and retrieves an entry", async () => {
    const result = await upsertVaultEntry({
      category: "voice_pattern",
      key: "test-key",
      content: { value: "hello" },
      source: "conversation_analysis",
      confidence: 0.7,
    });

    expect(result.id).toBeTruthy();
    expect(result.category).toBe("voice_pattern");
    expect(result.key).toBe("test-key");
    expect(result.content).toEqual({ value: "hello" });

    const retrieved = await getVaultEntry("voice_pattern", "test-key");
    expect(retrieved).toBeDefined();
    expect(retrieved!.content).toEqual({ value: "hello" });
  });

  it("upserts existing entry (update)", async () => {
    await upsertVaultEntry({
      category: "voice_pattern",
      key: "same-key",
      content: { version: 1 },
      source: "conversation_analysis",
      confidence: 0.5,
    });

    const updated = await upsertVaultEntry({
      category: "voice_pattern",
      key: "same-key",
      content: { version: 2 },
      source: "conversation_analysis",
      confidence: 0.8,
    });

    expect(updated.content).toEqual({ version: 2 });
    expect(updated.confidence).toBe(0.8);

    const retrieved = await getVaultEntry("voice_pattern", "same-key");
    expect(retrieved!.content).toEqual({ version: 2 });
  });

  it("retrieves entries by category", async () => {
    await upsertVaultEntry({
      category: "note",
      key: "note1",
      content: { text: "first" },
      source: "manual_note",
      confidence: 1,
    });
    await upsertVaultEntry({
      category: "note",
      key: "note2",
      content: { text: "second" },
      source: "manual_note",
      confidence: 1,
    });
    await upsertVaultEntry({
      category: "voice_pattern",
      key: "other",
      content: { unrelated: true },
      source: "conversation_analysis",
      confidence: 0.5,
    });

    const notes = await getVaultEntriesByCategory("note");
    expect(notes).toHaveLength(2);
  });

  it("deletes an entry by category+key", async () => {
    await upsertVaultEntry({
      category: "note",
      key: "deleteme",
      content: { text: "bye" },
      source: "manual_note",
      confidence: 1,
    });

    const deleted = await deleteVaultEntry("note", "deleteme");
    expect(deleted).toBe(true);

    const retrieved = await getVaultEntry("note", "deleteme");
    expect(retrieved).toBeUndefined();
  });

  it("deletes an entry by ID", async () => {
    const entry = await upsertVaultEntry({
      category: "note",
      key: "byid",
      content: { text: "test" },
      source: "manual_note",
      confidence: 1,
    });

    const deleted = await deleteVaultEntryById(entry.id);
    expect(deleted).toBe(true);

    const retrieved = await getVaultEntry("note", "byid");
    expect(retrieved).toBeUndefined();
  });

  it("returns undefined for nonexistent entry", async () => {
    const result = await getVaultEntry("voice_pattern", "nope");
    expect(result).toBeUndefined();
  });
});

// ─── Voice Profile ─────────────────────────────────────────────

describe("Voice Profile", () => {
  it("returns default profile when none exists", async () => {
    const profile = await getVoiceProfile();
    expect(profile).toEqual(DEFAULT_VOICE_PROFILE);
  });

  it("updates and retrieves voice profile", async () => {
    const updated = await updateVoiceProfile({
      avgSentenceLength: 15.5,
      formalityLevel: 0.6,
      conversationsAnalyzed: 10,
    });

    expect(updated.avgSentenceLength).toBe(15.5);
    expect(updated.formalityLevel).toBe(0.6);
    expect(updated.conversationsAnalyzed).toBe(10);
    // Default values preserved
    expect(updated.emojiUsage).toBe("rare");

    const retrieved = await getVoiceProfile();
    expect(retrieved.avgSentenceLength).toBe(15.5);
  });

  it("merges with existing profile on update", async () => {
    await updateVoiceProfile({ avgSentenceLength: 10 });
    await updateVoiceProfile({ formalityLevel: 0.8 });

    const profile = await getVoiceProfile();
    expect(profile.avgSentenceLength).toBe(10);
    expect(profile.formalityLevel).toBe(0.8);
  });

  it("confidence increases with conversations analyzed", async () => {
    await updateVoiceProfile({ conversationsAnalyzed: 1 });
    const entry1 = await getVaultEntry("voice_pattern", "profile");
    const conf1 = entry1!.confidence;

    await updateVoiceProfile({ conversationsAnalyzed: 50 });
    const entry2 = await getVaultEntry("voice_pattern", "profile");
    const conf2 = entry2!.confidence;

    expect(conf2).toBeGreaterThan(conf1);
  });
});

// ─── Interaction Preferences ───────────────────────────────────

describe("Interaction Preferences", () => {
  it("returns defaults when none exist", async () => {
    const prefs = await getInteractionPreferences();
    expect(prefs).toEqual(DEFAULT_INTERACTION_PREFS);
  });

  it("updates and retrieves preferences", async () => {
    const updated = await updateInteractionPreferences({
      cosmicDepthPreference: "light",
      engagingTopics: ["philosophy", "music"],
    });

    expect(updated.cosmicDepthPreference).toBe("light");
    expect(updated.engagingTopics).toEqual(["philosophy", "music"]);

    const retrieved = await getInteractionPreferences();
    expect(retrieved.cosmicDepthPreference).toBe("light");
  });
});

// ─── Identity Synthesis ────────────────────────────────────────

describe("Identity Synthesis Storage", () => {
  it("returns empty synthesis when none exists", async () => {
    const synthesis = await getIdentitySynthesis();
    expect(synthesis.communicationStyle).toContain("Not yet");
  });

  it("stores and retrieves synthesis", async () => {
    const synth: OperatorIdentitySynthesis = {
      communicationStyle: "Casual, short sentences",
      coreValues: "Authenticity, growth",
      avoidances: "No metaphysical jargon",
      currentState: "High energy",
      rendered: "## Operator Identity\n### Communication\nCasual style",
      generatedAt: new Date().toISOString(),
      dataPoints: 42,
    };

    await storeIdentitySynthesis(synth);
    const retrieved = await getIdentitySynthesis();
    expect(retrieved.communicationStyle).toBe("Casual, short sentences");
    expect(retrieved.dataPoints).toBe(42);
  });
});

// ─── Reference Documents ──────────────────────────────────────

describe("Reference Documents", () => {
  it("stores and retrieves reference documents", async () => {
    const doc: ReferenceDocument = {
      id: "doc-123",
      filename: "bio.txt",
      contentType: "text/plain",
      sizeBytes: 1024,
      observations: ["Writing style: casual", "Theme: growth"],
      uploadedAt: new Date().toISOString(),
      processed: true,
    };

    await storeReferenceDocument(doc);
    const docs = await getReferenceDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].filename).toBe("bio.txt");
    expect(docs[0].observations).toHaveLength(2);
  });

  it("deletes a reference document", async () => {
    const doc: ReferenceDocument = {
      id: "doc-del",
      filename: "temp.txt",
      contentType: "text/plain",
      sizeBytes: 100,
      observations: [],
      uploadedAt: new Date().toISOString(),
      processed: true,
    };

    await storeReferenceDocument(doc);
    const deleted = await deleteReferenceDocument("doc-del");
    expect(deleted).toBe(true);

    const docs = await getReferenceDocuments();
    expect(docs).toHaveLength(0);
  });
});

// ─── Manual Notes ──────────────────────────────────────────────

describe("Manual Notes", () => {
  it("creates and retrieves notes", async () => {
    await upsertManualNote("core-value", "Authenticity above all");
    await upsertManualNote("avoid-topic", "Don't talk about weather literally");

    const notes = await getManualNotes();
    expect(notes).toHaveLength(2);
    expect(notes.some((n) => n.key === "core-value")).toBe(true);
  });

  it("updates existing note", async () => {
    await upsertManualNote("tone", "Casual");
    await upsertManualNote("tone", "Very casual");

    const notes = await getManualNotes();
    const tone = notes.find((n) => n.key === "tone");
    expect(tone!.content.text).toBe("Very casual");
  });
});

// ─── Reset ─────────────────────────────────────────────────────

describe("Reset", () => {
  it("clears all vault entries", async () => {
    await upsertVaultEntry({
      category: "note",
      key: "a",
      content: { text: "1" },
      source: "manual_note",
      confidence: 1,
    });
    await upsertVaultEntry({
      category: "voice_pattern",
      key: "b",
      content: { test: true },
      source: "conversation_analysis",
      confidence: 0.5,
    });

    resetVault();

    const notes = await getVaultEntriesByCategory("note");
    const voice = await getVaultEntriesByCategory("voice_pattern");
    expect(notes).toHaveLength(0);
    expect(voice).toHaveLength(0);
  });
});
