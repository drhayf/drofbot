/**
 * Dashboard Type Definitions — Barrel Export
 *
 * Single import point for all dashboard API contract types.
 */

export type {
  CardWeather,
  GateWeather,
  SolarWeather,
  LunarWeather,
  TransitData,
  TransitsWeather,
  CosmicSynthesis,
  CosmicWeather,
  CosmicCurrentResponse,
  CosmicSynthesisResponse,
} from "./cosmic";

export type { PlayerStats, Quest, RankId } from "./progression";
export { RANK_TITLES } from "./progression";

export type { Evidence, Hypothesis, PatternSummary } from "./intelligence";

export type { JournalEntry, JournalCosmicContext } from "./journal";

export type {
  IdentityProfile,
  VaultSynthesis,
  VoiceProfile,
  MemoryStats,
  RelationshipData,
  IdentityPageData,
} from "./identity";
