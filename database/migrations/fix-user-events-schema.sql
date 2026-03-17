-- Fix user_events schema for full tracking coverage
-- Run in Supabase SQL Editor.
--
-- Problem: visitor_id is NOT NULL but server-side events (trackServerEvent)
-- don't have a visitor_id — they use anon_id instead. This causes all
-- server-side events to fail silently since at least the RLS migration
-- ran on March 14, 2026.
--
-- Also adds the columns that trackServerEvent expects but that were
-- never added via migration: source, anon_id, ip_relevance, enterprise_ready, dedupe_key.

BEGIN;

-- 1. Make visitor_id nullable (server-side events don't have one)
ALTER TABLE user_events
  ALTER COLUMN visitor_id DROP NOT NULL;

-- 2. Add columns that trackServerEvent inserts (if not already present)
ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS source TEXT NULL,
  ADD COLUMN IF NOT EXISTS anon_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS ip_relevance BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS enterprise_ready BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT NULL;

-- 3. Unique constraint on dedupe_key (partial — only non-null rows)
--    This is what prevents double-counting on retries.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'user_events' AND indexname = 'idx_events_dedupe_key'
  ) THEN
    CREATE UNIQUE INDEX idx_events_dedupe_key
      ON user_events(dedupe_key) WHERE dedupe_key IS NOT NULL;
  END IF;
END $$;

-- 4. Indexes for new columns (partial — only index non-null rows)
CREATE INDEX IF NOT EXISTS idx_events_anon_id
  ON user_events(anon_id) WHERE anon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_source
  ON user_events(source) WHERE source IS NOT NULL;

-- 5. Verify columns exist
DO $$
DECLARE
  missing TEXT := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_events' AND column_name = 'source') THEN
    missing := missing || 'source, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_events' AND column_name = 'anon_id') THEN
    missing := missing || 'anon_id, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_events' AND column_name = 'ip_relevance') THEN
    missing := missing || 'ip_relevance, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_events' AND column_name = 'enterprise_ready') THEN
    missing := missing || 'enterprise_ready, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_events' AND column_name = 'dedupe_key') THEN
    missing := missing || 'dedupe_key, ';
  END IF;
  IF missing = '' THEN
    RAISE NOTICE '[OK] All user_events columns present';
  ELSE
    RAISE WARNING '[MISSING] user_events columns: %', missing;
  END IF;
END $$;

COMMIT;
