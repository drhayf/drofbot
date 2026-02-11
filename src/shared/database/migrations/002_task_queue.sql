-- 002_task_queue.sql
-- Drofbot Phase 3: Brain/Hands Task Queue
-- Queues work items dispatched by Brain for Hands workers.

CREATE TABLE IF NOT EXISTS task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,                          -- 'local_skill', 'cloud_skill'
  status TEXT NOT NULL DEFAULT 'queued',        -- queued, running, completed, failed
  payload JSONB NOT NULL,
  result JSONB,
  priority INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);
