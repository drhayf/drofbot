/**
 * Voice Analyzer
 * Phase: 6
 *
 * Analyzes conversation turns for linguistic patterns.
 * Runs after every conversation turn — lightweight extraction,
 * not a full LLM call. Incrementally builds the operator's voice profile.
 */

import type { VoiceProfile } from "./types.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { getVoiceProfile, updateVoiceProfile } from "./vault.js";

const log = createSubsystemLogger("identity/voice-analyzer");

// ─── Analysis Helpers ──────────────────────────────────────────

/** Count emoji characters in text */
function countEmoji(text: string): number {
  // Matches most emoji including compound sequences
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

/** Classify emoji usage frequency from ratio */
function classifyEmojiUsage(
  emojiCount: number,
  wordCount: number,
): "none" | "rare" | "moderate" | "frequent" {
  if (emojiCount === 0) return "none";
  const ratio = emojiCount / Math.max(wordCount, 1);
  if (ratio < 0.02) return "rare";
  if (ratio < 0.08) return "moderate";
  return "frequent";
}

/** Estimate formality from text features */
function estimateFormality(text: string): number {
  let score = 0.5;
  const lower = text.toLowerCase();

  // Formal indicators
  if (/\b(therefore|however|furthermore|regarding|concerning)\b/.test(lower)) score += 0.1;
  if (/\b(please|kindly|would you)\b/.test(lower)) score += 0.05;
  if (text === text.charAt(0).toUpperCase() + text.slice(1)) score += 0.02; // starts with capital

  // Informal indicators
  if (/\b(lol|lmao|haha|omg|btw|tbh|imo|ngl)\b/i.test(lower)) score -= 0.15;
  if (/\b(gonna|wanna|gotta|kinda|sorta)\b/.test(lower)) score -= 0.1;
  if (text.includes("!!!") || text.includes("???")) score -= 0.05;
  if (/[a-z]/.test(text.charAt(0))) score -= 0.03; // starts lowercase

  return Math.max(0, Math.min(1, score));
}

/** Classify sentence complexity from average word count */
function classifySentenceComplexity(avgWords: number): "simple" | "moderate" | "complex" {
  if (avgWords < 8) return "simple";
  if (avgWords < 18) return "moderate";
  return "complex";
}

/** Extract potential unique expressions (informal phrases, slang) */
function extractUniqueExpressions(text: string): string[] {
  const expressions: string[] = [];

  // Look for quoted phrases
  const quoted = text.match(/[""]([^""]+)[""]|"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) {
      const clean = q.replace(/["""]/g, "").trim();
      if (clean.length > 2 && clean.length < 40) {
        expressions.push(clean);
      }
    }
  }

  // Look for phrases with emphasis markers
  const emphasized = text.match(/\*([^*]+)\*/g);
  if (emphasized) {
    for (const e of emphasized) {
      const clean = e.replace(/\*/g, "").trim();
      if (clean.length > 2 && clean.length < 30) {
        expressions.push(clean);
      }
    }
  }

  return expressions;
}

/** Extract frequently used words (excluding common stop words) */
function extractVocabularyPreferences(text: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "need",
    "must",
    "and",
    "but",
    "or",
    "nor",
    "not",
    "so",
    "yet",
    "both",
    "either",
    "neither",
    "each",
    "every",
    "all",
    "any",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "only",
    "own",
    "same",
    "than",
    "too",
    "very",
    "just",
    "because",
    "as",
    "until",
    "while",
    "of",
    "at",
    "by",
    "for",
    "with",
    "about",
    "against",
    "between",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "to",
    "from",
    "up",
    "down",
    "in",
    "out",
    "on",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "ours",
    "you",
    "your",
    "yours",
    "he",
    "him",
    "his",
    "she",
    "her",
    "hers",
    "it",
    "its",
    "they",
    "them",
    "their",
    "if",
    "into",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .split(/\s+/);
  const freq = new Map<string, number>();

  for (const w of words) {
    if (w.length < 3 || stopWords.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

// ─── Sentence Splitter ─────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Main Analysis ─────────────────────────────────────────────

/**
 * Analyze a single conversation turn from the operator.
 * Lightweight — no LLM calls, pure pattern extraction.
 *
 * @param text The operator's message text
 * @returns Updated voice profile
 */
export async function analyzeConversationTurn(text: string): Promise<VoiceProfile> {
  if (!text || text.trim().length === 0) {
    return getVoiceProfile();
  }

  const current = await getVoiceProfile();
  const sentences = splitSentences(text);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Skip very short messages (greetings, single words)
  if (wordCount < 3) {
    return current;
  }

  // ── Sentence length ──
  const turnAvgLength = sentences.length > 0 ? words.length / sentences.length : wordCount;

  // Exponential moving average with existing data
  const n = current.conversationsAnalyzed;
  const alpha = n === 0 ? 1 : Math.min(0.3, 2 / (n + 1));
  const newAvgLength = current.avgSentenceLength * (1 - alpha) + turnAvgLength * alpha;

  // ── Emoji usage ──
  const emojiCount = countEmoji(text);
  const turnEmojiUsage = classifyEmojiUsage(emojiCount, wordCount);
  // Keep existing classification unless we have strong evidence
  const emojiUsage = n < 5 ? turnEmojiUsage : current.emojiUsage;

  // ── Formality ──
  const turnFormality = estimateFormality(text);
  const newFormality = current.formalityLevel * (1 - alpha) + turnFormality * alpha;

  // ── Complexity ──
  const sentenceComplexity = classifySentenceComplexity(newAvgLength);

  // ── Vocabulary ──
  const turnVocab = extractVocabularyPreferences(text);
  const mergedVocab = mergeStringArrays(current.vocabularyPreferences, turnVocab, 30);

  // ── Unique expressions ──
  const turnExpressions = extractUniqueExpressions(text);
  const mergedExpressions = mergeStringArrays(current.uniqueExpressions, turnExpressions, 20);

  const patch: Partial<VoiceProfile> = {
    avgSentenceLength: Math.round(newAvgLength * 10) / 10,
    sentenceComplexity,
    formalityLevel: Math.round(newFormality * 100) / 100,
    emojiUsage,
    vocabularyPreferences: mergedVocab,
    uniqueExpressions: mergedExpressions,
    conversationsAnalyzed: n + 1,
    lastAnalyzedAt: new Date().toISOString(),
  };

  const updated = await updateVoiceProfile(patch);
  log.debug(
    `Voice analyzed: turn #${n + 1}, ${wordCount} words, formality ${patch.formalityLevel}`,
  );
  return updated;
}

/**
 * Analyze engagement signals from a conversation turn.
 * Detects stress, excitement, brevity preferences, topic engagement.
 */
export function analyzeEngagementSignals(text: string): {
  energy: "low" | "moderate" | "high";
  brevityPreference: "short" | "neutral" | "detailed";
  potentialTopics: string[];
} {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const sentences = splitSentences(text);
  const hasExclamation = text.includes("!");
  const hasQuestion = text.includes("?");
  const hasEllipsis = text.includes("...");

  // Energy level
  let energy: "low" | "moderate" | "high" = "moderate";
  if (wordCount < 5 && !hasExclamation) energy = "low";
  if (hasExclamation && wordCount > 10) energy = "high";
  if (text.toUpperCase() === text && wordCount > 3) energy = "high";

  // Brevity preference
  let brevityPreference: "short" | "neutral" | "detailed" = "neutral";
  if (wordCount < 8) brevityPreference = "short";
  if (wordCount > 50 && sentences.length > 3) brevityPreference = "detailed";

  // Topic extraction: nouns and noun-like words
  const potentialTopics = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 5);

  return { energy, brevityPreference, potentialTopics };
}

// ─── Utilities ─────────────────────────────────────────────────

/** Merge two string arrays, deduplicating and capping at maxLen */
function mergeStringArrays(existing: string[], incoming: string[], maxLen: number): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item)) {
      merged.push(item);
      seen.add(item);
    }
  }
  return merged.slice(-maxLen); // keep newest
}
