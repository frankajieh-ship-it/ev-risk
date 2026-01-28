-- Migration: Add IP/Enterprise tagging columns to user_events
-- Purpose: Support investor-ready analytics and IP defensibility queries
-- Date: 2026-01-27

-- Note: IP/Enterprise tags are currently stored in event_data JSONB as _tags
-- This migration adds dedicated columns for faster querying and indexing

-- Step 1: Add new columns (if they don't exist)
DO $$
BEGIN
  -- Add ip_relevance column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_events' AND column_name = 'ip_relevance'
  ) THEN
    ALTER TABLE user_events ADD COLUMN ip_relevance BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added ip_relevance column';
  ELSE
    RAISE NOTICE 'ip_relevance column already exists';
  END IF;

  -- Add enterprise_ready column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_events' AND column_name = 'enterprise_ready'
  ) THEN
    ALTER TABLE user_events ADD COLUMN enterprise_ready BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added enterprise_ready column';
  ELSE
    RAISE NOTICE 'enterprise_ready column already exists';
  END IF;

  -- Add user_id column for authenticated events
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE user_events ADD COLUMN user_id TEXT;
    RAISE NOTICE 'Added user_id column';
  ELSE
    RAISE NOTICE 'user_id column already exists';
  END IF;

  -- Add event_type column for categorization
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE user_events ADD COLUMN event_type TEXT DEFAULT 'user_action';
    RAISE NOTICE 'Added event_type column';
  ELSE
    RAISE NOTICE 'event_type column already exists';
  END IF;
END $$;

-- Step 2: Create indexes for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_user_events_ip_relevance ON user_events(ip_relevance) WHERE ip_relevance = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_events_enterprise_ready ON user_events(enterprise_ready) WHERE enterprise_ready = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);

-- Step 3: Backfill existing events with tags from event_data
-- IP-relevant events: constraint_detected, scenario_save_success, report_generated
UPDATE user_events
SET ip_relevance = TRUE
WHERE event_name IN ('constraint_detected', 'scenario_save_success', 'report_generated')
  AND (ip_relevance IS NULL OR ip_relevance = FALSE);

-- Enterprise-ready events: scenario_save_success, email_confirmed, report_generated
UPDATE user_events
SET enterprise_ready = TRUE
WHERE event_name IN ('scenario_save_success', 'email_confirmed', 'report_generated')
  AND (enterprise_ready IS NULL OR enterprise_ready = FALSE);

-- Also mark events with user_id in event_data as enterprise_ready
UPDATE user_events
SET
  enterprise_ready = TRUE,
  user_id = COALESCE(user_id, event_data->>'_user_id')
WHERE event_data->>'_user_id' IS NOT NULL
  AND event_data->>'_user_id' != 'null';

-- Step 4: Backfill event_type based on event_name
UPDATE user_events
SET event_type = CASE
  WHEN event_name LIKE 'feedback_%' OR event_name LIKE 'why_checkpoint_%' OR event_name LIKE 'micro_feedback_%' THEN 'feedback'
  WHEN event_name IN ('scenario_save_success', 'email_confirmed', 'report_generated') THEN 'conversion'
  WHEN event_name IN ('constraint_detected', 'report_view') THEN 'system'
  ELSE 'user_action'
END
WHERE event_type IS NULL OR event_type = 'user_action';

-- Step 5: Create a view for IP-defensible analytics
CREATE OR REPLACE VIEW ip_defensible_events AS
SELECT
  event_name,
  event_data,
  visitor_id,
  session_id,
  user_id,
  page_path,
  timestamp,
  event_type
FROM user_events
WHERE ip_relevance = TRUE
ORDER BY timestamp DESC;

-- Step 6: Create a view for enterprise-ready analytics
CREATE OR REPLACE VIEW enterprise_ready_events AS
SELECT
  event_name,
  event_data,
  visitor_id,
  session_id,
  user_id,
  page_path,
  timestamp,
  event_type
FROM user_events
WHERE enterprise_ready = TRUE
ORDER BY timestamp DESC;

-- Step 7: Create analytics summary view
CREATE OR REPLACE VIEW event_analytics_summary AS
SELECT
  event_name,
  event_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT visitor_id) as unique_visitors,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(user_id) as authenticated_events,
  SUM(CASE WHEN ip_relevance THEN 1 ELSE 0 END) as ip_relevant_count,
  SUM(CASE WHEN enterprise_ready THEN 1 ELSE 0 END) as enterprise_ready_count,
  MIN(timestamp) as first_occurrence,
  MAX(timestamp) as last_occurrence
FROM user_events
GROUP BY event_name, event_type
ORDER BY total_count DESC;

-- Done!
-- To verify: SELECT * FROM event_analytics_summary;
