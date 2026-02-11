/**
 * Reference Ingester — Tests
 * Phase: 6
 *
 * Tests for:
 * 1. Document ingestion
 * 2. Observation extraction (writing style, themes, vocabulary, tone)
 * 3. Size limits
 * 4. Storage in vault
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ingestDocument } from "./reference-ingester.js";
import { getReferenceDocuments, resetVault } from "./vault.js";

beforeEach(() => {
  resetVault();
});

describe("ingestDocument", () => {
  it("ingests a text document and extracts observations", async () => {
    const content = `
I believe in building things with care and intention. Every project I take on
reflects a deeper commitment to authenticity and craftsmanship. I create not
because I have to, but because the act of creation itself is meaningful.

Growth happens in the spaces between. Sometimes the most important thing is
to sit with uncertainty and let the pattern emerge. I've learned that forcing
clarity is counterproductive — real understanding arrives on its own schedule.

The best ideas come when I'm walking, usually in the late afternoon when the
light shifts. Something about movement and natural beauty unlocks thinking
that sitting at a desk never could.
    `.trim();

    const result = await ingestDocument("personal-manifesto.txt", content);

    expect(result.document.filename).toBe("personal-manifesto.txt");
    expect(result.document.processed).toBe(true);
    expect(result.document.sizeBytes).toBeGreaterThan(0);
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();

    // Should detect themes like creation/building and growth
    const hasRelevantObs = result.observations.some(
      (o) => o.includes("creation") || o.includes("growth") || o.includes("style"),
    );
    expect(hasRelevantObs).toBe(true);
  });

  it("stores document in vault after ingestion", async () => {
    await ingestDocument(
      "test.txt",
      "This is a test document with enough content to process properly.",
    );

    const docs = await getReferenceDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(1);
    const doc = docs.find((d) => d.filename === "test.txt");
    expect(doc).toBeDefined();
    expect(doc!.processed).toBe(true);
  });

  it("rejects documents over size limit", async () => {
    const hugeContent = "x".repeat(600_000);
    const result = await ingestDocument("huge.txt", hugeContent);

    expect(result.document.processed).toBe(false);
    expect(result.error).toContain("too large");
    expect(result.observations).toHaveLength(0);
  });

  it("detects writing style from short sentences", async () => {
    const content = `
Short. Punchy. Direct.
No fluff. Just meaning.
Cut the noise. Ship it.
Keep building. Stay focused.
Move fast. Break nothing.
    `.trim();

    const result = await ingestDocument("style-test.txt", content);
    const styleObs = result.observations.filter(
      (o) => o.includes("style") || o.includes("short") || o.includes("brevity"),
    );
    expect(styleObs.length).toBeGreaterThan(0);
  });

  it("detects metaphorical vocabulary", async () => {
    const content = `
The project resonates with something deeper, like a chord struck in a dark room.
Ideas dance around each other, weaving patterns that mirror the natural rhythms
of creative work. Each iteration echoes the last, building resonance as the
metaphor deepens. The work itself becomes a mirror, reflecting back what we
put into it and revealing what lies beneath.
    `.trim();

    const result = await ingestDocument("metaphor-test.txt", content);
    const vocabObs = result.observations.filter(
      (o) => o.includes("metaphor") || o.includes("poetic"),
    );
    expect(vocabObs.length).toBeGreaterThan(0);
  });

  it("detects warm, appreciative tone", async () => {
    const content = `
I'm so grateful for the people in my life. Each connection is a beautiful gift.
I love how we grow together, learning from each other. The wonderful thing about
genuine relationships is how they make everything else better. I appreciate
every moment of this journey.
    `.trim();

    const result = await ingestDocument("tone-test.txt", content);
    const toneObs = result.observations.filter(
      (o) => o.includes("warm") || o.includes("appreciative"),
    );
    expect(toneObs.length).toBeGreaterThan(0);
  });

  it("detects inquiry-driven writing", async () => {
    const content = `
What if consciousness is more distributed than we think? How would that change
our approach to artificial intelligence? And what about the role of embodiment?
Does physical presence matter for understanding? Can meaning exist without context?
Is there a fundamental difference between simulation and genuine experience?
What does it even mean to be genuine?
    `.trim();

    const result = await ingestDocument("inquiry-test.txt", content);
    const toneObs = result.observations.filter(
      (o) => o.includes("inquiry") || o.includes("question"),
    );
    expect(toneObs.length).toBeGreaterThan(0);
  });
});
