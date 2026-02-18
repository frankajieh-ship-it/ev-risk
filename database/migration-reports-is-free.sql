-- ============================================================================
-- Reports table — Add is_free column
-- ============================================================================
-- Run in Supabase SQL Editor (Dashboard > SQL Editor).
-- Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;
