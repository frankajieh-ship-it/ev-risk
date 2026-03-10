/**
 * Migration: User Retention Views
 *
 * Creates SQL views for user retention analytics.
 *
 * Run with:
 *   psql $DATABASE_URL < database/migrations/migration-user-retention-views.sql
 *
 * Or via Supabase CLI:
 *   supabase db execute --file database/migrations/migration-user-retention-views.sql
 */

BEGIN;

-- Drop existing views if they exist (safe to re-run)
DROP VIEW IF EXISTS v_active_users_current;
DROP VIEW IF EXISTS v_user_segments;
DROP VIEW IF EXISTS v_user_engagement_summary;
DROP VIEW IF EXISTS v_daily_active_users;
DROP VIEW IF EXISTS v_repeat_users;

-- Create v_repeat_users
CREATE VIEW v_repeat_users AS
SELECT
  visitor_id,
  visit_count,
  session_count,
  first_visit,
  last_visit,
  EXTRACT(DAY FROM (last_visit - first_visit)) as days_active,
  CASE
    WHEN visit_count = 1 THEN 'one_time'
    WHEN visit_count BETWEEN 2 AND 5 THEN 'occasional'
    WHEN visit_count BETWEEN 6 AND 10 THEN 'frequent'
    ELSE 'power'
  END as user_segment
FROM visitors
WHERE visit_count > 1
ORDER BY visit_count DESC;

-- Create v_daily_active_users
CREATE VIEW v_daily_active_users AS
SELECT
  DATE(timestamp) as date,
  COUNT(DISTINCT visitor_id) as active_users,
  COUNT(*) as total_page_views
FROM page_views
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Create v_user_engagement_summary
CREATE VIEW v_user_engagement_summary AS
SELECT
  v.visitor_id,
  v.visit_count,
  v.session_count,
  v.first_visit,
  v.last_visit,
  COUNT(DISTINCT DATE(pv.timestamp)) as days_active,
  COUNT(pv.id) as total_page_views,
  COUNT(DISTINCT ue.event_name) as unique_event_types,
  COUNT(ue.id) as total_events,
  EXTRACT(EPOCH FROM (MAX(pv.timestamp) - MIN(pv.timestamp))) / 3600 as total_hours_on_platform
FROM visitors v
LEFT JOIN page_views pv ON v.visitor_id = pv.visitor_id
LEFT JOIN user_events ue ON v.visitor_id = ue.visitor_id
GROUP BY v.visitor_id, v.visit_count, v.session_count, v.first_visit, v.last_visit;

-- Create v_user_segments
CREATE VIEW v_user_segments AS
SELECT
  COUNT(CASE WHEN visit_count = 1 THEN 1 END) as one_time_users,
  COUNT(CASE WHEN visit_count BETWEEN 2 AND 5 THEN 1 END) as occasional_users,
  COUNT(CASE WHEN visit_count BETWEEN 6 AND 10 THEN 1 END) as frequent_users,
  COUNT(CASE WHEN visit_count > 10 THEN 1 END) as power_users,
  COUNT(*) as total_users
FROM visitors;

-- Create v_active_users_current
CREATE VIEW v_active_users_current AS
SELECT
  (SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE timestamp >= NOW() - INTERVAL '1 day') as daily_active_users,
  (SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE timestamp >= NOW() - INTERVAL '7 days') as weekly_active_users,
  (SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE timestamp >= NOW() - INTERVAL '30 days') as monthly_active_users;

-- Create indexes for performance (if not already exist)
CREATE INDEX IF NOT EXISTS idx_visitors_visit_count ON visitors(visit_count);
CREATE INDEX IF NOT EXISTS idx_visitors_last_visit ON visitors(last_visit);
CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_timestamp ON page_views(visitor_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_events_visitor_timestamp ON user_events(visitor_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON user_events(event_name);

-- Grant SELECT permissions on views (adjust role as needed)
-- Uncomment if you need to grant explicit permissions:
-- GRANT SELECT ON v_repeat_users TO authenticated;
-- GRANT SELECT ON v_daily_active_users TO authenticated;
-- GRANT SELECT ON v_user_engagement_summary TO authenticated;
-- GRANT SELECT ON v_user_segments TO authenticated;
-- GRANT SELECT ON v_active_users_current TO authenticated;

COMMIT;

-- Verify views were created
SELECT
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE viewname LIKE 'v_%'
ORDER BY viewname;
