import type { CosmicSynthesis, Hypothesis, PatternSummary, PlayerStats, Quest } from "./index";

export interface IdentityProfile {
  birthData: {
    datetime: string;
    latitude: number;
    longitude: number;
    timezone: string;
    locationName?: string;
  } | null;
  enabledSystems: string[] | null;
  primaryChannel: string | null;
  humanDesign?: {
    type: string;
    profile: string;
    strategy: string;
    authority: string;
    definition: string;
  };
  cardology?: {
    birthCard: string;
    birthCardSuit: string | null;
    birthCardRank: number;
    zodiacSign: string;
    planetaryRuler: string;
    currentPlanet: string;
    currentCard: string;
    periodDay: number;
    periodProgress: number;
    firstKarmaCard: string | null;
    secondKarmaCard: string | null;
  };
  confirmedFacts: Array<{
    content: string;
    confidence: number;
    category: string;
  }>;
}

export interface VaultSynthesis {
  synthesis: {
    overview: string;
    narrative: string;
    rendered?: string;
    dataPoints?: number;
    lastUpdated?: string;
  };
}

export interface VoiceProfile {
  profile: {
    analysis: {
      sentenceLength: number;
      formality: number;
      vocabularyRichness: number;
      emotionalExpressiveness: number;
      [key: string]: number; // Adaptive dimensions
    };
    descriptors: string[];
    dominantTone: string;
    lastUpdated?: string;
  } | null;
}

export interface MemoryStats {
  stats: {
    episodic: { count: number };
    semantic: { count: number };
    procedural: { count: number };
    relational: { count: number };
    [key: string]: { count: number };
  };
}

export interface RelationshipData {
  operator: {
    birthMoment: { datetime: string };
    harmony: CosmicSynthesis;
  };
  agent: {
    birthMoment: { datetime: string };
    harmony: CosmicSynthesis;
  };
}

export interface IdentityPageData {
  profile: IdentityProfile | null;
  vault: VaultSynthesis | null;
  voice: VoiceProfile | null;
  memory: MemoryStats | null;
  hypotheses: Hypothesis[];
  patterns: PatternSummary[];
  progression: {
    stats: PlayerStats | null;
    quests: Quest[];
  };
  relationship: RelationshipData | null;
  preferences: Record<string, Record<string, unknown> | undefined>;
}
