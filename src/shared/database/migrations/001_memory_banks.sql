-- 001_memory_banks.sql
-- Drofbot Phase 2: Hierarchical Memory System
-- Creates the four memory bank tables with pgvector support.

-- Episodic: timestamped events and experiences
CREATE TABLE IF NOT EXISTS memory_episodic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB,        -- session, channel, topic
  importance FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Semantic: facts, preferences, knowledge
CREATE TABLE IF NOT EXISTS memory_semantic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  category TEXT,         -- preference, fact, knowledge
  confidence FLOAT DEFAULT 0.8,
  source TEXT,           -- which conversation/event
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Procedural: workflows, habits, learned procedures
CREATE TABLE IF NOT EXISTS memory_procedural (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  trigger_pattern TEXT,  -- what activates this procedure
  steps JSONB,           -- structured steps
  success_count INT DEFAULT 0,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relational: entity relationships and connections
CREATE TABLE IF NOT EXISTS memory_relational (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a TEXT NOT NULL,
  entity_b TEXT NOT NULL,
  relationship TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vector similarity search (HNSW — works on empty tables, unlike IVFFlat)
CREATE INDEX IF NOT EXISTS idx_episodic_embedding ON memory_episodic USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_semantic_embedding ON memory_semantic USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_procedural_embedding ON memory_procedural USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_relational_embedding ON memory_relational USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- B-tree indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_episodic_timestamp ON memory_episodic (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_category ON memory_semantic (category);
CREATE INDEX IF NOT EXISTS idx_relational_entities ON memory_relational (entity_a, entity_b);
