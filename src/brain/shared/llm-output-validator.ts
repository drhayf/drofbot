/**
 * LLM Output Validator — shared validation utility for all brain modules
 *
 * The principle: Never store data that hasn't been validated against its expected shape.
 * If validation fails, log the error and discard — never store garbage.
 *
 * This module provides:
 * 1. Corruption detection (source code fragments, system prompt leaks)
 * 2. Field-level validation (strings, numbers, arrays)
 * 3. Robust JSON extraction from LLM responses
 */

// Patterns that indicate the LLM echoed back source code or system prompt
const CORRUPTION_PATTERNS = [
  /\bimport\s+(type\s+)?{/, // TypeScript imports
  /\bfrom\s+['"][.@/]/, // Module paths
  /\bfunction\s+\w+\s*\(/, // Function declarations
  /\bconst\s+\w+\s*=\s*(?:require|import)/, // Require/import statements
  /\bcreateSubsystemLogger\b/, // Internal function names
  /\bOpenClawConfig\b/, // Internal type names
  /\bSEFLG_|SE_SUN|SE_MOON/, // Swiss Ephemeris constants
  /```(?:json|typescript|javascript)/, // Markdown code fences that survived stripping
  /\(\?:\w+\)\?\\s/, // Regex patterns
  /\bexport\s+(default\s+)?/, // Export statements
  /\b(?:interface|type|enum)\s+\w+\s*{/, // TypeScript type declarations
  /node_modules\//, // File paths
  /\.(ts|js|tsx|jsx|py|json)\b/, // File extensions in non-path context
  /\basync\s+function\b/, // Async function declarations
  /\bclass\s+\w+/, // Class declarations
  /\blet\s+\w+\s*=/, // Let declarations
  /\breturn\s+{/, // Return statements with objects
  /\btry\s*{/, // Try-catch blocks
  /\bcatch\s*\(/, // Catch blocks
  /\bnew\s+(?:Promise|Map|Set|Array|Object|Error)\b/, // Constructor calls
  /\bconsole\.(log|warn|error|info)\b/, // Console calls
  /\bprocess\.env\b/, // Environment access
  /\b__dirname\b/, // Node globals
  /\brequire\(['"]/, // Require calls
];

/**
 * Check if text contains patterns indicating LLM echoed source code or system prompt
 */
export function containsCorruption(text: string): boolean {
  return CORRUPTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Validate a string field - returns null if invalid or corrupted
 */
export function validateStringField(value: unknown, fieldName: string): string | null {
  if (typeof value !== "string") return null;
  if (value.trim().length === 0) return null;
  if (containsCorruption(value)) {
    console.warn(
      `[validator] Corrupted content detected in field "${fieldName}": ${value.slice(0, 80)}...`,
    );
    return null;
  }
  return value.trim();
}

/**
 * Validate an array of strings - filters out corrupted entries
 * Returns null if all entries are invalid or corrupted
 */
export function validateStringArray(arr: unknown, fieldName: string): string[] | null {
  if (!Array.isArray(arr)) return null;

  const clean = arr
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !containsCorruption(s));

  if (clean.length === 0) return null;
  return clean;
}

/**
 * Validate a number field with optional min/max bounds
 */
export function validateNumberField(value: unknown, min?: number, max?: number): number | null {
  if (typeof value !== "number" || isNaN(value)) return null;
  if (min !== undefined && value < min) return null;
  if (max !== undefined && value > max) return null;
  return value;
}

/**
 * Validate a boolean field
 */
export function validateBooleanField(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

/**
 * Robust JSON extraction from LLM responses
 * Handles: markdown fences, multiple formatting variations, double-wrapped arrays, trailing commas
 */
export function extractJSON(raw: string): object | null {
  if (!raw || typeof raw !== "string") return null;

  // Strip markdown fences (with whitespace tolerance)
  let cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    // Continue to more aggressive extraction
  }

  // Try to find JSON object in the text
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // Continue to more aggressive fixes
    }
  }

  // Try to find JSON array in the text
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return { items: parsed };
    } catch {
      // Continue to more aggressive fixes
    }
  }

  // Fix common LLM JSON errors
  // Double-wrapped arrays: "banks":[[{...}]]
  cleaned = cleaned.replace(/"banks"\s*:\s*\[\s*\[/g, '"banks":[');
  cleaned = cleaned.replace(/\]\s*\]\s*\}/g, "]}");

  // Trailing commas before closing brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  // Single quotes to double quotes (but not inside strings)
  // This is risky - only apply if parse still fails

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    // Final attempt with single quote replacement
    try {
      const singleQuoteFixed = cleaned.replace(/'/g, '"');
      const parsed = JSON.parse(singleQuoteFixed);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // Give up
    }
  }

  return null;
}

/**
 * Validate that an object has the expected shape for a memory classification
 */
export interface ValidatedClassification {
  shouldStore: boolean;
  banks: Array<{ name: string; content: string }>;
}

export function validateClassification(parsed: unknown): ValidatedClassification | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const shouldStore = validateBooleanField(obj.shouldStore);
  if (shouldStore === null) return null;
  if (!shouldStore) return { shouldStore: false, banks: [] };

  if (!Array.isArray(obj.banks)) return null;

  const validBanks = obj.banks
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => {
      const name = validateStringField(b.name ?? b.bank, "bank.name");
      const content = validateStringField(b.text ?? b.content, "bank.content");
      return { name, content };
    })
    .filter((b): b is { name: string; content: string } => b.name !== null && b.content !== null);

  if (validBanks.length === 0 && shouldStore) return null; // Claimed should store but no valid banks

  return { shouldStore: true, banks: validBanks };
}

/**
 * Validate that an object has the expected shape for a voice profile
 */
export interface ValidatedVoiceProfile {
  descriptors: string[];
  uniqueExpressions: string[];
  averageSentenceLength: number;
  formality: number;
  toneDescription: string;
  humorStyle: string;
  emojiUsage: string;
  sentenceComplexity: string;
  vocabularyPreferences: string[];
}

export function validateVoiceProfile(parsed: unknown): ValidatedVoiceProfile | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Validate descriptors — this is where the corruption appeared
  const descriptors = validateStringArray(obj.descriptors, "descriptors");
  const uniqueExpressions = validateStringArray(
    obj.uniqueExpressions ?? obj.expressions,
    "uniqueExpressions",
  );

  // Validate numeric fields
  const sentenceLength = validateNumberField(
    obj.averageSentenceLength ?? obj.sentenceLength,
    1,
    500,
  );
  const formality = validateNumberField(obj.formality, 0, 1);

  // Validate string fields
  const toneDescription =
    validateStringField(obj.toneDescription ?? obj.dominantTone, "toneDescription") ??
    "Not yet established";
  const humorStyle = validateStringField(obj.humorStyle, "humorStyle") ?? "unknown";
  const emojiUsage = validateStringField(obj.emojiUsage, "emojiUsage") ?? "moderate";
  const sentenceComplexity =
    validateStringField(obj.sentenceComplexity, "sentenceComplexity") ?? "moderate";

  // Validate vocabulary preferences
  const vocabularyPreferences = validateStringArray(
    obj.vocabularyPreferences ?? obj.vocabulary,
    "vocabularyPreferences",
  );

  // If ALL core fields are null/empty, the whole profile is garbage
  if (
    descriptors === null &&
    uniqueExpressions === null &&
    sentenceLength === null &&
    formality === null &&
    vocabularyPreferences === null
  ) {
    console.warn("[validator] Voice profile has no valid fields — discarding analysis");
    return null;
  }

  return {
    descriptors: descriptors ?? [],
    uniqueExpressions: uniqueExpressions ?? [],
    averageSentenceLength: sentenceLength ?? 15,
    formality: formality ?? 0.5,
    toneDescription,
    humorStyle,
    emojiUsage,
    sentenceComplexity,
    vocabularyPreferences: vocabularyPreferences ?? [],
  };
}

/**
 * Validate that an object has the expected shape for a hypothesis
 */
export interface ValidatedHypothesis {
  content: string;
  category: string;
  confidence: number;
  evidence: string[];
}

export function validateHypothesis(parsed: unknown): ValidatedHypothesis | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const content = validateStringField(obj.content ?? obj.hypothesis, "hypothesis.content");
  if (content === null) return null; // Content is required

  const category = validateStringField(obj.category, "hypothesis.category") ?? "general";
  const confidence = validateNumberField(obj.confidence, 0, 1) ?? 0.5;
  const evidence = validateStringArray(
    obj.evidence ?? obj.supportingEvidence,
    "hypothesis.evidence",
  );

  return {
    content,
    category,
    confidence,
    evidence: evidence ?? [],
  };
}

/**
 * Validate that a string is safe to store in the database
 * Returns null if corrupted, otherwise returns the sanitized string
 */
export function sanitizeBeforeWrite(content: string, table: string): string | null {
  if (containsCorruption(content)) {
    console.error(`[validator] Blocked corrupted write to ${table}: ${content.slice(0, 100)}...`);
    return null;
  }
  return content;
}

/**
 * Check if an entire object contains any corrupted string values (deep check)
 */
export function objectContainsCorruption(obj: unknown, path = ""): boolean {
  if (typeof obj === "string") {
    if (containsCorruption(obj)) {
      console.warn(`[validator] Corruption found at path "${path}": ${obj.slice(0, 80)}...`);
      return true;
    }
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.some((item, i) => objectContainsCorruption(item, `${path}[${i}]`));
  }

  if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj).some(([key, value]) =>
      objectContainsCorruption(value, path ? `${path}.${key}` : key),
    );
  }

  return false;
}
