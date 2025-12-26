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
