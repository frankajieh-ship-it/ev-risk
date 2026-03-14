-- ============================================================================
-- OFFO — Enable Row-Level Security on All User/Dealer Data Tables
-- ============================================================================
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
-- Safe to re-run — IF NOT EXISTS guards prevent duplicate policy errors.
--
-- Effect: blocks direct anon-key access to all user data.
-- Server-side API routes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
-- entirely — no server-side code changes needed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE receipts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage_vehicles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_receipts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deep_dives        ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Also cover these if they exist (safe to run even if table doesn't exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shared_routines') THEN
    EXECUTE 'ALTER TABLE shared_routines ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'routine_runs') THEN
    EXECUTE 'ALTER TABLE routine_runs ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'routine_profiles') THEN
    EXECUTE 'ALTER TABLE routine_profiles ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pdf_exports') THEN
    EXECUTE 'ALTER TABLE pdf_exports ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Service-role bypass policies
-- Explicit belt-and-suspenders: service_role always has full access.
-- (Service role already bypasses RLS implicitly, but explicit policies
--  make the intent auditable.)
-- ---------------------------------------------------------------------------

-- receipts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'receipts' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON receipts
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- purchases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON purchases
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- garage_vehicles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'garage_vehicles' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON garage_vehicles
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- dealer_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dealer_members' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON dealer_members
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- inquiries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inquiries' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON inquiries
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- user_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_events' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON user_events
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- shared_receipts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_receipts' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON shared_receipts
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- deep_dives
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deep_dives' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON deep_dives
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- receipt_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'receipt_events' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON receipt_events
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- receipt_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'receipt_requests' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON receipt_requests
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- stripe_webhook_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stripe_webhook_events' AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all" ON stripe_webhook_events
        TO service_role USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verification query (run after migration to confirm RLS is active)
-- ---------------------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Expected: rowsecurity = true for all listed tables.
-- Then switch to anon key in Supabase client and run:
--   SELECT count(*) FROM receipts;   -- should return permission denied or 0 rows
