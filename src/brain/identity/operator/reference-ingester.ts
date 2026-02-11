/**
 * Reference Document Ingester
 * Phase: 6
 *
 * Processes uploaded reference documents (writing samples, personal
 * manifestos, journal excerpts, etc.) into identity-relevant observations
 * that feed the Operator Identity Synthesis.
 *
 * Documents are NOT stored verbatim in the prompt — they're distilled
 * into concise identity observations.
 */

import type { ReferenceDocument } from "./types.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { storeReferenceDocument, upsertVaultEntry } from "./vault.js";

const log = createSubsystemLogger("identity/reference-ingester");

// ─── Constants ─────────────────────────────────────────────────

/** Maximum document size we'll process (500KB) */
const MAX_DOCUMENT_SIZE = 512_000;

/** Maximum observations per document */
const MAX_OBSERVATIONS = 20;

// ─── Ingestion ─────────────────────────────────────────────────

export interface IngestResult {
  document: ReferenceDocument;
  observations: string[];
  error?: string;
}

/**
 * Ingest a reference document.
 *
 * Extracts identity-relevant observations from the content
 * and stores them in the vault. The raw content is NOT stored
 * in the vault — only the extracted observations.
 *
 * @param filename Original filename
 * @param content Text content of the document
 * @param contentType MIME type or category
 * @returns Ingestion result with extracted observations
 */
export async function ingestDocument(
  filename: string,
  content: string,
  contentType: string = "text/plain",
): Promise<IngestResult> {
  const docId = crypto.randomUUID();
  const sizeBytes = new TextEncoder().encode(content).length;

  if (sizeBytes > MAX_DOCUMENT_SIZE) {
    const doc: ReferenceDocument = {
      id: docId,
      filename,
      contentType,
      sizeBytes,
      observations: [],
      uploadedAt: new Date().toISOString(),
      processed: false,
    };
    return {
      document: doc,
      observations: [],
      error: `Document too large (${sizeBytes} bytes > ${MAX_DOCUMENT_SIZE} limit)`,
    };
  }

  // Extract observations using heuristic analysis
  const observations = extractObservations(content);

  const doc: ReferenceDocument = {
    id: docId,
    filename,
    contentType,
    sizeBytes,
    observations,
    uploadedAt: new Date().toISOString(),
    processed: true,
  };

  // Store the document metadata + observations
  await storeReferenceDocument(doc);

  // Also store observations as individual vault entries for synthesis
  if (observations.length > 0) {
    await upsertVaultEntry({
      category: "reference_doc",
      key: `observations::${docId}`,
      content: {
        filename,
        observations,
        extractedAt: new Date().toISOString(),
      },
      source: "uploaded_document",
      confidence: 0.8,
    });
  }

  log.info(
    `Ingested document '${filename}': ${observations.length} observations from ${sizeBytes} bytes`,
  );

  return { document: doc, observations };
}

// ─── Observation Extraction ────────────────────────────────────

/**
 * Extract identity-relevant observations from document content.
 *
 * Uses heuristic analysis (no LLM calls) to identify:
 * - Writing style characteristics
 * - Recurring themes and values
 * - Vocabulary patterns
 * - Tone and emotional register
 */
function extractObservations(content: string): string[] {
  const observations: string[] = [];

  // Writing style
  const styleObs = analyzeWritingStyle(content);
  observations.push(...styleObs);

  // Recurring themes
  const themeObs = analyzeThemes(content);
  observations.push(...themeObs);

  // Vocabulary patterns
  const vocabObs = analyzeVocabularyPatterns(content);
  observations.push(...vocabObs);

  // Tone and emotional register
  const toneObs = analyzeTone(content);
  observations.push(...toneObs);

  return observations.slice(0, MAX_OBSERVATIONS);
}

/**
 * Analyze writing style characteristics.
 */
function analyzeWritingStyle(content: string): string[] {
  const obs: string[] = [];
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return obs;

  const wordCounts = sentences.map((s) => s.split(/\s+/).length);
  const avgWords = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;

  if (avgWords < 8) {
    obs.push("Writing style: short, punchy sentences. Prefers brevity.");
  } else if (avgWords < 15) {
    obs.push("Writing style: moderate sentence length. Balanced between concise and detailed.");
  } else {
    obs.push("Writing style: long, detailed sentences. Comfortable with complexity.");
  }

  // Sentence length variance
  if (wordCounts.length > 3) {
    const variance =
      wordCounts.reduce((acc, wc) => acc + (wc - avgWords) ** 2, 0) / wordCounts.length;
    if (variance > 50) {
      obs.push(
        "Writing rhythm: varied sentence lengths — mixes short punches with longer explorations.",
      );
    } else {
      obs.push("Writing rhythm: consistent sentence lengths — steady, even cadence.");
    }
  }

  // Paragraph structure
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length > 1) {
    const avgParaLen = paragraphs.reduce((a, p) => a + p.length, 0) / paragraphs.length;
    if (avgParaLen < 100) {
      obs.push("Paragraph style: short paragraphs — prefers bite-sized chunks.");
    } else if (avgParaLen > 400) {
      obs.push("Paragraph style: long, developed paragraphs — thinks in extended passages.");
    }
  }

  // Fragment usage
  const fragments = sentences.filter((s) => s.split(/\s+/).length <= 3);
  if (fragments.length / sentences.length > 0.3) {
    obs.push("Uses sentence fragments frequently — telegraphic, informal style.");
  }

  return obs;
}

