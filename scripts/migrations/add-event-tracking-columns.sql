-- Backend event tracking spec — schema additions
-- Run once in Supabase SQL editor. All statements are idempotent (IF NOT EXISTS / IF EXISTS guards).

-- ============================================================
-- 1. Add top-level columns to user_events
-- ============================================================
ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS source       TEXT,
  ADD COLUMN IF NOT EXISTS anon_id      TEXT,
  ADD COLUMN IF NOT EXISTS actor_label  TEXT,
  ADD COLUMN IF NOT EXISTS bot_score    NUMERIC;

-- Indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_user_events_source
  ON user_events(source);

CREATE INDEX IF NOT EXISTS idx_user_events_anon_id
  ON user_events(anon_id, timestamp DESC);

-- ============================================================
-- 2. sessions table — UTM attribution keyed by session_id
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  session_id   TEXT PRIMARY KEY,
  anon_id      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_term     TEXT,
  utm_content  TEXT,
  referrer     TEXT,
  landing_page TEXT,
  actor_label  TEXT,
  bot_score    NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_sessions_anon_id
  ON sessions(anon_id);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at
  ON sessions(created_at DESC);
