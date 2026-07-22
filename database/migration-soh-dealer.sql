-- Dealer OBD Battery Scan System
--
-- Creates battery_scans (the core scan result table) plus two supporting tables:
--   soh_pid_maps    — OBD PID definitions per make/model, used by the mobile PWA
--                     to know which commands to send the dongle for each vehicle
--   soh_scan_sessions — a dealer initiates a session for a VIN before scanning;
--                       this links a battery_scans row to a dealer and gives the
--                       mobile app a token to post readings against
--
-- The badge logic: receipts check battery_scans for a verified row matching the VIN.


-- ── 0. battery_scans ───────────────────────────────────────────────────────────
-- Core scan result table. Each row is one OBD read for one VIN at one point in time.

CREATE TABLE IF NOT EXISTS battery_scans (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vin                  TEXT        NOT NULL,
  dealer_id            UUID        NULL REFERENCES dealerships(id) ON DELETE SET NULL,
  scanned_by           UUID        NULL,
  dongle_serial        TEXT        NULL,

  soh_percent          NUMERIC(5,2) NOT NULL CHECK (soh_percent >= 0 AND soh_percent <= 100),
  capacity_kwh         NUMERIC(6,2) NULL,
  capacity_nominal_kwh NUMERIC(6,2) NULL,
  cycle_count          INTEGER     NULL,
  cell_voltages        JSONB       NULL,
  cell_min_v           NUMERIC(5,3) NULL,
  cell_max_v           NUMERIC(5,3) NULL,
  cell_delta_mv        NUMERIC(6,1) NULL,

  odometer_miles       INTEGER     NULL,
  vehicle_year         INTEGER     NULL,
  vehicle_make         TEXT        NULL,
  vehicle_model        TEXT        NULL,

  obd_tool             TEXT        NULL,
  pid_profile          TEXT        NULL,
  raw_pids             JSONB       NULL,
  scan_duration_ms     INTEGER     NULL,

  verified             BOOLEAN     NOT NULL DEFAULT true,
  notes                TEXT        NULL,

  scanned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battery_scans_vin
  ON battery_scans(vin, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_battery_scans_dealer
  ON battery_scans(dealer_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_battery_scans_vehicle
  ON battery_scans(vehicle_make, vehicle_model, vehicle_year);

CREATE INDEX IF NOT EXISTS idx_battery_scans_verified
  ON battery_scans(vin, verified, scanned_at DESC)
  WHERE verified = true;

ALTER TABLE battery_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers read own scans"
  ON battery_scans FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealership_id FROM dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access battery_scans"
  ON battery_scans FOR ALL
  USING (auth.role() = 'service_role');


-- ── 1. PID Maps ────────────────────────────────────────────────────────────────
-- One row per make/model/year_range with the full set of PIDs needed to compute SOH.
-- The mobile app fetches the correct profile after VIN decode.

CREATE TABLE IF NOT EXISTS soh_pid_maps (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  make            TEXT    NOT NULL,
  model           TEXT    NOT NULL,
  year_min        INTEGER NOT NULL,
  year_max        INTEGER NOT NULL,    -- inclusive; use 9999 for "current"
  pid_profile     TEXT    NOT NULL,    -- short key: 'leaf', 'bolt', 'ioniq5', 'model3y', 'id4'
  protocol        TEXT    NOT NULL,    -- 'ISO15765' (CAN), 'KWP2000', 'J1850'
  pids            JSONB   NOT NULL,    -- array of {name, mode, pid, formula, unit, description}
  soh_formula     TEXT    NOT NULL,    -- human-readable description of how SOH is derived
  soh_field       TEXT    NOT NULL,    -- which pid name holds the SOH value (or 'computed')
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_soh_pid_maps_profile
  ON soh_pid_maps(make, model, year_min, year_max);

CREATE INDEX IF NOT EXISTS idx_soh_pid_maps_make_model
  ON soh_pid_maps(make, model);

-- ── 2. Scan Sessions ───────────────────────────────────────────────────────────
-- A dealer opens a session for a VIN before scanning; the mobile app receives
-- a session_token to POST raw PID readings against.  After submission, the
-- backend computes SOH and writes the battery_scans row.

CREATE TABLE IF NOT EXISTS soh_scan_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token   TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  dealer_id       UUID        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  scanned_by      UUID        NOT NULL REFERENCES auth.users(id),
  vin             TEXT        NOT NULL,
  vehicle_year    INTEGER,
  vehicle_make    TEXT,
  vehicle_model   TEXT,
  vehicle_trim    TEXT,
  odometer_miles  INTEGER,
  pid_profile     TEXT,       -- resolved after VIN decode; null if unknown model
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'scanning', 'processing', 'complete', 'failed')),
  battery_scan_id UUID        REFERENCES battery_scans(id) ON DELETE SET NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_soh_sessions_dealer
  ON soh_scan_sessions(dealer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_soh_sessions_token
  ON soh_scan_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_soh_sessions_vin
  ON soh_scan_sessions(vin, created_at DESC);


-- ── 3. RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE soh_pid_maps ENABLE ROW LEVEL SECURITY;

-- PID maps are public read (the PWA is unauthenticated at scan time)
CREATE POLICY "Anyone can read pid maps"
  ON soh_pid_maps FOR SELECT
  USING (true);

CREATE POLICY "Service role manages pid maps"
  ON soh_pid_maps FOR ALL
  USING (auth.role() = 'service_role');


ALTER TABLE soh_scan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers read own sessions"
  ON soh_scan_sessions FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealership_id FROM dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Dealers insert own sessions"
  ON soh_scan_sessions FOR INSERT
  WITH CHECK (
    dealer_id IN (
      SELECT dealership_id FROM dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access sessions"
  ON soh_scan_sessions FOR ALL
  USING (auth.role() = 'service_role');


-- ── 4. Seed PID Maps ───────────────────────────────────────────────────────────
-- Vehicle-specific PID definitions.  The `pids` JSONB array has objects:
--   { name, mode, pid, formula, unit, description }
-- The mobile PWA iterates this list, sends each OBD command, and POSTs raw results.

-- Nissan Leaf (2011–2024) — uses proprietary Nissan CAN PIDs via mode 22
INSERT INTO soh_pid_maps (make, model, year_min, year_max, pid_profile, protocol, soh_field, soh_formula, pids, notes)
VALUES (
  'Nissan', 'LEAF', 2011, 2024, 'leaf', 'ISO15765',
  'SOH', 'SOH = Hx / Hf * 100, where Hx is current maximum capacity from PID 5b3 and Hf is factory capacity',
  '[
    {"name":"SOH",          "mode":"22","pid":"5b3","formula":"A / 2.0","unit":"%",    "description":"State of Health (0-100%)"},
    {"name":"SOC",          "mode":"22","pid":"5b4","formula":"A / 2.0","unit":"%",    "description":"State of Charge"},
    {"name":"PackVoltage",  "mode":"22","pid":"5bc","formula":"(A*256+B)/100.0","unit":"V","description":"HV battery pack voltage"},
    {"name":"PackCurrent",  "mode":"22","pid":"5bd","formula":"(A*256+B-32768)/100.0","unit":"A","description":"HV battery current"},
    {"name":"MaxCapacity",  "mode":"22","pid":"5b3","formula":"A / 2.0","unit":"Ah",   "description":"Battery max capacity"},
    {"name":"CellTempMax",  "mode":"22","pid":"5c0","formula":"(A-40)","unit":"°C",    "description":"Max cell temperature"},
    {"name":"CellTempMin",  "mode":"22","pid":"5c1","formula":"(A-40)","unit":"°C",    "description":"Min cell temperature"},
    {"name":"Odometer",     "mode":"22","pid":"412","formula":"(A*65536+B*256+C)","unit":"km","description":"Odometer reading"}
  ]'::jsonb,
  'Nissan Leaf 24kWh (Gen1), 30kWh, 40kWh, 62kWh. SOH PID works across all generations. Tested with LeafSpy and OBDLink MX+.'
),

-- Chevy Bolt EV/EUV (2017–2024) — GM proprietary PIDs via mode 22
(
  'Chevrolet', 'Bolt EV', 2017, 2024, 'bolt', 'ISO15765',
  'PackSOH', 'SOH = PackSOH PID value directly (GM reports it natively as a percentage)',
  '[
    {"name":"PackSOH",      "mode":"22","pid":"4140","formula":"A * 0.5","unit":"%",   "description":"Pack State of Health"},
    {"name":"PackSOC",      "mode":"22","pid":"4110","formula":"A * 0.5","unit":"%",   "description":"Pack State of Charge"},
    {"name":"PackVoltage",  "mode":"22","pid":"4113","formula":"(A*256+B) * 0.1","unit":"V","description":"HV pack voltage"},
    {"name":"PackCurrent",  "mode":"22","pid":"4114","formula":"(A*256+B-32768) * 0.05","unit":"A","description":"Pack current"},
    {"name":"CellVoltages", "mode":"22","pid":"4161","formula":"raw","unit":"V",       "description":"All cell voltages (96 cells)"},
    {"name":"MinCellVolt",  "mode":"22","pid":"4162","formula":"(A*256+B) * 0.001","unit":"V","description":"Minimum cell voltage"},
    {"name":"MaxCellVolt",  "mode":"22","pid":"4163","formula":"(A*256+B) * 0.001","unit":"V","description":"Maximum cell voltage"},
    {"name":"CycleCount",   "mode":"22","pid":"4151","formula":"A*256+B","unit":"",    "description":"Charge cycle count"}
  ]'::jsonb,
  'Chevrolet Bolt EV 2017-2023 (60kWh) and Bolt EUV 2022-2024 (65kWh). GM BMS reports SOH natively. Tested with OBDLink EX and ScanGauge.'
),

-- Hyundai Ioniq 5 (2022–2024) — Hyundai/Kia proprietary PIDs
(
  'Hyundai', 'IONIQ 5', 2022, 2024, 'ioniq5', 'ISO15765',
  'computed', 'SOH = (BMS_MaxCapacity / NominalCapacity) * 100 where nominal is 77.4kWh for long range',
  '[
    {"name":"BMS_SOH",      "mode":"22","pid":"01050015","formula":"(A*256+B) * 0.1","unit":"%","description":"BMS reported SOH"},
    {"name":"BMS_SOC",      "mode":"22","pid":"01050016","formula":"(A*256+B) * 0.1","unit":"%","description":"BMS reported SOC"},
    {"name":"PackVoltage",  "mode":"22","pid":"01050001","formula":"(A*256+B) * 0.1","unit":"V","description":"HV battery voltage"},
    {"name":"PackCurrent",  "mode":"22","pid":"01050002","formula":"(A*256+B-32768) * 0.1","unit":"A","description":"HV battery current"},
    {"name":"MaxCapacity",  "mode":"22","pid":"01050021","formula":"(A*256+B) * 0.1","unit":"Ah","description":"Max available capacity"},
    {"name":"CellVoltMin",  "mode":"22","pid":"01050010","formula":"(A*256+B) * 0.001","unit":"V","description":"Min cell voltage"},
    {"name":"CellVoltMax",  "mode":"22","pid":"01050011","formula":"(A*256+B) * 0.001","unit":"V","description":"Max cell voltage"},
    {"name":"ModuleTempMax","mode":"22","pid":"01050012","formula":"(A-40)","unit":"°C","description":"Max module temperature"}
  ]'::jsonb,
  'Hyundai IONIQ 5 RWD (58kWh / 77.4kWh) and AWD. Uses Hyundai BMS CAN IDs. Same PIDs work on Kia EV6 — set pid_profile to ioniq5. Tested with OBDLink MX+.'
),

-- Tesla Model 3 / Model Y (2018–2024) — Tesla OBD via ELM327 BMS bridge
(
  'Tesla', 'Model 3', 2018, 2024, 'model3y', 'ISO15765',
  'computed', 'SOH = (ChargeEnergyToFull / NominalEnergy) * 100; Nominal: 57.5kWh SR+, 75kWh LR, 82kWh Perf',
  '[
    {"name":"BatteryLevel",    "mode":"22","pid":"0200","formula":"A * 0.5","unit":"%","description":"Battery level percent"},
    {"name":"PackVoltage",     "mode":"22","pid":"0210","formula":"(A*256+B) * 0.1","unit":"V","description":"Battery pack voltage"},
    {"name":"ChargeLimit",     "mode":"22","pid":"0204","formula":"A","unit":"%","description":"Charge limit setting"},
    {"name":"EstRange",        "mode":"22","pid":"0201","formula":"(A*256+B)","unit":"mi","description":"Estimated range"},
    {"name":"NominalRemaining","mode":"22","pid":"0260","formula":"(A*256+B) * 0.01","unit":"kWh","description":"Nominal energy remaining"},
    {"name":"NominalFull",     "mode":"22","pid":"0261","formula":"(A*256+B) * 0.01","unit":"kWh","description":"Nominal full pack energy"},
    {"name":"Odometer",        "mode":"22","pid":"0280","formula":"(A*65536+B*256+C) * 0.1","unit":"mi","description":"Odometer"},
    {"name":"ChargeCount",     "mode":"22","pid":"0268","formula":"A*256+B","unit":"","description":"Charge count"}
  ]'::jsonb,
  'Tesla Model 3 and Model Y all variants. Requires Tesla-specific ELM327 adapter (TM3 BMS bridge mode). Standard OBD PIDs do not work on Tesla — must use mode 22 with BMS pairing. OBDLink CX or compatible adapter required.'
),
(
  'Tesla', 'Model Y', 2020, 2024, 'model3y', 'ISO15765',
  'computed', 'SOH = (NominalFull / NominalCapacity) * 100; Nominal: 75kWh SR, 82kWh LR/Perf',
  '[
    {"name":"BatteryLevel",    "mode":"22","pid":"0200","formula":"A * 0.5","unit":"%","description":"Battery level percent"},
    {"name":"PackVoltage",     "mode":"22","pid":"0210","formula":"(A*256+B) * 0.1","unit":"V","description":"Battery pack voltage"},
    {"name":"NominalRemaining","mode":"22","pid":"0260","formula":"(A*256+B) * 0.01","unit":"kWh","description":"Nominal energy remaining"},
    {"name":"NominalFull",     "mode":"22","pid":"0261","formula":"(A*256+B) * 0.01","unit":"kWh","description":"Nominal full pack energy"},
    {"name":"Odometer",        "mode":"22","pid":"0280","formula":"(A*65536+B*256+C) * 0.1","unit":"mi","description":"Odometer"},
    {"name":"ChargeCount",     "mode":"22","pid":"0268","formula":"A*256+B","unit":"","description":"Charge count"}
  ]'::jsonb,
  'Same PID profile as Model 3. Use pid_profile=model3y for both.'
),

