/**
 * Operator Identity Module — Barrel Export
 * Phase: 6
 *
 * The Operator Identity Vault: voice profile, reference documents,
 * interaction preferences, and identity synthesis.
 */

export type {
  VaultCategory,
  VaultSource,
  VaultEntry,
  VaultEntryCreate,
  VoiceProfile,
  InteractionPreferences,
  ReferenceDocument,
  OperatorIdentitySynthesis,
} from "./types.js";

export {
  DEFAULT_VOICE_PROFILE,
  DEFAULT_INTERACTION_PREFS,
  EMPTY_IDENTITY_SYNTHESIS,
} from "./types.js";

export {
  upsertVaultEntry,
  getVaultEntry,
  getVaultEntriesByCategory,
  deleteVaultEntry,
  deleteVaultEntryById,
  getVoiceProfile,
  updateVoiceProfile,
  getInteractionPreferences,
  updateInteractionPreferences,
  getIdentitySynthesis,
  storeIdentitySynthesis,
  getReferenceDocuments,
  storeReferenceDocument,
  deleteReferenceDocument,
  getManualNotes,
  upsertManualNote,
  resetVault,
} from "./vault.js";

export { analyzeConversationTurn, analyzeEngagementSignals } from "./voice-analyzer.js";

export { ingestDocument, type IngestResult } from "./reference-ingester.js";

export { generateOperatorSynthesis } from "./identity-synthesis.js";
