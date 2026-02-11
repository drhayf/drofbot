/**
 * Soul Archive — Portable Identity Export
 *
 * Exports the complete intelligence state as a self-contained archive:
 * - Master Synthesis (operator profile)
 * - Self-Model (Drofbot's identity)
 * - All confirmed hypotheses with evidence chains
 * - All active patterns with confidence scores
 * - Core semantic memories
 * - Relationship model
 * - Progression state (rank, XP, quest history)
 * - Council configuration (birth moments, enabled systems)
 *
 * Format: JSON + markdown narrative
 * Purpose: Migrate to new infrastructure without losing accumulated intelligence
 *
 * Import: Load archive into a fresh Drofbot instance and it
 * immediately has the personality, knowledge, and understanding
 * of the original — because identity lives in data, not code.
 */

import type { CouncilConfig } from "../../shared/config/types.council.js";
import type { BirthMoment } from "../council/types.js";
import type { Hypothesis } from "../intelligence/hypothesis.js";
import type { PlayerStats, Quest } from "../progression/types.js";
import type { MasterSynthesis, SelfModel, RelationshipModel } from "../synthesis/master.js";
import { getRankForLevel } from "../progression/types.js";

// ─── Archive Types ─────────────────────────────────────────────

export const SOUL_ARCHIVE_VERSION = 1;

export interface SoulArchiveData {
  /** Schema version for forward compatibility */
  version: typeof SOUL_ARCHIVE_VERSION;
  /** When this archive was created */
  exportedAt: string;

  /** Council configuration */
  council: {
    operatorBirth: BirthMoment | null;
    agentBirth: BirthMoment | null;
    config: Partial<CouncilConfig>;
  };

  /** Master synthesis at export time */
  synthesis: MasterSynthesis | null;
  /** Drofbot's self-model */
  selfModel: SelfModel | null;
  /** Relationship model with operator */
  relationshipModel: RelationshipModel | null;

  /** Intelligence state */
  intelligence: {
    confirmedHypotheses: Hypothesis[];
    activeHypotheses: Hypothesis[];
  };

  /** Progression state */
  progression: {
    stats: PlayerStats;
    questHistory: Quest[];
  };

  /** Core semantic memories (summaries) */
  semanticMemories: SemanticMemoryEntry[];

  /** Markdown narrative summary */
  narrative: string;
}

export interface SemanticMemoryEntry {
  category: string;
  content: string;
  storedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  version: number;
  errors: string[];
  warnings: string[];
  stats: {
    hypotheses: number;
    memories: number;
    questsCompleted: number;
    totalXp: number;
    rank: string;
  };
}

// ─── Archive Deps ──────────────────────────────────────────────

export interface SoulArchiveDeps {
  /** Get master synthesis */
  getSynthesis: () => MasterSynthesis | null;
  /** Get self model */
  getSelfModel: () => SelfModel | null;
  /** Get relationship model */
  getRelationshipModel: () => RelationshipModel | null;
  /** Get confirmed hypotheses */
  getConfirmedHypotheses: () => Hypothesis[];
  /** Get active hypotheses */
  getActiveHypotheses: () => Hypothesis[];
  /** Get player stats */
  getPlayerStats: () => PlayerStats;
  /** Get completed quests (all time) */
  getQuestHistory: () => Quest[];
  /** Get core semantic memories */
  getSemanticMemories: () => Promise<SemanticMemoryEntry[]>;
  /** Get council config */
  getCouncilConfig: () => {
    operatorBirth: BirthMoment | null;
    agentBirth: BirthMoment | null;
    config: Partial<CouncilConfig>;
  };
}

export interface SoulArchiveImportDeps {
  /** Import hypotheses */
  importHypotheses: (confirmed: Hypothesis[], active: Hypothesis[]) => Promise<void>;
  /** Import player stats */
  importPlayerStats: (stats: PlayerStats) => Promise<void>;
  /** Import semantic memories */
  importSemanticMemories: (entries: SemanticMemoryEntry[]) => Promise<void>;
  /** Import council config */
  importCouncilConfig: (config: SoulArchiveData["council"]) => Promise<void>;
}

// ─── Soul Archive ──────────────────────────────────────────────

export class SoulArchive {
  /**
   * Export the complete intelligence state as a portable archive.
   */
  async export(deps: SoulArchiveDeps): Promise<SoulArchiveData> {
    const synthesis = deps.getSynthesis();
    const selfModel = deps.getSelfModel();
    const relationshipModel = deps.getRelationshipModel();
    const confirmedHypotheses = deps.getConfirmedHypotheses();
    const activeHypotheses = deps.getActiveHypotheses();
    const stats = deps.getPlayerStats();
    const questHistory = deps.getQuestHistory();
    const semanticMemories = await deps.getSemanticMemories();
    const councilConfig = deps.getCouncilConfig();

    const narrative = this.generateNarrative({
      synthesis,
      selfModel,
      confirmedHypotheses,
      stats,
      semanticMemories,
    });

    return {
      version: SOUL_ARCHIVE_VERSION,
      exportedAt: new Date().toISOString(),
      council: councilConfig,
      synthesis,
      selfModel,
      relationshipModel,
      intelligence: {
        confirmedHypotheses,
        activeHypotheses,
      },
      progression: {
        stats,
        questHistory,
      },
      semanticMemories,
      narrative,
    };
  }

