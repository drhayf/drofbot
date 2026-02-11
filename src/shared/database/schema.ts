/**
 * Drofbot — Database Schema Types
 *
 * TypeScript types matching the SQL schema in migrations/.
 * Used by the Supabase client for type-safe queries.
 */

// ---------------------------------------------------------------------------
// Memory Banks (Phase 2 — 001_memory_banks.sql)
// ---------------------------------------------------------------------------

export interface MemoryEpisodic {
  id: string;
  content: string;
  embedding?: number[];
  timestamp: string;
  context?: {
    session?: string;
    channel?: string;
    topic?: string;
    participants?: string[];
    decision?: boolean;
    [key: string]: unknown;
  };
  importance: number;
  created_at: string;
  updated_at: string;
}

export type MemoryEpisodicInsert = Omit<MemoryEpisodic, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MemoryEpisodicUpdate = Partial<Omit<MemoryEpisodic, "id" | "created_at">> & {
  updated_at?: string;
};

export interface MemorySemantic {
  id: string;
  content: string;
  embedding?: number[];
  category?: "preference" | "fact" | "knowledge" | "identity" | string;
  confidence: number;
  source?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type MemorySemanticInsert = Omit<MemorySemantic, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MemorySemanticUpdate = Partial<Omit<MemorySemantic, "id" | "created_at">> & {
  updated_at?: string;
};

export interface MemoryProcedural {
  id: string;
  content: string;
  embedding?: number[];
  trigger_pattern?: string;
  steps?: Record<string, unknown>[];
  success_count: number;
  last_used?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type MemoryProceduralInsert = Omit<
  MemoryProcedural,
  "id" | "created_at" | "updated_at" | "success_count"
> & {
  id?: string;
  success_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type MemoryProceduralUpdate = Partial<Omit<MemoryProcedural, "id" | "created_at">> & {
  updated_at?: string;
};

export interface MemoryRelational {
  id: string;
  entity_a: string;
  entity_b: string;
  relationship: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type MemoryRelationalInsert = Omit<MemoryRelational, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MemoryRelationalUpdate = Partial<Omit<MemoryRelational, "id" | "created_at">> & {
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// Task Queue (Phase 3 — 002_task_queue.sql)
// ---------------------------------------------------------------------------

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export interface TaskQueueItem {
  id: string;
  type: "local_skill" | "cloud_skill" | string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export type TaskQueueInsert = Omit<TaskQueueItem, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type TaskQueueUpdate = Partial<Omit<TaskQueueItem, "id" | "created_at">>;

// ---------------------------------------------------------------------------
// Identity (Phase 4 — 003_identity.sql)
// ---------------------------------------------------------------------------

export type IdentityAspect = "soul" | "face" | "self_model";

export interface IdentityRecord {
  id: string;
  aspect: IdentityAspect;
  content: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export type IdentityInsert = Omit<IdentityRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type IdentityUpdate = Partial<Omit<IdentityRecord, "id" | "created_at">> & {
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// Preferences (Phase 4 — 005_preferences.sql)
// ---------------------------------------------------------------------------

export interface PreferenceRecord {
  id: string;
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PreferenceInsert = Omit<PreferenceRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PreferenceUpdate = Partial<Omit<PreferenceRecord, "id" | "created_at">> & {
  updated_at?: string;
};

// ---------------------------------------------------------------------------
// Composite Database type (for Supabase generic param)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      memory_episodic: {
        Row: MemoryEpisodic;
        Insert: MemoryEpisodicInsert;
        Update: MemoryEpisodicUpdate;
        Relationships: [];
      };
      memory_semantic: {
        Row: MemorySemantic;
        Insert: MemorySemanticInsert;
        Update: MemorySemanticUpdate;
        Relationships: [];
      };
      memory_procedural: {
        Row: MemoryProcedural;
        Insert: MemoryProceduralInsert;
        Update: MemoryProceduralUpdate;
        Relationships: [];
      };
      memory_relational: {
        Row: MemoryRelational;
        Insert: MemoryRelationalInsert;
        Update: MemoryRelationalUpdate;
        Relationships: [];
      };
      task_queue: {
        Row: TaskQueueItem;
        Insert: TaskQueueInsert;
        Update: TaskQueueUpdate;
        Relationships: [];
      };
      identity: {
        Row: IdentityRecord;
        Insert: IdentityInsert;
        Update: IdentityUpdate;
        Relationships: [];
      };
      preferences: {
        Row: PreferenceRecord;
        Insert: PreferenceInsert;
        Update: PreferenceUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
