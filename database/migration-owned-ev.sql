-- My Owned EV feature
-- Extends garage_vehicles and adds two new tables for owned-EV reports and entitlements.

-- 1. Extend garage_vehicles with ownership flags
ALTER TABLE garage_vehicles
  ADD COLUMN IF NOT EXISTS is_owned_ev boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS owned_since_date date,
  ADD COLUMN IF NOT EXISTS ownership_source text; -- 'vin_scan' | 'manual' | 'import'

CREATE INDEX IF NOT EXISTS idx_garage_vehicles_owned
  ON garage_vehicles(user_id, is_owned_ev) WHERE is_owned_ev = true;

-- 2. Owned EV reports — stores generated routine_health and sellers_report payloads
CREATE TABLE IF NOT EXISTS owned_ev_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  garage_vehicle_id uuid NOT NULL REFERENCES garage_vehicles(id) ON DELETE CASCADE,
  vin text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('routine_health', 'sellers_report')),
  report_version int DEFAULT 1,
  input_snapshot jsonb NOT NULL,
  output_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owned_ev_reports_user_vehicle
  ON owned_ev_reports(user_id, garage_vehicle_id, report_type);

-- 3. Owned EV entitlements — tracks paid Sellers Report unlocks
CREATE TABLE IF NOT EXISTS owned_ev_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  garage_vehicle_id uuid NOT NULL REFERENCES garage_vehicles(id) ON DELETE CASCADE,
  entitlement_type text NOT NULL DEFAULT 'sellers_report_pdf',
  stripe_purchase_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_owned_ev_entitlements_unique
  ON owned_ev_entitlements(user_id, garage_vehicle_id, entitlement_type);
