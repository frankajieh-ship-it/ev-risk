-- Mark internal/developer traffic in user_events
-- Run in Supabase SQL Editor: supabase.com → your project → SQL Editor

BEGIN;

-- 1. Add is_internal column (fast — just a metadata change, no rewrite)
ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_events_is_internal
  ON user_events (is_internal)
  WHERE is_internal = true;

-- 2. Back-fill all known internal rows (developer/test traffic)
--    Matches by visitor_id, authenticated user_id, or internal IP address
UPDATE user_events
SET is_internal = true
WHERE
  visitor_id IN ('fp-uwi6gg', 'fp-24bewu', 'fp-airyss')
  OR user_id IN (
    'a9e65037-00b3-443b-afba-5631e42b0505',
    '71ccca48-add0-4a47-b7b4-14985c923a78'
  )
  OR ip_address IN ('107.21.254.59', '18.235.38.143', '3.234.24.20', '::1');

COMMIT;

-- Verify: should show ~880 rows marked internal
-- SELECT COUNT(*) FROM user_events WHERE is_internal = true;
