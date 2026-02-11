-- 002_memory_metadata.sql
-- Drofbot Phase 4: Add metadata JSONB to semantic & procedural banks
-- Enables cosmic enrichment on all four memory banks.

ALTER TABLE memory_semantic ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE memory_procedural ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
