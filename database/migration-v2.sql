-- EV-Risk V2 Migration: Add schema_version and routine fields to reports table
-- Run this ONCE against your production database before deploying v2 code.

-- Add schema version column (defaults to 'v1' for existing reports)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT 'v1';

-- Add routine JSONB column for MVR data
ALTER TABLE reports ADD COLUMN IF NOT EXISTS routine JSONB;

-- Flattened columns for analytics queries
ALTER TABLE reports ADD COLUMN IF NOT EXISTS charging_access TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS climate TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS longest_day_pattern TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS weekly_miles NUMERIC;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS commute_miles_roundtrip NUMERIC;

-- Index for version-based queries
CREATE INDEX IF NOT EXISTS idx_reports_schema_version ON reports(schema_version);

-- Index for routine JSONB queries
CREATE INDEX IF NOT EXISTS idx_reports_routine ON reports USING GIN (routine);

-- Backfill: Mark all existing reports as v1
UPDATE reports SET schema_version = 'v1' WHERE schema_version IS NULL;
