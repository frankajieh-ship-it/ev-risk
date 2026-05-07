-- Add sold_report_count to curated_deals for user-submitted "this listing is sold" flags.
-- When count reaches 2, the API route automatically sets is_active = false.
ALTER TABLE curated_deals ADD COLUMN IF NOT EXISTS sold_report_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_curated_deals_sold_report_count ON curated_deals(sold_report_count) WHERE sold_report_count > 0;
