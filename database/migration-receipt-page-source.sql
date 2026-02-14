-- Add page_source column to receipts table for SEO attribution tracking
-- Tracks which SEO page (e.g., "seo:checklists:underpriced-ev-listing") originated the receipt

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS page_source TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_page_source ON receipts(page_source);
