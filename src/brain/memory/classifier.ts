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
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { OpenClawConfig } from "../../shared/config/config.js";
import { getApiKeyForModel, requireApiKey } from "../agent-runner/model-auth.js";
import { resolveDefaultModelForAgent } from "../agent-runner/model-selection.js";
import { resolveModel } from "../agent-runner/pi-embedded-runner/model.js";
import type { BankName } from "./banks/base.js";

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
    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as {
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
    } catch (err) {
      log.warn(`Failed to parse classification JSON: ${raw.slice(0, 200)}`);
      return { shouldStore: false, banks: [] };
    }
  }
}
