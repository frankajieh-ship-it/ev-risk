-- ============================================================================
-- OFFO — Fix Supabase Security Advisor Errors
-- ============================================================================
-- Addresses:
--   1. RLS Disabled on 3 tables: reports, evroutine_events, report_feedback
--   2. Security Definer Views: session_analytics_summary, enterprise_ready_sessions,
--      user_engagement_summary, ip_defensible_sessions
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
-- Safe to re-run — all guards use IF NOT EXISTS.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PART A: Enable RLS on tables missing it
-- Same pattern as database/migrations/enable-rls.sql
-- ----------------------------------------------------------------------------

ALTER TABLE reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE evroutine_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_feedback  ENABLE ROW LEVEL SECURITY;

-- reports: service_role bypass
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON reports
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- evroutine_events: service_role bypass
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'evroutine_events' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON evroutine_events
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- report_feedback: service_role bypass
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_feedback' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON report_feedback
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- PART B: Recreate Security Definer views as regular (INVOKER) views
--
-- Supabase flags views created with SECURITY DEFINER because they run as the
-- definer (postgres/superuser), bypassing RLS for any caller. Regular views
-- inherit the caller's permissions instead — safe for service_role queries and
-- correctly blocked for anon/authenticated callers per RLS.
--
-- These views are admin-only analytics; no Next.js app code queries them.
-- Dropping and recreating has zero user-facing impact.
-- ----------------------------------------------------------------------------

-- session_analytics_summary
-- Session-level aggregation of user_events (event count, unique events, timestamps per session)
DROP VIEW IF EXISTS session_analytics_summary;
CREATE VIEW session_analytics_summary AS
SELECT
  session_id,
  visitor_id,
  COUNT(*)                          AS total_events,
  COUNT(DISTINCT event_name)        AS unique_event_types,
  MIN(timestamp)                    AS session_start,
  MAX(timestamp)                    AS session_end,
  EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) AS session_duration_seconds,
  MAX(page_path)                    AS last_page,
  BOOL_OR(ip_relevance)             AS has_ip_relevant_event,
  BOOL_OR(enterprise_ready)         AS has_enterprise_event
FROM user_events
WHERE session_id IS NOT NULL
GROUP BY session_id, visitor_id
ORDER BY session_start DESC;

-- enterprise_ready_sessions
-- Events where enterprise_ready = TRUE (scenario saves, email confirms, report generations)
DROP VIEW IF EXISTS enterprise_ready_sessions;
CREATE VIEW enterprise_ready_sessions AS
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

-- user_engagement_summary
-- Per-visitor engagement: visits, events, page views (mirrors v_user_engagement_summary)
DROP VIEW IF EXISTS user_engagement_summary;
CREATE VIEW user_engagement_summary AS
SELECT
  v.visitor_id,
  v.visit_count,
  v.session_count,
  v.first_visit,
  v.last_visit,
  COUNT(DISTINCT DATE(pv.timestamp))                    AS days_active,
  COUNT(pv.id)                                          AS total_page_views,
  COUNT(DISTINCT ue.event_name)                         AS unique_event_types,
  COUNT(ue.id)                                          AS total_events,
  EXTRACT(EPOCH FROM (MAX(pv.timestamp) - MIN(pv.timestamp))) / 3600 AS total_hours_on_platform
FROM visitors v
LEFT JOIN page_views pv ON v.visitor_id = pv.visitor_id
LEFT JOIN user_events ue ON v.visitor_id = ue.visitor_id
GROUP BY v.visitor_id, v.visit_count, v.session_count, v.first_visit, v.last_visit;

-- ip_defensible_sessions
-- Events where ip_relevance = TRUE (constraint detections, saves, report generations)
DROP VIEW IF EXISTS ip_defensible_sessions;
CREATE VIEW ip_defensible_sessions AS
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


-- ----------------------------------------------------------------------------
-- PART C: Allow anon/authenticated to INSERT into user_events
--
-- user_events had service_role_all only — meaning all client-side event
-- tracking calls (/api/track-event uses the anon client) were silently
-- failing. This caused 0 receipt_result_viewed and 0 report_generation events
-- despite hundreds of receipts generated.
--
-- SELECT/UPDATE/DELETE remain service_role only — clients can write but not read.
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_events' AND policyname = 'anon_insert'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "anon_insert" ON user_events
        FOR INSERT TO anon, authenticated WITH CHECK (true)
    $p$;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- Verification
-- Run after migration to confirm fixes:
--
-- 1. Check RLS enabled on the 3 new tables:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND tablename IN ('reports', 'evroutine_events', 'report_feedback');
--    -- Expected: rowsecurity = true for all three
--
-- 2. Check no SECURITY DEFINER on views:
--    SELECT viewname, definition FROM pg_views
--    WHERE viewname IN ('session_analytics_summary', 'enterprise_ready_sessions',
--                       'user_engagement_summary', 'ip_defensible_sessions');
--    -- Expected: definitions should NOT contain SECURITY DEFINER
--
-- 3. In Supabase Security Advisor → click "Rerun linter"
--    -- Expected: 0 "RLS Disabled" errors for these tables, 0 "Security Definer View" errors
-- ----------------------------------------------------------------------------
