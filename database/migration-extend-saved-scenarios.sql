-- Extend saved_scenarios to support both receipt and evroutine saves
-- Run in Supabase SQL Editor

-- 1. Add scenario_type column (defaults to 'evroutine' for existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_scenarios' AND column_name = 'scenario_type'
  ) THEN
    ALTER TABLE saved_scenarios ADD COLUMN scenario_type TEXT NOT NULL DEFAULT 'evroutine';
    ALTER TABLE saved_scenarios ADD CONSTRAINT saved_scenarios_type_check
      CHECK (scenario_type IN ('receipt', 'evroutine'));
  END IF;
END $$;

-- 2. Add receipt_id column (nullable, for receipt saves)
ALTER TABLE saved_scenarios ADD COLUMN IF NOT EXISTS receipt_id UUID NULL;

-- 3. Add title column for user-facing labels
ALTER TABLE saved_scenarios ADD COLUMN IF NOT EXISTS title TEXT NULL;

-- 4. Index for type-based queries
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_type
  ON saved_scenarios(user_id, scenario_type, saved_at DESC);

-- 5. Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_scenarios' AND column_name = 'scenario_type'
  ) THEN
    RAISE NOTICE '[OK] scenario_type column exists';
  ELSE
    RAISE WARNING '[MISSING] scenario_type column';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_scenarios' AND column_name = 'receipt_id'
  ) THEN
    RAISE NOTICE '[OK] receipt_id column exists';
  ELSE
    RAISE WARNING '[MISSING] receipt_id column';
  END IF;
END $$;