  /**
   * Import an archive into a fresh instance.
   */
  async import(archive: SoulArchiveData, deps: SoulArchiveImportDeps): Promise<void> {
    const verification = this.verify(archive);
    if (!verification.valid) {
      throw new Error(`Invalid archive: ${verification.errors.join("; ")}`);
    }

    await Promise.all([
      deps.importHypotheses(
        archive.intelligence.confirmedHypotheses,
        archive.intelligence.activeHypotheses,
      ),
      deps.importPlayerStats(archive.progression.stats),
      deps.importSemanticMemories(archive.semanticMemories),
      deps.importCouncilConfig(archive.council),
    ]);
  }

  /**
   * Verify an archive's integrity before import.
   */
  verify(archive: SoulArchiveData): VerificationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Version check
    if (!archive.version || archive.version > SOUL_ARCHIVE_VERSION) {
      errors.push(
        `Unsupported version: ${archive.version}. Max supported: ${SOUL_ARCHIVE_VERSION}`,
      );
    }

    // Required fields
    if (!archive.exportedAt) errors.push("Missing exportedAt timestamp");
    if (!archive.intelligence) errors.push("Missing intelligence section");
    if (!archive.progression) errors.push("Missing progression section");
    if (!archive.progression?.stats) errors.push("Missing player stats");

    // Hypothesis validation
    if (archive.intelligence?.confirmedHypotheses) {
      for (const h of archive.intelligence.confirmedHypotheses) {
        if (!h.id || !h.statement) {
          warnings.push(`Hypothesis missing id or statement`);
        }
      }
    }

    // Stats validation
    const stats = archive.progression?.stats;
    if (stats) {
      if (stats.currentLevel < 1) warnings.push("Level below 1");
      if (stats.totalXp < 0) warnings.push("Negative XP");
    }

    const confirmedCount = archive.intelligence?.confirmedHypotheses?.length ?? 0;
    const activeCount = archive.intelligence?.activeHypotheses?.length ?? 0;
    const completedQuests =
      archive.progression?.questHistory?.filter((q) => q.status === "completed").length ?? 0;

    return {
      valid: errors.length === 0,
      version: archive.version ?? 0,
      errors,
      warnings,
      stats: {
        hypotheses: confirmedCount + activeCount,
        memories: archive.semanticMemories?.length ?? 0,
        questsCompleted: completedQuests,
        totalXp: stats?.totalXp ?? 0,
        rank: stats ? getRankForLevel(stats.currentLevel).id : "?",
      },
    };
  }

  /**
   * Generate a human-readable narrative summary of the archive.
   */
  private generateNarrative(data: {
    synthesis: MasterSynthesis | null;
    selfModel: SelfModel | null;
    confirmedHypotheses: Hypothesis[];
    stats: PlayerStats;
    semanticMemories: SemanticMemoryEntry[];
  }): string {
    const lines: string[] = [];
    const rank = getRankForLevel(data.stats.currentLevel);

    lines.push("# Soul Archive — Drofbot Intelligence Export");
    lines.push("");
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push(`Rank: ${rank.id} (${rank.title}) — Level ${data.stats.currentLevel}`);
    lines.push(`Total XP: ${data.stats.totalXp.toLocaleString()}`);
    lines.push(`Sync Rate: ${(data.stats.syncRate * 100).toFixed(0)}%`);
    lines.push(`Streak: ${data.stats.streakDays} days`);
    lines.push("");

    // Confirmed patterns
    if (data.confirmedHypotheses.length > 0) {
      lines.push("## Confirmed Patterns");
      for (const h of data.confirmedHypotheses) {
        lines.push(`- ${h.statement} (${(h.confidence * 100).toFixed(0)}% confidence)`);
      }
      lines.push("");
    }

    // Semantic memory summary
    if (data.semanticMemories.length > 0) {
      const categories = [...new Set(data.semanticMemories.map((m) => m.category))];
      lines.push("## Knowledge Base");
      lines.push(`${data.semanticMemories.length} entries across ${categories.length} categories:`);
      for (const cat of categories) {
        const count = data.semanticMemories.filter((m) => m.category === cat).length;
        lines.push(`- ${cat}: ${count} entries`);
      }
      lines.push("");
    }

    // Profile
    if (data.synthesis?.profile) {
      lines.push("## Operator Profile");
      lines.push(data.synthesis.profile);
      lines.push("");
    }

    lines.push("---");
    lines.push("Identity lives in data, not code.");

    return lines.join("\n").trim();
  }
}
