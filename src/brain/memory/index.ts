// Existing exports — preserved for backward compatibility
export { MemoryIndexManager } from "./manager.js";
export type {
  MemoryEmbeddingProbeResult,
  MemorySearchManager,
  MemorySearchResult,
} from "./types.js";
export { getMemorySearchManager, type MemorySearchManagerResult } from "./search-manager.js";

// Phase 2: Structured memory banks
export { DrofbotMemory, getDrofbotMemory } from "./drofbot-memory.js";
export { EpisodicMemoryBank } from "./banks/episodic.js";
export { SemanticMemoryBank } from "./banks/semantic.js";
export { ProceduralMemoryBank } from "./banks/procedural.js";
export { RelationalMemoryBank } from "./banks/relational.js";
export { MemoryClassifier, type ClassificationResult, type ClassificationEntry } from "./classifier.js";
export {
  MemoryRetriever,
  type RetrievalResult,
  type RetrievalOptions,
} from "./retriever.js";
export type { BankName, SearchOptions, SearchResult, StoreOptions } from "./banks/base.js";
