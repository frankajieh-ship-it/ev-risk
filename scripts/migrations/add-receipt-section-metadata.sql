-- Add provider tracking columns to receipt_events
-- Supports analytics on which AI provider was used, hedge level, latency, and attempts.

ALTER TABLE receipt_events
  ADD COLUMN IF NOT EXISTS provider_used TEXT,
  ADD COLUMN IF NOT EXISTS hedge_level   INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms    INTEGER,
  ADD COLUMN IF NOT EXISTS attempts      INTEGER;

-- Index for provider analytics queries
CREATE INDEX IF NOT EXISTS idx_receipt_events_provider
  ON receipt_events (provider_used, created_at DESC)
  WHERE provider_used IS NOT NULL;

-- The receipts.sections JSONB column already exists.
-- The new shape for sections.core (no schema change needed — JSONB is flexible):
--
-- {
--   "core": {
--     "status": "ready",
--     "updated_at": "2025-01-01T00:00:00Z",
--     "provider_used": "openai" | "gemini" | "grok",
--     "latency_ms": 4200,
--     "attempts": 1,
--     "hedge_level": 0         -- 0=primary won, 1=secondary, 2=tertiary
--   },
--   "reddit_draft":     { "status": "not_requested" },
--   "receipt_details":  { "status": "not_requested" },
--   "negotiation_deep": { "status": "not_requested" }
-- }
