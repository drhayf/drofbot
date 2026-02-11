/**
 * Progression Module — Public API
 *
 * Re-exports the core progression components:
 * - Types (ranks, quests, XP, sync rate)
 * - Progression Engine (XP, leveling, quest management)
 * - Quest Generator (cosmic, growth, daily quests)
 */

// Types
export {
  RANKS,
  XP_REWARDS,
  INSIGHT_LINKED_MULTIPLIER,
  SYNC_WEIGHT_NEW,
  SYNC_WEIGHT_PREV,
  getRankForLevel,
  xpThresholdForLevel,
  xpToNextLevel,
  calculateQuestXP,
  calculateSyncRate,
  updateStreak,
  type RankId,
  type RankDefinition,
  type QuestDifficulty,
  type QuestType,
  type QuestStatus,
  type QuestSource,
  type Quest,
  type PlayerStats,
  type SyncHistoryEntry,
} from "./types.js";

// Engine
export {
  ProgressionEngine,
  createDefaultStats,
  type XPGainResult,
  type QuestCompletionResult,
  type DailyResetResult,
} from "./engine.js";

// Quest Generator
export {
  generateCosmicQuests,
  generateGrowthQuests,
  generateDailyQuests,
  questFromTemplate,
  type QuestTemplate,
} from "./quest-generator.js";
