-- SOH crowd-sourced calibration table
-- Users who ran a receipt can submit their actual OBD SOH reading post-purchase.
-- Used to build a predicted-vs-actual calibration dataset over time (no ML yet).

CREATE TABLE IF NOT EXISTS soh_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NULL,              -- links to receipt_requests.id if from a post-purchase flow
  user_id UUID NULL,
  anon_id TEXT NOT NULL,
  vehicle_year INTEGER NOT NULL,
  vehicle_model TEXT NOT NULL,
  vin TEXT NULL,
  reported_soh_pct NUMERIC(5,2) NOT NULL CHECK (reported_soh_pct >= 50 AND reported_soh_pct <= 100),
  obd_tool TEXT NULL,                -- 'leaf_spy' | 'torque' | 'obdii_generic' | 'manufacturer_app' | 'other'
  reading_date DATE NOT NULL,
  current_mileage INTEGER NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soh_model ON soh_submissions(vehicle_model, vehicle_year);
CREATE INDEX IF NOT EXISTS idx_soh_user ON soh_submissions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_soh_vin ON soh_submissions(vin) WHERE vin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_soh_created ON soh_submissions(created_at DESC);
