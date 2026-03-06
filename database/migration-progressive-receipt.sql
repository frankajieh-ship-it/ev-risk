-- Progressive Receipt: add generation_status column
-- Default 'full' means all existing receipts are unaffected.
-- New receipts start as 'lite' and upgrade to 'full' when AI completes.

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'full'
    CHECK (generation_status IN ('lite', 'generating', 'full', 'failed'));
