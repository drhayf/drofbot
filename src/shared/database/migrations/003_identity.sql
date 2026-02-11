-- 003_identity.sql
-- Drofbot Phase 4: Identity / Self-Model Storage
-- Stores the evolving aspects of Drofbot's identity (soul, face, self-model).

CREATE TABLE IF NOT EXISTS identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aspect TEXT NOT NULL,      -- 'soul', 'face', 'self_model'
  content JSONB NOT NULL,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
