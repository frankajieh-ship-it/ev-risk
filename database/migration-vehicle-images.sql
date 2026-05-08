-- OFFO Vehicle Image Cache
-- Stores extracted vehicle images with quality scores and source attribution.
-- Cache keys: VIN (exact) or make+model+year+trim (YMM).

CREATE TABLE IF NOT EXISTS vehicle_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Vehicle identity (cache keys)
  vin             TEXT,
  make            TEXT NOT NULL,
  model           TEXT NOT NULL,
  year            INT NOT NULL,
  trim            TEXT,

  -- Images (ordered best-first)
  urls            TEXT[] NOT NULL DEFAULT '{}',
  primary_url     TEXT NOT NULL,
  url_count       INT NOT NULL DEFAULT 0,

  -- Quality metadata
  quality_score   INT NOT NULL DEFAULT 0,   -- 0-100
  source          TEXT NOT NULL,            -- 'vinaudit_vin' | 'vinaudit_ymm' | 'listing_scrape' | 'wikimedia'
  extraction_ms   INT,

  -- Cache control
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  hit_count       INT NOT NULL DEFAULT 0
);

-- Indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_images_vin
  ON vehicle_images (vin)
  WHERE vin IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_images_ymm
  ON vehicle_images (lower(make), lower(model), year, lower(coalesce(trim, '')));

CREATE INDEX IF NOT EXISTS idx_vehicle_images_expires
  ON vehicle_images (expires_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_vehicle_images_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicle_images_updated_at ON vehicle_images;
CREATE TRIGGER trg_vehicle_images_updated_at
  BEFORE UPDATE ON vehicle_images
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_images_updated_at();
