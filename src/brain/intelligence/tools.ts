/**
 * Agent tools for interacting with the Intelligence subsystem.
 *
 * Tools:
 *   hypothesis_list     — list hypotheses filtered by status
 *   hypothesis_detail   — full details of a hypothesis
 *   hypothesis_confirm  — operator confirms a hypothesis
 *   hypothesis_reject   — operator rejects a hypothesis
 *   hypothesis_create   — manually create a hypothesis
 *   pattern_list        — list detected patterns from Observer
 *   pattern_detail      — get details of a detected pattern
 *
 * These follow the same factory pattern as structured-memory-tool.ts.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../agent-runner/tools/common.js";
import { jsonResult, readNumberParam, readStringParam } from "../agent-runner/tools/common.js";
import { EvidenceType } from "./confidence.js";
import {
  HypothesisEngine,
  HypothesisStatus,
  HypothesisType,
  type Hypothesis,
} from "./hypothesis.js";
import { type Pattern, PatternType } from "./observer.js";

// ─── Shared State ──────────────────────────────────────────────
//
// The intelligence tools operate on in-memory engine instances.
// In production these are populated from semantic memory on startup
// and flushed back after mutations.  For now we provide a getter/setter
// pair so the agent runner can inject the live engines.

let _hypothesisEngine: HypothesisEngine | null = null;
let _patterns: Pattern[] = [];

export function setIntelligenceState(engine: HypothesisEngine, patterns?: Pattern[]): void {
  _hypothesisEngine = engine;
  if (patterns) _patterns = patterns;
}

export function getIntelligenceState(): {
  engine: HypothesisEngine | null;
  patterns: Pattern[];
} {
  return { engine: _hypothesisEngine, patterns: _patterns };
}

// ─── Schemas ───────────────────────────────────────────────────

const STATUS_VALUES = ["active", "confirmed", "rejected", "stale", "all"] as const;

const HypothesisListSchema = Type.Object({
  status: Type.Optional(
    Type.Unsafe<string>({
      type: "string",
      enum: [...STATUS_VALUES],
      description:
        "Filter by status: active (forming+testing), confirmed, rejected, stale, or all. Default: active.",
    }),
  ),
});

const HypothesisDetailSchema = Type.Object({
  id: Type.String({ description: "Hypothesis ID." }),
});

const HypothesisConfirmSchema = Type.Object({
  id: Type.String({ description: "Hypothesis ID to confirm." }),
  note: Type.Optional(Type.String({ description: "Optional confirmation note." })),
});

const HypothesisRejectSchema = Type.Object({
  id: Type.String({ description: "Hypothesis ID to reject." }),
  reason: Type.Optional(Type.String({ description: "Optional rejection reason." })),
});

const HypothesisCreateSchema = Type.Object({
  statement: Type.String({ description: "The hypothesis statement." }),
  category: Type.String({
    description: "Category: sensitivity, productivity, cosmic, personality, cyclical, behavioral.",
  }),
  initialEvidence: Type.Optional(
    Type.String({ description: "Initial evidence or observation supporting this hypothesis." }),
  ),
});

const PatternListSchema = Type.Object({
  type: Type.Optional(Type.String({ description: "Filter by pattern type." })),
  minConfidence: Type.Optional(
    Type.Number({ description: "Minimum confidence threshold (0-1). Default 0." }),
  ),
});

const PatternDetailSchema = Type.Object({
  id: Type.String({ description: "Pattern index (0-based) from pattern_list results." }),
});

// ─── Hypothesis Summary ────────────────────────────────────────

function summarizeHypothesis(h: Hypothesis) {
  return {
    id: h.id,
    statement: h.statement,
    confidence: Math.round(h.confidence * 1000) / 1000,
    status: h.status,
    category: h.category,
    type: h.type,
    evidenceCount: h.evidenceRecords.length,
    lastUpdated: h.updatedAt.toISOString(),
  };
}

// ─── Tool Factories ────────────────────────────────────────────

export function createHypothesisListTool(): AnyAgentTool {
  return {
    label: "Hypothesis List",
    name: "hypothesis_list",
    description:
      "List hypotheses filtered by status. Returns id, statement, confidence, status, evidence count, last updated.",
    parameters: HypothesisListSchema,
    execute: async (_toolCallId, params) => {
      const engine = _hypothesisEngine;
      if (!engine) {
        return jsonResult({ hypotheses: [], error: "Intelligence engine not initialized." });
      }

      const statusFilter = readStringParam(params, "status") ?? "active";

      let hypotheses: Hypothesis[];
      switch (statusFilter) {
        case "active":
          hypotheses = engine.getActive();
          break;
        case "confirmed":
          hypotheses = engine.getConfirmed();
          break;
        case "rejected":
          hypotheses = engine.getAll().filter((h) => h.status === HypothesisStatus.REJECTED);
          break;
        case "stale":
          hypotheses = engine.getAll().filter((h) => h.status === HypothesisStatus.STALE);
          break;
        default:
          hypotheses = engine.getAll();
          break;
      }

      return jsonResult({
        count: hypotheses.length,
        hypotheses: hypotheses.map(summarizeHypothesis),
      });
    },
  };
}

export function createHypothesisDetailTool(): AnyAgentTool {
  return {
    label: "Hypothesis Detail",
    name: "hypothesis_detail",
    description:
      "Get full details of a hypothesis including all evidence records, confidence history, and cosmic context.",
    parameters: HypothesisDetailSchema,
    execute: async (_toolCallId, params) => {
      const engine = _hypothesisEngine;
      if (!engine) {
        return jsonResult({ error: "Intelligence engine not initialized." });
      }

      const id = readStringParam(params, "id", { required: true });
      const hypothesis = engine.get(id);
      if (!hypothesis) {
        return jsonResult({ error: `Hypothesis "${id}" not found.` });
      }

      return jsonResult({
        id: hypothesis.id,
        type: hypothesis.type,
        status: hypothesis.status,
        statement: hypothesis.statement,
        category: hypothesis.category,
        confidence: Math.round(hypothesis.confidence * 1000) / 1000,
        evidenceRecords: hypothesis.evidenceRecords.map((e) => ({
          type: e.evidenceType,
          source: e.source,
          description: e.description,
          weight: e.effectiveWeight,
          timestamp: e.timestamp.toISOString(),
        })),
        confidenceHistory: hypothesis.confidenceHistory.map((s) => ({
          value: Math.round(s.value * 1000) / 1000,
          source: s.source,
          timestamp: s.timestamp.toISOString(),
        })),
        periodEvidenceCount: hypothesis.periodEvidenceCount,
        gateEvidenceCount: hypothesis.gateEvidenceCount,
        createdAt: hypothesis.createdAt.toISOString(),
        updatedAt: hypothesis.updatedAt.toISOString(),
        lastEvidenceAt: hypothesis.lastEvidenceAt.toISOString(),
      });
    },
  };
}

export function createHypothesisConfirmTool(): AnyAgentTool {
  return {
    label: "Hypothesis Confirm",
    name: "hypothesis_confirm",
    description:
      "Record operator confirmation of a hypothesis. Adds USER_CONFIRMATION evidence (weight 1.00) and recalculates confidence.",
    parameters: HypothesisConfirmSchema,
    execute: async (_toolCallId, params) => {
      const engine = _hypothesisEngine;
      if (!engine) {
        return jsonResult({ error: "Intelligence engine not initialized." });
      }

      const id = readStringParam(params, "id", { required: true });
      const note = readStringParam(params, "note");

      const hypothesis = engine.get(id);
      if (!hypothesis) {
        return jsonResult({ error: `Hypothesis "${id}" not found.` });
      }

      const update = engine.userConfirm(id);
      if (!update) {
        return jsonResult({ error: `Failed to confirm hypothesis "${id}".` });
      }

      // Append note to the last evidence record if provided
      if (note && hypothesis.evidenceRecords.length > 0) {
        const lastEvidence = hypothesis.evidenceRecords[hypothesis.evidenceRecords.length - 1];
        lastEvidence.description = `User confirmed this hypothesis: ${note}`;
      }

      return jsonResult({
        confirmed: true,
        id: update.hypothesisId,
        previousConfidence: Math.round(update.previousConfidence * 1000) / 1000,
        newConfidence: Math.round(update.newConfidence * 1000) / 1000,
        previousStatus: update.previousStatus,
        newStatus: update.newStatus,
      });
    },
  };
}

export function createHypothesisRejectTool(): AnyAgentTool {
  return {
    label: "Hypothesis Reject",
    name: "hypothesis_reject",
    description:
      "Record operator rejection of a hypothesis. Adds USER_REJECTION evidence (weight -1.50) and recalculates confidence.",
    parameters: HypothesisRejectSchema,
    execute: async (_toolCallId, params) => {
      const engine = _hypothesisEngine;
      if (!engine) {
        return jsonResult({ error: "Intelligence engine not initialized." });
      }

      const id = readStringParam(params, "id", { required: true });
      const reason = readStringParam(params, "reason");

      const hypothesis = engine.get(id);
      if (!hypothesis) {
        return jsonResult({ error: `Hypothesis "${id}" not found.` });
      }

      const update = engine.userReject(id);
      if (!update) {
        return jsonResult({ error: `Failed to reject hypothesis "${id}".` });
      }

      // Append reason to the last evidence record if provided
      if (reason && hypothesis.evidenceRecords.length > 0) {
        const lastEvidence = hypothesis.evidenceRecords[hypothesis.evidenceRecords.length - 1];
        lastEvidence.description = `User rejected this hypothesis: ${reason}`;
      }

      return jsonResult({
        rejected: true,
        id: update.hypothesisId,
        previousConfidence: Math.round(update.previousConfidence * 1000) / 1000,
        newConfidence: Math.round(update.newConfidence * 1000) / 1000,
        previousStatus: update.previousStatus,
        newStatus: update.newStatus,
      });
    },
  };
}

export function createHypothesisCreateTool(): AnyAgentTool {
  return {
    label: "Hypothesis Create",
    name: "hypothesis_create",
    description:
      "Manually create a hypothesis from operator statement. Use when operator shares a belief about themselves.",
    parameters: HypothesisCreateSchema,
    execute: async (_toolCallId, params) => {
      const engine = _hypothesisEngine;
      if (!engine) {
        return jsonResult({ error: "Intelligence engine not initialized." });
      }

      const statement = readStringParam(params, "statement", { required: true });
      const category = readStringParam(params, "category", { required: true });
      const initialEvidence = readStringParam(params, "initialEvidence");

      // Create via generateFromPatterns with a synthetic pattern
      // This preserves the engine's deduplication logic.
      const syntheticPattern: Pattern = {
        type: PatternType.THEME_ALIGNMENT,
        confidence: 0.5,
        description: statement,
        pValue: 0.05,
        effectSize: 0.5,
        evidenceType: initialEvidence
          ? EvidenceType.USER_CONFIRMATION
          : EvidenceType.OBSERVER_PATTERN,
      };

      // We need to use the internal pattern → hypothesis mapping.
      // Instead, directly create via the engine to maintain consistency.
      const generated = engine.generateFromPatterns([
        {
          ...syntheticPattern,
          // The pattern type maps to a hypothesis type internally
        },
      ]);

      if (generated.length === 0) {
        return jsonResult({
          created: false,
          reason: "Duplicate hypothesis — a similar one already exists.",
        });
      }

      const hypothesis = generated[0];
      // Override category from user input
      (hypothesis as { category: string }).category = category;

      // If user provided initial evidence, add it
      if (initialEvidence) {
        engine.testEvidence(
          EvidenceType.USER_CONFIRMATION,
          "operator",
          initialEvidence,
          (h) => h.id === hypothesis.id,
        );
      }

      return jsonResult({
        created: true,
        hypothesis: summarizeHypothesis(hypothesis),
      });
    },
  };
}

export function createPatternListTool(): AnyAgentTool {
  return {
    label: "Pattern List",
    name: "pattern_list",
    description:
      "List detected patterns from the Observer. Shows pattern type, description, confidence, and supporting data.",
    parameters: PatternListSchema,
    execute: async (_toolCallId, params) => {
      const typeFilter = readStringParam(params, "type");
      const minConfidence = readNumberParam(params, "minConfidence") ?? 0;

      let filtered = _patterns;

      if (typeFilter) {
        const upper = typeFilter.toUpperCase();
        filtered = filtered.filter((p) => p.type === upper);
      }

      filtered = filtered.filter((p) => p.confidence >= minConfidence);

      return jsonResult({
        count: filtered.length,
        patterns: filtered.map((p, idx) => ({
          index: idx,
          type: p.type,
          description: p.description,
          confidence: Math.round(p.confidence * 1000) / 1000,
          pValue: Math.round(p.pValue * 10000) / 10000,
          effectSize: Math.round(p.effectSize * 1000) / 1000,
          planet: p.planet ?? null,
          sunGate: p.sunGate ?? null,
        })),
      });
    },
  };
}

export function createPatternDetailTool(): AnyAgentTool {
  return {
    label: "Pattern Detail",
    name: "pattern_detail",
    description:
      "Get full details of a detected pattern including statistical measures and cosmic correlations.",
    parameters: PatternDetailSchema,
    execute: async (_toolCallId, params) => {
      const idStr = readStringParam(params, "id", { required: true });
      const idx = parseInt(idStr, 10);

      if (Number.isNaN(idx) || idx < 0 || idx >= _patterns.length) {
        return jsonResult({
          error: `Invalid pattern index "${idStr}". Use pattern_list to see available indices.`,
        });
      }

      const p = _patterns[idx];
      return jsonResult({
        index: idx,
        type: p.type,
        description: p.description,
        confidence: Math.round(p.confidence * 1000) / 1000,
        pValue: Math.round(p.pValue * 10000) / 10000,
        effectSize: Math.round(p.effectSize * 1000) / 1000,
        evidenceType: p.evidenceType,
        planet: p.planet ?? null,
        sunGate: p.sunGate ?? null,
        gateLine: p.gateLine ?? null,
        moonPhase: p.moonPhase ?? null,
        hourOfDay: p.hourOfDay ?? null,
        dayOfWeek: p.dayOfWeek ?? null,
      });
    },
  };
}

// ─── Convenience: all intelligence tools ───────────────────────

export function createIntelligenceTools(): AnyAgentTool[] {
  return [
    createHypothesisListTool(),
    createHypothesisDetailTool(),
    createHypothesisConfirmTool(),
    createHypothesisRejectTool(),
    createHypothesisCreateTool(),
    createPatternListTool(),
    createPatternDetailTool(),
  ];
}
