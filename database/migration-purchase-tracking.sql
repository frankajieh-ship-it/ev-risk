-- Phase 1: Purchase outcome tracking on garage_vehicles
-- Adds purchased_at and outcome so OFFO can track receipt → purchase conversion

ALTER TABLE garage_vehicles
  ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome TEXT; -- 'purchased' | 'passed' | 'pending'

-- Index for analytics queries: "of all GREEN verdicts, what % resulted in purchases"
CREATE INDEX IF NOT EXISTS idx_garage_vehicles_outcome ON garage_vehicles (outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_garage_vehicles_purchased_at ON garage_vehicles (purchased_at) WHERE purchased_at IS NOT NULL;
