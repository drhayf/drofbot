/**
 * Identity Module — Drofbot's self-awareness and ecosystem knowledge
 *
 * - Codebase: structural self-knowledge
 * - Ecosystem: upstream OpenClaw monitoring
 * - MoltBook: social presence from genuine state
 * - Soul Archive: portable identity export/import
 */

export {
  scanCodebase,
  renderSnapshot,
  type CodebaseSnapshot,
  type CapabilityMap,
  type RecentChange,
  type CodebaseScanDeps,
} from "./codebase.js";

export {
  checkEcosystem,
  renderEcosystemCheck,
  type EcosystemCheck,
  type UpstreamCommit,
  type EcosystemOpportunity,
  type EcosystemDeps,
} from "./ecosystem.js";

export {
  generateCosmicPost,
  generateAchievementPost,
  generateDiscoveryPost,
  generateMilestonePost,
  type MoltBookPost,
  type PostSource,
  type PersonalityTrait,
  type MoltBookDeps,
} from "./moltbook.js";

export {
  SoulArchive,
  SOUL_ARCHIVE_VERSION,
  type SoulArchiveData,
  type SemanticMemoryEntry,
  type VerificationResult,
  type SoulArchiveDeps,
  type SoulArchiveImportDeps,
} from "./soul-archive.js";
