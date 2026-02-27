-- Add user_id column to user_events for direct identity attribution
-- Run this in Supabase SQL Editor BEFORE deploying the code changes.

-- 1. Add user_id column (nullable — anonymous events have no user)
ALTER TABLE user_events ADD COLUMN IF NOT EXISTS user_id TEXT NULL;

-- 2. Index for user-based queries (partial — only index non-null rows)
CREATE INDEX IF NOT EXISTS idx_events_user_id
  ON user_events(user_id) WHERE user_id IS NOT NULL;

-- 3. Backfill existing events that already have _user_id in JSONB
UPDATE user_events
SET user_id = event_data->>'_user_id'
WHERE event_data->>'_user_id' IS NOT NULL
  AND user_id IS NULL;

-- 4. Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_events' AND column_name = 'user_id'
  ) THEN
    RAISE NOTICE '[OK] user_id column exists on user_events';
  ELSE
    RAISE WARNING '[MISSING] user_id column on user_events';
  END IF;
END $$;
