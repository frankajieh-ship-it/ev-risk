-- Migration: Photo storage + AI analysis columns on receipts
-- Run this in Supabase SQL editor.

-- Add photo storage and analysis result columns to receipts
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS photo_urls     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS photo_analysis JSONB;

-- Async job queue for per-receipt photo analysis
CREATE TABLE IF NOT EXISTS receipt_photo_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id  UUID        NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_photo_jobs_receipt ON receipt_photo_jobs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_photo_jobs_status  ON receipt_photo_jobs(status, created_at);
