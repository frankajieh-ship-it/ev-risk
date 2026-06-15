-- curated_deals v4: EVRoutine fit model fields + future-domain expansion
-- Run in Supabase SQL editor

ALTER TABLE curated_deals
  -- ── Charging ────────────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS dcfc_kw_max        INT,           -- max DC fast charge rate (kW), e.g. 150
  ADD COLUMN IF NOT EXISTS ac_charger_kw      NUMERIC(4,1),  -- onboard AC charger (kW), e.g. 11.5
  ADD COLUMN IF NOT EXISTS charge_port_type   TEXT,          -- 'CCS' | 'CHAdeMO' | 'NACS' | 'J1772' | 'CCS+CHAdeMO'

  -- ── Range ───────────────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS epa_range_mi            INT,       -- EPA-rated range at new (miles)
  ADD COLUMN IF NOT EXISTS estimated_real_range_mi INT,       -- estimated real-world range at current mileage/SOH

  -- ── Seller & market ─────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS seller_type        TEXT,          -- 'private' | 'dealer' | 'cpo' | 'auction'
  ADD COLUMN IF NOT EXISTS days_on_market     INT,           -- days listing has been active (proxy for deal heat)

  -- ── Vehicle options (EVRoutine comfort + usability signals) ─────────────
  ADD COLUMN IF NOT EXISTS exterior_color     TEXT,          -- e.g. 'Pearl White', 'Midnight Silver'
  ADD COLUMN IF NOT EXISTS heated_seats       BOOLEAN,       -- front heated seats present
  ADD COLUMN IF NOT EXISTS heat_pump          BOOLEAN,       -- heat pump present (range in cold climates)
  ADD COLUMN IF NOT EXISTS tow_hitch          BOOLEAN,       -- tow hitch / towing capability

  -- ── Climate zone (battery degradation context) ──────────────────────────
  ADD COLUMN IF NOT EXISTS climate_zone       TEXT,          -- 'hot' | 'cold' | 'temperate' | 'humid' — derived from location state

  -- ── Warranty & future-value signals ─────────────────────────────────────
  ADD COLUMN IF NOT EXISTS warranty_remaining_months INT,    -- OEM battery warranty months remaining (0 = expired)
  ADD COLUMN IF NOT EXISTS supercharger_access       BOOLEAN, -- Tesla Supercharger network access (non-Tesla: false unless adapter confirmed)
  ADD COLUMN IF NOT EXISTS ota_capable               BOOLEAN; -- receives OTA software updates

-- Index for EVRoutine fit queries (range + charging + climate)
CREATE INDEX IF NOT EXISTS idx_curated_deals_evroutine
  ON curated_deals(epa_range_mi, dcfc_kw_max, climate_zone, is_active)
  WHERE is_active = TRUE;

-- Index for seller type filtering
CREATE INDEX IF NOT EXISTS idx_curated_deals_seller
  ON curated_deals(seller_type, deal_quality_score DESC)
  WHERE is_active = TRUE;
