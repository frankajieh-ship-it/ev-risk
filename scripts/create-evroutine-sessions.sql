-- EV Routine Session Tracking Schema
-- For tracking user decision resolution and session analytics

-- Create enums (with safe creation)
DO $$ BEGIN
  CREATE TYPE region_enum AS ENUM ('AUTO','UK','US');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fit_signal_enum AS ENUM ('GOOD','CONDITIONAL','HIGH_FRICTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE decision_outcome_enum AS ENUM (
    'MORE_CONFIDENT_BUYING',
    'MORE_CONFIDENT_NOT_BUYING',
    'NEED_MORE_TIME',
    'CONFIRMED_CONCERNS',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sessions table: one row per sanity-check run
CREATE TABLE IF NOT EXISTS evroutine_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Context
  region region_enum NOT NULL DEFAULT 'AUTO',
  source TEXT NOT NULL DEFAULT 'direct',
  source_detail TEXT,
  thread_type TEXT,
  referrer TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Routine inputs (normalized, no PII)
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Engine outputs
  fit_signal fit_signal_enum,
  fade_label TEXT,
  friction_bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  why_not_100 JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_tags JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  results_viewed_at TIMESTAMPTZ,

  -- Resolution (optional, post-results)
  decision_outcome decision_outcome_enum,
  surfaced_new_tradeoff BOOLEAN,
  confidence_before SMALLINT,
  confidence_after SMALLINT,

  -- Integrity / privacy
  ip_hash TEXT,
  user_agent TEXT
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS evroutine_sessions_created_at_idx
  ON evroutine_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS evroutine_sessions_source_idx
  ON evroutine_sessions (source);
CREATE INDEX IF NOT EXISTS evroutine_sessions_thread_type_idx
  ON evroutine_sessions (thread_type);
CREATE INDEX IF NOT EXISTS evroutine_sessions_fit_signal_idx
  ON evroutine_sessions (fit_signal);
CREATE INDEX IF NOT EXISTS evroutine_sessions_decision_outcome_idx
  ON evroutine_sessions (decision_outcome);

-- Comparison sessions table (for A vs B comparisons)
CREATE TABLE IF NOT EXISTS evroutine_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Context
  region region_enum NOT NULL DEFAULT 'AUTO',
  source TEXT NOT NULL DEFAULT 'direct',
  source_detail TEXT,
  thread_type TEXT,
  referrer TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Comparison inputs and results
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  results_viewed_at TIMESTAMPTZ,

  -- Resolution
  decision_outcome decision_outcome_enum,
  surfaced_new_tradeoff BOOLEAN,
  confidence_before SMALLINT,
  confidence_after SMALLINT,

  -- Integrity
  ip_hash TEXT,
  user_agent TEXT
);

-- Indexes for comparisons
CREATE INDEX IF NOT EXISTS evroutine_comparisons_created_at_idx
  ON evroutine_comparisons (created_at DESC);

-- Events table (for granular event logging within sessions)
CREATE TABLE IF NOT EXISTS evroutine_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id UUID REFERENCES evroutine_sessions(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS evroutine_events_session_id_idx
  ON evroutine_events (session_id);
CREATE INDEX IF NOT EXISTS evroutine_events_name_idx
  ON evroutine_events (event_name);
CREATE INDEX IF NOT EXISTS evroutine_events_created_at_idx
  ON evroutine_events (created_at DESC);
