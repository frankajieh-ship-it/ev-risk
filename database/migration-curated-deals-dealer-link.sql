-- Link curated_deals to dealerships
-- Allows OFFO dealer inventory to appear on the public /deals page
-- with a verified badge and priority ranking.

ALTER TABLE curated_deals
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_curated_deals_dealership
  ON curated_deals(dealership_id, is_active, deal_quality_score DESC)
  WHERE is_active = TRUE AND dealership_id IS NOT NULL;
