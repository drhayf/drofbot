-- 004_progression.sql
-- Progression system: player stats, quests, and quest logs.
-- Gamification layer for personal growth tracking.

-- Player stats
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id TEXT NOT NULL DEFAULT 'default',
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  current_rank TEXT NOT NULL DEFAULT 'E',
  sync_rate REAL NOT NULL DEFAULT 0.0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  sync_history JSONB NOT NULL DEFAULT '[]',
  last_active DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quests
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quest_type TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  xp_reward INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  cosmic_alignment REAL,
  insight_id TEXT,
  source TEXT NOT NULL DEFAULT 'agent',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quest logs (individual occurrences for recurring quests)
CREATE TABLE IF NOT EXISTS quest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id),
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
