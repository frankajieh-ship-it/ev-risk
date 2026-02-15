-- Create comparisons table for free compare feature
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  anon_id TEXT NULL,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('receipt', 'evroutine')),
  base_scenario_id UUID NOT NULL,
  compare_scenario_id UUID NOT NULL,
  comparison_result JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_type, base_scenario_id, compare_scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_comparisons_user
  ON comparisons(user_id, created_at DESC);

-- Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'comparisons'
  ) THEN
    RAISE NOTICE '[OK] comparisons table exists';
  ELSE
    RAISE WARNING '[MISSING] comparisons table';
  END IF;
END $$;
