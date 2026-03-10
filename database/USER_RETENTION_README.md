# User Retention Analytics

This directory contains SQL views and documentation for user retention analytics.

## Overview

The user retention analytics system tracks:
- **Repeat Users**: Users who return to the platform multiple times
- **Active Users**: Daily/Weekly/Monthly active user metrics (DAU/WAU/MAU)
- **User Segments**: Classification by visit count (one-time, occasional, frequent, power users)
- **Engagement Patterns**: Session patterns, events per session, days active

## Database Schema

### Core Tables (Already Exist)

- **`visitors`**: Tracks unique visitors by fingerprint/ID
  - `visitor_id` (PK): Unique visitor identifier
  - `visit_count`: Total number of visits
  - `session_count`: Total number of sessions
  - `first_visit`: First visit timestamp
  - `last_visit`: Most recent visit timestamp

- **`page_views`**: Page-level tracking per visitor
  - `visitor_id`: Links to visitors table
  - `timestamp`: When the page view occurred

- **`user_events`**: All user events with visitor/session tracking
  - `visitor_id`: Links to visitors table
  - `session_id`: Session identifier
  - `event_name`: Type of event
  - `timestamp`: When the event occurred

## SQL Views

The following views are created by the migration:

### `v_repeat_users`
Users with multiple visits, segmented by visit count.

```sql
SELECT * FROM v_repeat_users ORDER BY visit_count DESC LIMIT 20;
```

Columns:
- `visitor_id`: Unique visitor ID
- `visit_count`: Number of visits
- `session_count`: Number of sessions
- `first_visit`: First visit timestamp
- `last_visit`: Last visit timestamp
- `days_active`: Days between first and last visit
- `user_segment`: 'one_time', 'occasional', 'frequent', or 'power'

### `v_daily_active_users`
Daily active user counts for the last 90 days.

```sql
SELECT * FROM v_daily_active_users LIMIT 30;
```

Columns:
- `date`: Date
- `active_users`: Count of unique visitors that day
- `total_page_views`: Total page views that day

### `v_user_engagement_summary`
Comprehensive per-user engagement metrics.

```sql
SELECT * FROM v_user_engagement_summary WHERE visitor_id = 'abc123';
```

Columns:
- `visitor_id`: Unique visitor ID
- `visit_count`: Number of visits
- `session_count`: Number of sessions
- `days_active`: Number of unique days active
- `total_page_views`: Total page views
- `unique_event_types`: Number of different event types triggered
- `total_events`: Total events fired
- `total_hours_on_platform`: Total time on platform (hours)

### `v_user_segments`
Aggregated user segment counts.

```sql
SELECT * FROM v_user_segments;
```

Returns single row with:
- `one_time_users`: Count of users with 1 visit
- `occasional_users`: Count of users with 2-5 visits
- `frequent_users`: Count of users with 6-10 visits
- `power_users`: Count of users with 11+ visits
- `total_users`: Total user count

### `v_active_users_current`
Current DAU, WAU, MAU metrics.

```sql
SELECT * FROM v_active_users_current;
```

Returns single row with:
- `daily_active_users`: Unique visitors in last 24 hours
- `weekly_active_users`: Unique visitors in last 7 days
- `monthly_active_users`: Unique visitors in last 30 days

## API Endpoints

### `/api/admin/user-retention`
Dedicated endpoint for user retention metrics.

**Method**: GET

**Authentication**: Bearer token (ADMIN_API_KEY)

**Query Parameters**:
- `window`: `today` | `week` | `last_30_days` | `month` (default: `last_30_days`)

**Example**:
```bash
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  "https://offolab.com/api/admin/user-retention?window=last_30_days"
```

**Response**:
```json
{
  "window": "last_30_days",
  "start_date": "2026-02-10T00:00:00Z",
  "end_date": "2026-03-10T00:00:00Z",
  "total_unique_visitors": 1234,
  "total_sessions": 2345,
  "total_events": 12345,
  "repeat_users": {
    "total": 456,
    "percentage": 37,
    "by_visit_count": {
      "2_visits": 200,
      "3_5_visits": 150,
      "6_10_visits": 80,
      "11_plus_visits": 26
    },
    "top_power_users": [...]
  },
  "active_users": {
    "daily_active_users": 45,
    "weekly_active_users": 234,
    "monthly_active_users": 1234,
    "dau_wau_ratio": 0.19,
    "dau_mau_ratio": 0.04
  },
  "user_segments": {
    "one_time_users": 778,
    "occasional_users": 350,
    "frequent_users": 80,
    "power_users": 26
  },
  "session_patterns": {
    "avg_sessions_per_user": 1.9,
    "avg_events_per_session": 5.3
  }
}
```