-- VW ID.4 (2021–2024) — VW MEB platform PIDs
(
  'Volkswagen', 'ID.4', 2021, 2024, 'id4', 'ISO15765',
  'computed', 'SOH = (MaxCapacity_Ah / NominalCapacity_Ah) * 100; Nominal 77kWh = ~208Ah at 370V nominal',
  '[
    {"name":"SOH",            "mode":"22","pid":"02a005","formula":"A","unit":"%","description":"BMS state of health"},
    {"name":"SOC",            "mode":"22","pid":"02a003","formula":"(A*256+B) * 0.1","unit":"%","description":"State of charge"},
    {"name":"PackVoltage",    "mode":"22","pid":"02a002","formula":"(A*256+B) * 0.1","unit":"V","description":"HV pack voltage"},
    {"name":"PackCurrent",    "mode":"22","pid":"02a001","formula":"(A*256+B-32768) * 0.1","unit":"A","description":"HV current"},
    {"name":"MaxCapacity",    "mode":"22","pid":"02a00a","formula":"(A*256+B) * 0.1","unit":"Ah","description":"Current max capacity"},
    {"name":"CellVoltMin",    "mode":"22","pid":"02a006","formula":"(A*256+B) * 0.001","unit":"V","description":"Min cell voltage"},
    {"name":"CellVoltMax",    "mode":"22","pid":"02a007","formula":"(A*256+B) * 0.001","unit":"V","description":"Max cell voltage"},
    {"name":"CellVoltDelta",  "mode":"22","pid":"02a008","formula":"(A*256+B)","unit":"mV","description":"Cell voltage spread"},
    {"name":"TempMax",        "mode":"22","pid":"02a009","formula":"(A-40)","unit":"°C","description":"Max cell temperature"}
  ]'::jsonb,
  'VW ID.4 AWD and RWD (77kWh). MEB platform shared with Audi Q4 e-tron and Skoda Enyaq — same PIDs. VW reports SOH natively as a percentage via BMS. Tested with OBDLink MX+ and VCDS-compatible adapters.'
);
