-- Add per-section generation status tracking to receipts table.
-- Each section (reddit_draft, receipt_details, negotiation_deep) is
-- generated on-demand when the user requests it, rather than bundled
-- into the core upgrade call.
--
-- sections JSONB structure:
-- {
--   "core":             { "status": "ready"|"running"|"failed", "updated_at": ISO },
--   "reddit_draft":     { "status": "not_requested"|"running"|"ready"|"failed", "updated_at"?: ISO },
--   "receipt_details":  { "status": "not_requested"|"running"|"ready"|"failed", "updated_at"?: ISO },
--   "negotiation_deep": { "status": "not_requested"|"running"|"ready"|"failed", "updated_at"?: ISO }
-- }

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT NULL;

-- Index for status queries (e.g. find stuck "running" sections for monitoring)
CREATE INDEX IF NOT EXISTS receipts_sections_idx ON receipts USING GIN (sections);
