-- EV-Risk™ Database Schema
-- For Vercel Postgres

-- Reports table: stores all generated reports (draft and paid)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('draft', 'paid')),
  payload_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  stripe_session_id TEXT,
  customer_email TEXT,
  vehicle_year INTEGER,
  vehicle_model TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_stripe_session ON reports(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Clean up old draft reports (optional, run periodically)
-- DELETE FROM reports WHERE status = 'draft' AND created_at < NOW() - INTERVAL '7 days';

-- Visitor tracking table: logs unique visitors to offolab.com
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL, -- Unique identifier (fingerprint or session ID)
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  page_path TEXT NOT NULL,
  country TEXT,
  city TEXT,
  first_visit TIMESTAMP DEFAULT NOW(),
  last_visit TIMESTAMP DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,
  session_count INTEGER DEFAULT 1
);

-- Indexes for visitor tracking
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
  timestamp TIMESTAMP DEFAULT NOW(),
  session_duration INTEGER, -- seconds on page
  FOREIGN KEY (visitor_id) REFERENCES visitors(visitor_id)
);

-- Indexes for page views
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(page_path);

-- User events table: detailed event tracking for analytics
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_data JSONB,
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  page_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for user events
CREATE INDEX IF NOT EXISTS idx_events_name ON user_events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON user_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON user_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_data ON user_events USING GIN (event_data);
