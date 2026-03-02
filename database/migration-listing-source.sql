-- Migration: Add listing_source column to receipt_events
-- Run in Supabase SQL editor

ALTER TABLE receipt_events ADD COLUMN IF NOT EXISTS listing_source TEXT NULL;

-- Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'receipt_events'
      AND column_name = 'listing_source'
  ) THEN
    RAISE NOTICE '[OK] listing_source column exists on receipt_events';
  ELSE
    RAISE WARNING '[MISSING] listing_source column on receipt_events';
  END IF;
END $$;
