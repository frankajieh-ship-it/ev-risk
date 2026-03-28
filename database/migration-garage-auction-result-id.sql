-- Garage Vehicles — auction_result_id column
-- Adds the stable auc_xxx identifier for linking garage entries to /auction/[resultId] URLs.
-- The UUID auction_analysis_id FK was added in migration-auction-platform.sql.
-- This adds the human-readable stable ID separately for URL construction.

ALTER TABLE garage_vehicles
  ADD COLUMN IF NOT EXISTS auction_result_id text;

CREATE INDEX IF NOT EXISTS idx_garage_vehicles_auction_result_id
  ON garage_vehicles (auction_result_id)
  WHERE auction_result_id IS NOT NULL;
