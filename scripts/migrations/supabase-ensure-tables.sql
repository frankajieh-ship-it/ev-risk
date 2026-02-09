-- Supabase Migration: Ensure all required tables exist
-- Run this against your Supabase database after migrating from Neon/Vercel Postgres
-- Date: 2026-02-06

-- ============================================
-- 1. Core tables (from schema.sql)
-- ============================================

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('draft', 'paid', 'free')),
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  stripe_session_id TEXT,
  customer_email TEXT,
  vehicle_year INTEGER,
  vehicle_model TEXT,
  -- V2 columns (from migration-v2.sql)
  schema_version TEXT DEFAULT 'v1',
  routine JSONB,
  charging_access TEXT,
  climate TEXT,
  longest_day_pattern TEXT,
  weekly_miles NUMERIC,
  commute_miles_roundtrip NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_stripe_session ON reports(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_schema_version ON reports(schema_version);
CREATE INDEX IF NOT EXISTS idx_reports_routine ON reports USING GIN (routine);

-- ============================================
-- 2. Visitor tracking tables
-- ============================================

-- Visitors table: logs unique visitors
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  page_path TEXT NOT NULL,
  country TEXT,
  city TEXT,
  first_visit TIMESTAMPTZ DEFAULT NOW(),
  last_visit TIMESTAMPTZ DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,
  session_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_visitors_id ON visitors(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_first_visit ON visitors(first_visit DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_last_visit ON visitors(last_visit DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_page_path ON visitors(page_path);

-- Page views table: detailed page view logs
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  referrer TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  session_duration INTEGER
);

CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(page_path);

-- ============================================
-- 3. User events table
-- ============================================

CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_data JSONB,
  visitor_id TEXT,
  session_id TEXT,
  page_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  -- Extra columns from add-event-tags migration
  ip_relevance BOOLEAN DEFAULT FALSE,
  enterprise_ready BOOLEAN DEFAULT FALSE,
  user_id TEXT,
  event_type TEXT DEFAULT 'user_action'
);

CREATE INDEX IF NOT EXISTS idx_events_name ON user_events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON user_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON user_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_data ON user_events USING GIN (event_data);
CREATE INDEX IF NOT EXISTS idx_user_events_ip_relevance ON user_events(ip_relevance) WHERE ip_relevance = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_events_enterprise_ready ON user_events(enterprise_ready) WHERE enterprise_ready = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);

-- ============================================
-- 4. Report feedback table
-- ============================================

CREATE TABLE IF NOT EXISTS report_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  rating INTEGER,
  feedback_text TEXT,
  would_recommend BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_feedback_report ON report_feedback(report_id);
CREATE INDEX IF NOT EXISTS idx_report_feedback_created ON report_feedback(created_at DESC);

-- ============================================
-- 5. Verify tables exist
-- ============================================

DO $$
DECLARE
  tbl TEXT;
  required_tables TEXT[] := ARRAY['reports', 'visitors', 'page_views', 'user_events', 'report_feedback'];
BEGIN
  FOREACH tbl IN ARRAY required_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      RAISE NOTICE '  [OK] Table % exists', tbl;
    ELSE
      RAISE WARNING '  [MISSING] Table % was not created!', tbl;
    END IF;
  END LOOP;
END $$;
