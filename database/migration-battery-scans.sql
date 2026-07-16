-- Battery Scans — Dealer OBD verified reads
-- Populated by the OFFO dealer scanning app (PWA + OBD-II dongle).
-- Distinct from soh_submissions (buyer crowd-source) — these are
-- authoritative dealer-verified reads tied to a VIN at a point in time.
--
-- When a buyer runs an OFFO receipt on a VIN that has a battery_scans row,
-- the verified SOH badge is shown automatically on the report.

CREATE TABLE IF NOT EXISTS battery_scans (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vin               TEXT        NOT NULL,
  dealer_id         UUID        NULL REFERENCES dealerships(id) ON DELETE SET NULL,
  scanned_by        UUID        NULL,          -- dealer user_id who ran the scan
  dongle_serial     TEXT        NULL,          -- OBD dongle serial for audit trail

  -- Core battery metrics
  soh_percent       NUMERIC(5,2) NOT NULL CHECK (soh_percent >= 0 AND soh_percent <= 100),
  capacity_kwh      NUMERIC(6,2) NULL,         -- measured full charge capacity
  capacity_nominal_kwh NUMERIC(6,2) NULL,      -- factory nominal (for reference)
  cycle_count       INTEGER     NULL,
  cell_voltages     JSONB       NULL,          -- array of per-cell voltages if available
  cell_min_v        NUMERIC(5,3) NULL,
  cell_max_v        NUMERIC(5,3) NULL,
  cell_delta_mv     NUMERIC(6,1) NULL,         -- max - min in millivolts (balance indicator)

  -- Vehicle context at scan time
  odometer_miles    INTEGER     NULL,
  vehicle_year      INTEGER     NULL,
  vehicle_make      TEXT        NULL,
  vehicle_model     TEXT        NULL,

  -- Scan metadata
  obd_tool          TEXT        NULL,          -- 'obdlink_mx', 'veepeak', 'carscanner', 'leafspy', 'other'
  pid_profile       TEXT        NULL,          -- which PID table was used: 'bolt', 'leaf', 'ioniq', 'id4', 'generic'
  raw_pids          JSONB       NULL,          -- raw PID values for debugging/reprocessing
  scan_duration_ms  INTEGER     NULL,

  -- Status
  verified          BOOLEAN     NOT NULL DEFAULT true,  -- false if scan flagged as suspect
  notes             TEXT        NULL,

  scanned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary lookup: by VIN, newest first
CREATE INDEX IF NOT EXISTS idx_battery_scans_vin
  ON battery_scans(vin, scanned_at DESC);

-- Dealer dashboard: all scans for a dealer
CREATE INDEX IF NOT EXISTS idx_battery_scans_dealer
  ON battery_scans(dealer_id, scanned_at DESC);

-- Analytics: SOH distribution by make/model/year
CREATE INDEX IF NOT EXISTS idx_battery_scans_vehicle
  ON battery_scans(vehicle_make, vehicle_model, vehicle_year);

-- Latest verified scan per VIN (used by receipt badge logic)
CREATE INDEX IF NOT EXISTS idx_battery_scans_verified
  ON battery_scans(vin, verified, scanned_at DESC)
  WHERE verified = true;

-- RLS: dealers can read their own scans; service role has full access
ALTER TABLE battery_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers read own scans"
  ON battery_scans FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealership_id FROM dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access"
  ON battery_scans FOR ALL
  USING (auth.role() = 'service_role');
