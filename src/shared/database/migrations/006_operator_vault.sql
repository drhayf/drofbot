-- 006_operator_vault.sql
-- Drofbot Phase 4: Operator Vault
-- Stores voice patterns, interaction preferences, identity synthesis, references, notes.

CREATE TABLE IF NOT EXISTS operator_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  confidence REAL DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, key)
);

CREATE INDEX IF NOT EXISTS idx_vault_category ON operator_vault (category);
CREATE INDEX IF NOT EXISTS idx_vault_category_key ON operator_vault (category, key);
