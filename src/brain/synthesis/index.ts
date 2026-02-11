/**
 * Synthesis Module — Public API
 *
 * Re-exports the core synthesis components:
 * - Master Synthesis Generator (§5a)
 * - Self-Model & Relationship Model (§5b)
 * - Synthesis Cron Runner (§5d)
 */

// Master Synthesis
export {
  SynthesisEngine,
  truncate,
  renderCosmicWeather,
  renderHarmony,
  renderProfile,
  renderIntelligence,
  renderRelationship,
  assembleSynthesis,
  type MasterSynthesis,
  type SelfModel,
  type RelationshipModel,
  type SynthesisDeps,
} from "./master.js";

// Synthesis Runner
export {
  runSynthesisCycle,
  getSynthesisEngine,
  configureSynthesisEngine,
  resetSynthesisSingleton,
  type SynthesisRunResult,
} from "./synthesis-runner.js";