/**
 * Analyze recurring themes and values.
 */
function analyzeThemes(content: string): string[] {
  const obs: string[] = [];
  const lower = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  const themePatterns = [
    { pattern: /\b(create|build|make|craft|design|construct)\b/gi, theme: "creation and building" },
    {
      pattern: /\b(think|thought|idea|concept|theory|understand)\b/gi,
      theme: "intellectual exploration",
    },
    { pattern: /\b(feel|feeling|emotion|heart|soul|spirit)\b/gi, theme: "emotional depth" },
    {
      pattern: /\b(connect|relationship|together|community|friend)\b/gi,
      theme: "connection and relationships",
    },
    {
      pattern: /\b(grow|growth|evolve|learn|improve|develop)\b/gi,
      theme: "growth and self-development",
    },
    { pattern: /\b(free|freedom|independence|autonomy|choice)\b/gi, theme: "freedom and autonomy" },
    { pattern: /\b(beauty|beautiful|aesthetic|elegant|grace)\b/gi, theme: "beauty and aesthetics" },
    { pattern: /\b(truth|honest|authentic|genuine|real)\b/gi, theme: "authenticity and truth" },
    {
      pattern: /\b(simplify|simple|minimal|essence|distill)\b/gi,
      theme: "simplicity and essentialism",
    },
    { pattern: /\b(nature|natural|earth|wild|organic)\b/gi, theme: "nature and the natural world" },
  ];

  for (const { pattern, theme } of themePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length >= Math.max(2, wordCount / 200)) {
      obs.push(`Recurring theme: ${theme} (appeared ${matches.length} times).`);
    }
  }

  return obs;
}

/**
 * Analyze vocabulary patterns.
 */
function analyzeVocabularyPatterns(content: string): string[] {
  const obs: string[] = [];

  // Check for technical/specialized vocabulary
  const technicalTerms = content.match(
    /\b(algorithm|infrastructure|architecture|framework|paradigm|methodology|ontology|epistemology|heuristic|recursive)\b/gi,
  );
  if (technicalTerms && technicalTerms.length > 2) {
    obs.push("Vocabulary: comfortable with technical/specialized language.");
  }

  // Check for metaphorical language
  const metaphorical = content.match(
    /\b(like a|as if|metaphor|resonat|echo|mirror|reflect|dance|weave)\b/gi,
  );
  if (metaphorical && metaphorical.length > 2) {
    obs.push("Vocabulary: uses metaphorical and poetic language naturally.");
  }

  // Check for colloquial/casual language
  const casual = content.match(
    /\b(gonna|wanna|kinda|sorta|totally|literally|basically|honestly|thing is)\b/gi,
  );
  if (casual && casual.length > 2) {
    obs.push("Vocabulary: uses casual, colloquial language — conversational tone.");
  }

  // Check for emphasis patterns
  const emphasis = content.match(/(\*[^*]+\*|_[^_]+_|[A-Z]{3,})/g);
  if (emphasis && emphasis.length > 2) {
    obs.push("Emphasis: uses formatting (bold, italic, caps) for emphasis — visually expressive.");
  }

  return obs;
}

/**
 * Analyze tone and emotional register.
 */
function analyzeTone(content: string): string[] {
  const obs: string[] = [];

  // Humor indicators
  const humor = content.match(/\b(haha|lol|funny|joke|laugh|ironic|sardonic|absurd)\b/gi);
  if (humor && humor.length > 1) {
    obs.push("Tone: has a sense of humor — uses it naturally in writing.");
  }

  // Seriousness
  const serious = content.match(
    /\b(important|serious|critical|essential|fundamental|must|urgent)\b/gi,
  );
  if (serious && serious.length > 3) {
    obs.push("Tone: writes with weight and seriousness — values substance.");
  }

  // Warmth
  const warm = content.match(/\b(love|care|grateful|thank|appreciate|beautiful|wonderful)\b/gi);
  if (warm && warm.length > 2) {
    obs.push("Tone: warm and appreciative — emotionally open in writing.");
  }

  // Directness
  const questions = (content.match(/\?/g) ?? []).length;
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const questionRatio = sentences > 0 ? questions / sentences : 0;
  if (questionRatio > 0.3) {
    obs.push("Tone: inquiry-driven — asks lots of questions, explores through questioning.");
  } else if (questionRatio < 0.05 && sentences > 5) {
    obs.push("Tone: declarative — makes statements more than asks questions.");
  }

  return obs;
}
