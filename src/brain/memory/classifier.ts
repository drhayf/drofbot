/**
 * Memory Classifier
 *
 * Given a piece of information from a conversation, determines:
 * 1. Should this be stored as a durable memory? (not everything should be)
 * 2. Which bank(s) should it go to?
 * 3. What metadata should be attached?
 *
 * Uses a lightweight LLM call with a classification prompt.
 */

import { completeSimple, type TextContent } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../shared/config/config.js";
import type { BankName } from "./banks/base.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getApiKeyForModel, requireApiKey } from "../agent-runner/model-auth.js";
import { resolveDefaultModelForAgent } from "../agent-runner/model-selection.js";
import { resolveModel } from "../agent-runner/pi-embedded-runner/model.js";

const log = createSubsystemLogger("memory/classifier");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassificationEntry {
  bank: BankName;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ClassificationResult {
  shouldStore: boolean;
  banks: ClassificationEntry[];
}

export interface ClassifyOptions {
  cfg: OpenClawConfig;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Classification prompt
// ---------------------------------------------------------------------------

const CLASSIFICATION_SYSTEM_PROMPT = `You are a memory classifier for Drofbot, a personal AI agent.
Given a piece of information from a conversation, determine:

1. Should this be stored as a durable memory? Say NO for:
   - Greetings, small talk, filler ("hello", "thanks", "ok")
   - Questions that were fully answered (store the answer, not the question)
   - Repetitions of already-known information
   - Meta-conversation about how to talk (unless it reveals a preference)

2. Which memory bank(s) should it go to?
   - EPISODIC: Events, decisions, experiences, things that happened (timestamped)
   - SEMANTIC: Facts, preferences, knowledge, beliefs (timeless truths)
   - PROCEDURAL: Workflows, habits, how-to instructions, learned procedures
   - RELATIONAL: Connections between entities, dependencies, relationships

3. Reformulate the content for each bank (make it self-contained and retrievable).

Respond ONLY with valid JSON, no markdown fences:
{"shouldStore":true,"banks":[{"bank":"semantic","content":"D prefers TypeScript for all projects","metadata":{"category":"preference","confidence":0.9}}]}

If nothing should be stored:
{"shouldStore":false,"banks":[]}`;

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export class MemoryClassifier {
  /**
   * Classify a conversation exchange and determine what to store.
   */
  async classify(text: string, options: ClassifyOptions): Promise<ClassificationResult> {
    try {
      const raw = await this.callLLM(text, options);
      return this.parseResult(raw);
    } catch (err) {
      log.error(`Classification failed: ${err instanceof Error ? err.message : String(err)}`);
      return { shouldStore: false, banks: [] };
    }
  }

  /**
   * Make the LLM call for classification.
   */
  private async callLLM(text: string, options: ClassifyOptions): Promise<string> {
    const ref = resolveDefaultModelForAgent({ cfg: options.cfg });
    const resolved = resolveModel(ref.provider, ref.model, undefined, options.cfg);

    if (!resolved.model) {
      throw new Error(resolved.error ?? `Unknown model: ${ref.provider}/${ref.model}`);
    }

    const apiKey = requireApiKey(
      await getApiKeyForModel({ model: resolved.model, cfg: options.cfg }),
      ref.provider,
    );

    const res = await completeSimple(
      resolved.model,
      {
        systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user" as const,
            content: text,
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey,
        maxTokens: 512,
        temperature: 0,
        signal: options.signal,
      },
    );

    return res.content
      .filter((b): b is TextContent => b.type === "text")
      .map((b) => b.text.trim())
      .join("")
      .trim();
  }

  /**
   * Parse the LLM's JSON response into a ClassificationResult.
   */
  private parseResult(raw: string): ClassificationResult {
    // Step 1: Strip markdown code fences (handles multiline and various formats)
    let cleaned = raw;

    // Remove opening fence - handle ```json, ```, or any variant at start (with leading whitespace)
    cleaned = cleaned.replace(/^\s*```(?:json)?\s*/i, "");

    // Remove closing fence at end
    cleaned = cleaned.replace(/\s*```\s*$/i, "");

    // Step 2: Try to extract JSON - handle double-wrapping issue (banks":[[ instead of banks":[)
    // Also handle formatted multi-line JSON
    try {
      // First try parsing as-is (works for both compact and formatted JSON)
      return this.parseClassificationJson(cleaned);
    } catch {
      // Try to fix double-wrapping: {"banks":[[ -> {"banks":[
      const doubleWrapped = cleaned.replace(/"banks":\s*\[\s*\[/, '"banks": [');
      if (doubleWrapped !== cleaned) {
        try {
          return this.parseClassificationJson(doubleWrapped);
        } catch {
          // Fall through
        }
      }

      // Try to extract JSON object using a more careful approach
      // Look for the outermost braces
      const trimmed = cleaned.trim();
      if (trimmed.startsWith("{")) {
        let depth = 0;
        let endIdx = -1;
        for (let i = 0; i < trimmed.length; i++) {
          if (trimmed[i] === "{") depth++;
          else if (trimmed[i] === "}") {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        if (endIdx > 0) {
          try {
            return this.parseClassificationJson(trimmed.substring(0, endIdx));
          } catch {
            // Fall through to error
          }
        }
      }
    }

    // If all parsing attempts fail, log and return empty
    log.warn(`Failed to parse classification JSON: ${raw.slice(0, 200)}`);
    return { shouldStore: false, banks: [] };
  }

  /**
   * Parse JSON string into ClassificationResult
   */
  private parseClassificationJson(jsonString: string): ClassificationResult {
    const parsed = JSON.parse(jsonString) as {
      shouldStore?: boolean;
      banks?: Array<{
        bank?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      }>;
    };

    if (!parsed.shouldStore) {
      return { shouldStore: false, banks: [] };
    }

    const validBanks = new Set<string>(["episodic", "semantic", "procedural", "relational"]);
    const banks: ClassificationEntry[] = (parsed.banks ?? [])
      .filter((b) => b.bank && validBanks.has(b.bank) && b.content)
      .map((b) => ({
        bank: b.bank as BankName,
        content: b.content!,
        metadata: b.metadata ?? {},
      }));

    return {
      shouldStore: banks.length > 0,
      banks,
    };
  }
}
