-- Receipt request idempotency table
-- Prevents duplicate receipt generation from rapid clicks or retries
-- Cache TTL: 5 minutes (enforced in application code)

CREATE TABLE IF NOT EXISTS receipt_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  ip_hash TEXT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  receipt_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  output_json JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_receipt_requests_hash
  ON receipt_requests(input_hash, created_at);
