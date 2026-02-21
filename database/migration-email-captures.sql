-- Migration: Add retargeting columns to checklist_email_captures
-- Run in Supabase SQL editor before deploying

ALTER TABLE checklist_email_captures
  ADD COLUMN IF NOT EXISTS anon_id TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS funnel_stage TEXT DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_email_captures_funnel ON checklist_email_captures(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_email_captures_anon ON checklist_email_captures(anon_id);
