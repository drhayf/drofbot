/**
 * Agent tools for conscious structured memory control.
 *
 * `memory_store`             — explicitly store a fact/event/procedure/relationship
 * `memory_search_structured` — explicitly search the structured memory banks
 *
 * These complement the existing `memory_search` (QMD/markdown) tool.
 * The agent can use both — QMD for markdown-file memory, structured for
 * the four-bank Supabase-backed memory.
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../../shared/config/config.js";
import type { AnyAgentTool } from "./common.js";
import { isSupabaseConfigured } from "../../../shared/database/client.js";
import { getDrofbotMemory } from "../../memory/drofbot-memory.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const BANK_ENUM = Type.Unsafe<string>({
  type: "string",
  enum: ["episodic", "semantic", "procedural", "relational"],
});

const MemoryStoreSchema = Type.Object({
  bank: BANK_ENUM,
  content: Type.String({ description: "The text content of the memory to store." }),
  metadata: Type.Optional(
    Type.Object(
      {},
      {
        additionalProperties: true,
        description:
          "Bank-specific metadata. Semantic: { category, confidence, source }. Episodic: { channel, topic, session, participants }. Procedural: { trigger_pattern, steps }. Relational: { entity_a, entity_b, relationship }.",
      },
    ),
  ),
});

const MemorySearchStructuredSchema = Type.Object({
  query: Type.String({ description: "Natural-language search query." }),
  banks: Type.Optional(
    Type.Array(BANK_ENUM, {
      description: "Banks to search. Defaults to all four banks.",
    }),
  ),
  limit: Type.Optional(Type.Number({ description: "Max results per bank. Default 10." })),
});

// ---------------------------------------------------------------------------
// memory_store
// ---------------------------------------------------------------------------

export function createMemoryStoreTool(options: { config?: OpenClawConfig }): AnyAgentTool | null {
  if (!options.config) return null;
  if (!isSupabaseConfigured()) return null;

  return {
    label: "Memory Store",
    name: "memory_store",
    description:
      "Explicitly store a memory in a specific structured memory bank. " +
      "Use for facts worth remembering long-term (semantic), events/decisions (episodic), " +
      "learned procedures (procedural), or entity relationships (relational). " +
      "This is IN ADDITION to the automatic post-turn classification — use it when " +
      "you want to be deliberate about what gets stored.",
    parameters: MemoryStoreSchema,
    execute: async (_toolCallId, params) => {
      const bank = readStringParam(params, "bank", { required: true });
      const content = readStringParam(params, "content", { required: true });
      const metadata = (params.metadata ?? {}) as Record<string, unknown>;

      const memory = getDrofbotMemory();
      if (!memory.isStructuredMemoryAvailable) {
        return jsonResult({
          stored: false,
          error: "Structured memory unavailable (Supabase not configured).",
        });
      }

      try {
        let id: string | null = null;

        switch (bank) {
          case "semantic":
            id = await memory.semantic.store({
              content,
              category: typeof metadata.category === "string" ? metadata.category : undefined,
              confidence: typeof metadata.confidence === "number" ? metadata.confidence : undefined,
              source: typeof metadata.source === "string" ? metadata.source : undefined,
            });
            break;

          case "episodic":
            id = await memory.episodic.store({
              content,
              context: {
                channel: typeof metadata.channel === "string" ? metadata.channel : undefined,
                topic: typeof metadata.topic === "string" ? metadata.topic : undefined,
                session: typeof metadata.session === "string" ? metadata.session : undefined,
                participants: Array.isArray(metadata.participants)
                  ? metadata.participants
                  : undefined,
              },
              importance: typeof metadata.importance === "number" ? metadata.importance : undefined,
            });
            break;

          case "procedural":
            id = await memory.procedural.store({
              content,
              triggerPattern:
                typeof metadata.trigger_pattern === "string" ? metadata.trigger_pattern : undefined,
              steps: Array.isArray(metadata.steps) ? metadata.steps : undefined,
            });
            break;

          case "relational": {
            const entityA = typeof metadata.entity_a === "string" ? metadata.entity_a : undefined;
            const entityB = typeof metadata.entity_b === "string" ? metadata.entity_b : undefined;
            const relationship =
              typeof metadata.relationship === "string" ? metadata.relationship : undefined;

            if (!entityA || !entityB || !relationship) {
              return jsonResult({
                stored: false,
                error: "Relational bank requires metadata: entity_a, entity_b, relationship.",
              });
            }

            id = await memory.relational.store({
              entityA,
              entityB,
              relationship,
              metadata,
            });
            break;
          }

          default:
            return jsonResult({
              stored: false,
              error: `Unknown bank "${bank}". Must be episodic, semantic, procedural, or relational.`,
            });
        }

        return jsonResult({ stored: true, bank, id });
      } catch (err) {
        return jsonResult({
          stored: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// memory_search_structured
// ---------------------------------------------------------------------------

export function createMemorySearchStructuredTool(options: {
  config?: OpenClawConfig;
}): AnyAgentTool | null {
  if (!options.config) return null;
  if (!isSupabaseConfigured()) return null;

  return {
    label: "Structured Memory Search",
    name: "memory_search_structured",
    description:
      "Search the structured memory banks (episodic, semantic, procedural, relational) " +
      "using natural-language queries with vector similarity. " +
      "Returns results with bank name, content, similarity score, and metadata. " +
      "This is IN ADDITION to the QMD-based memory_search — use memory_search for " +
      "MEMORY.md files and this tool for the structured Supabase-backed memory banks.",
    parameters: MemorySearchStructuredSchema,
    execute: async (_toolCallId, params) => {
      const query = readStringParam(params, "query", { required: true });
      const limit = readNumberParam(params, "limit", { integer: true }) ?? 10;
      const rawBanks = params.banks;
      const banks: string[] =
        Array.isArray(rawBanks) && rawBanks.length > 0
          ? rawBanks.filter((b): b is string => typeof b === "string")
          : ["episodic", "semantic", "procedural", "relational"];

      const memory = getDrofbotMemory();
      if (!memory.isStructuredMemoryAvailable) {
        return jsonResult({
          results: [],
          error: "Structured memory unavailable (Supabase not configured).",
        });
      }

      try {
        const allResults: Array<{
          bank: string;
          content: string;
          similarity: number;
          metadata: Record<string, unknown>;
        }> = [];

        const searchOpts = { query, limit };

        const searches = banks.map(async (bankName) => {
          switch (bankName) {
            case "episodic": {
              const results = await memory.episodic.search(searchOpts);
              for (const r of results) {
                allResults.push({
                  bank: "episodic",
                  content: r.entry.content,
                  similarity: r.similarity,
                  metadata: {
                    id: r.entry.id,
                    context: r.entry.context,
                    importance: r.entry.importance,
                    timestamp: r.entry.created_at,
                  },
                });
              }
              break;
            }
            case "semantic": {
              const results = await memory.semantic.search(searchOpts);
              for (const r of results) {
                allResults.push({
                  bank: "semantic",
                  content: r.entry.content,
                  similarity: r.similarity,
                  metadata: {
                    id: r.entry.id,
                    category: r.entry.category,
                    confidence: r.entry.confidence,
                    source: r.entry.source,
                  },
                });
              }
              break;
            }
            case "procedural": {
              const results = await memory.procedural.search(searchOpts);
              for (const r of results) {
                allResults.push({
                  bank: "procedural",
                  content: r.entry.content,
                  similarity: r.similarity,
                  metadata: {
                    id: r.entry.id,
                    trigger_pattern: r.entry.trigger_pattern,
                    steps: r.entry.steps,
                  },
                });
              }
              break;
            }
            case "relational": {
              const results = await memory.relational.search(searchOpts);
              for (const r of results) {
                allResults.push({
                  bank: "relational",
                  content: `${r.entry.entity_a} —[${r.entry.relationship}]→ ${r.entry.entity_b}`,
                  similarity: r.similarity,
                  metadata: {
                    id: r.entry.id,
                    entity_a: r.entry.entity_a,
                    entity_b: r.entry.entity_b,
                    relationship: r.entry.relationship,
                  },
                });
              }
              break;
            }
          }
        });

        await Promise.all(searches);

        // Sort by similarity (highest first)
        allResults.sort((a, b) => b.similarity - a.similarity);

        return jsonResult({
          results: allResults,
          banks_searched: banks,
          total: allResults.length,
        });
      } catch (err) {
        return jsonResult({
          results: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
