/**
 * User Retention SQL Views
 *
 * Pre-computed views for faster user retention analytics queries.
 * These views can be queried directly instead of running complex JOINs.
 *
 * Apply with: psql $DATABASE_URL < database/views/user-retention-views.sql
 */

-- ===========================================================================
-- View 1: Repeat Users (users with multiple visits)
-- ===========================================================================
CREATE OR REPLACE VIEW v_repeat_users AS
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

COMMENT ON VIEW v_repeat_users IS 'Users with multiple visits, segmented by visit count';

-- ===========================================================================
-- View 2: Daily Active Users (last 90 days)
-- ===========================================================================
CREATE OR REPLACE VIEW v_daily_active_users AS
SELECT
  DATE(timestamp) as date,
  COUNT(DISTINCT visitor_id) as active_users,
  COUNT(*) as total_page_views
FROM page_views
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

COMMENT ON VIEW v_daily_active_users IS 'Daily active user counts for last 90 days';

-- ===========================================================================
-- View 3: User Engagement Summary (comprehensive per-user metrics)
-- ===========================================================================
CREATE OR REPLACE VIEW v_user_engagement_summary AS
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

COMMENT ON VIEW v_user_engagement_summary IS 'Comprehensive per-user engagement metrics';

-- ===========================================================================
-- View 4: User Segments Summary (aggregated counts)
-- ===========================================================================
CREATE OR REPLACE VIEW v_user_segments AS
SELECT
  COUNT(CASE WHEN visit_count = 1 THEN 1 END) as one_time_users,
  COUNT(CASE WHEN visit_count BETWEEN 2 AND 5 THEN 1 END) as occasional_users,
  COUNT(CASE WHEN visit_count BETWEEN 6 AND 10 THEN 1 END) as frequent_users,
  COUNT(CASE WHEN visit_count > 10 THEN 1 END) as power_users,
  COUNT(*) as total_users
FROM visitors;

COMMENT ON VIEW v_user_segments IS 'Aggregated user segment counts';

-- ===========================================================================
-- View 5: Active Users (DAU, WAU, MAU)
-- ===========================================================================
CREATE OR REPLACE VIEW v_active_users_current AS
SELECT
  (SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE timestamp >= NOW() - INTERVAL '1 day') as daily_active_users,
  (SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE timestamp >= NOW() - INTERVAL '7 days') as weekly_active_users,
  (SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE timestamp >= NOW() - INTERVAL '30 days') as monthly_active_users;

COMMENT ON VIEW v_active_users_current IS 'Current DAU, WAU, MAU metrics';

-- ===========================================================================
-- Indexes for Performance (if not already exist)
-- ===========================================================================
-- These indexes support the views above

-- Index on visitors table
CREATE INDEX IF NOT EXISTS idx_visitors_visit_count ON visitors(visit_count);
CREATE INDEX IF NOT EXISTS idx_visitors_last_visit ON visitors(last_visit);

-- Index on page_views table
CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_timestamp ON page_views(visitor_id, timestamp);

-- Index on user_events table
CREATE INDEX IF NOT EXISTS idx_user_events_visitor_timestamp ON user_events(visitor_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON user_events(event_name);

-- ===========================================================================
-- Usage Examples
-- ===========================================================================

-- Example 1: Get top 20 power users
-- SELECT * FROM v_repeat_users ORDER BY visit_count DESC LIMIT 20;

-- Example 2: Get daily active users for last 30 days
-- SELECT * FROM v_daily_active_users LIMIT 30;

-- Example 3: Get user segments summary
-- SELECT * FROM v_user_segments;

-- Example 4: Get current active user metrics
-- SELECT * FROM v_active_users_current;

-- Example 5: Get detailed engagement for specific user
-- SELECT * FROM v_user_engagement_summary WHERE visitor_id = 'abc123';
