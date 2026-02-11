-- 007_expressions.sql
-- Drofbot Phase 6: Expression Engine History
-- Tracks spontaneous expressions for dedup, cooldown, and analytics.

CREATE TABLE IF NOT EXISTS expressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_kind TEXT NOT NULL,          -- cosmic_shift, pattern_detection, etc.
  topic TEXT,                          -- dedup key for topic cooldown
  significance REAL NOT NULL DEFAULT 0.0,
  content TEXT,                        -- the composed expression text
  delivered BOOLEAN DEFAULT FALSE,
  channel TEXT,                        -- delivery channel
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expressions_trigger ON expressions (trigger_kind);
CREATE INDEX IF NOT EXISTS idx_expressions_topic ON expressions (topic);
CREATE INDEX IF NOT EXISTS idx_expressions_created ON expressions (created_at DESC);