## Admin Dashboard

The admin dashboard at `/admin` includes a "User Retention & Engagement" section that displays:

1. **Key Metrics Cards**:
   - Total Unique Users
   - Repeat Users (with %)
   - Daily Active Users
   - DAU/MAU Ratio (stickiness)

2. **Active Users Breakdown**:
   - DAU, WAU, MAU
   - DAU/WAU and DAU/MAU stickiness ratios

3. **User Segmentation**:
   - Visual breakdown by visit count
   - One-time, Occasional, Frequent, Power users

4. **Repeat User Breakdown**:
   - 2 visits, 3-5 visits, 6-10 visits, 11+ visits

5. **Session Patterns**:
   - Average sessions per user
   - Average events per session

6. **Top Power Users Table**:
   - Visitor ID
   - Visit count
   - Session count
   - Days active
   - Last visit

## Installation

### 1. Apply SQL Views

Run the migration to create views and indexes:

```bash
# Via psql
psql $DATABASE_URL < database/migrations/migration-user-retention-views.sql

# Or via Supabase CLI
supabase db execute --file database/migrations/migration-user-retention-views.sql
```

### 2. Verify Views

Check that views were created:

```sql
SELECT viewname FROM pg_views WHERE viewname LIKE 'v_%';
```

Expected output:
```
v_repeat_users
v_daily_active_users
v_user_engagement_summary
v_user_segments
v_active_users_current
```

### 3. Test API Endpoint

Test the retention API:

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  "http://localhost:3000/api/admin/user-retention?window=last_30_days"
```

### 4. Access Admin Dashboard

Visit the admin dashboard:
```
https://offolab.com/admin
```

Enter your admin API key and navigate to the "User Retention & Engagement" section.

## Performance Optimization

The following indexes are created for optimal performance:

```sql
-- Visitors table
CREATE INDEX idx_visitors_visit_count ON visitors(visit_count);
CREATE INDEX idx_visitors_last_visit ON visitors(last_visit);

-- Page views table
CREATE INDEX idx_page_views_timestamp ON page_views(timestamp);
CREATE INDEX idx_page_views_visitor_timestamp ON page_views(visitor_id, timestamp);

-- User events table
CREATE INDEX idx_user_events_visitor_timestamp ON user_events(visitor_id, timestamp);
CREATE INDEX idx_user_events_event_name ON user_events(event_name);
```

## Metrics Definitions

### Repeat Users
Users with `visit_count > 1`. Indicates users who found value and returned.

### Active Users
- **DAU** (Daily Active Users): Unique visitors in last 24 hours
- **WAU** (Weekly Active Users): Unique visitors in last 7 days
- **MAU** (Monthly Active Users): Unique visitors in last 30 days

### Stickiness Ratios
- **DAU/WAU**: Measures how often weekly users return (higher = more engaged)
- **DAU/MAU**: Measures how often monthly users return (higher = more sticky)

Target benchmarks:
- DAU/WAU > 20% = Good stickiness
- DAU/MAU > 10% = Excellent retention

### User Segments
- **One-time**: 1 visit (potential churn risk)
- **Occasional**: 2-5 visits (testing the product)
- **Frequent**: 6-10 visits (regular users)
- **Power**: 11+ visits (product-market fit, advocates)

## Troubleshooting

### Views Not Showing Data

Check if base tables have data:
```sql
SELECT COUNT(*) FROM visitors;
SELECT COUNT(*) FROM page_views;
SELECT COUNT(*) FROM user_events;
```

### Slow Query Performance

Verify indexes exist:
```sql
SELECT indexname FROM pg_indexes WHERE tablename IN ('visitors', 'page_views', 'user_events');
```

### API Returns Empty Data

Check time window boundaries:
```sql
SELECT MIN(last_visit), MAX(last_visit) FROM visitors;
```

## Maintenance

### Refresh Materialized Views (Future Enhancement)

If views become materialized for performance:
```sql
REFRESH MATERIALIZED VIEW v_repeat_users;
```

### Drop Views

To remove all views:
```sql
DROP VIEW IF EXISTS v_active_users_current;
DROP VIEW IF EXISTS v_user_segments;
DROP VIEW IF EXISTS v_user_engagement_summary;
DROP VIEW IF EXISTS v_daily_active_users;
DROP VIEW IF EXISTS v_repeat_users;
```

## Future Enhancements

1. **Cohort Retention**: Track % of users who return on Day 1, Day 7, Day 30
2. **Churn Analysis**: Identify users who stopped visiting
3. **Engagement Scoring**: Calculate engagement score per user
4. **Funnel Conversion**: Track conversion from one-time to repeat users
5. **Lifecycle Stages**: New, Active, At-Risk, Churned
