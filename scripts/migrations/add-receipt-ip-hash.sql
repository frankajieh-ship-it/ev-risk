ALTER TABLE receipt_events ADD COLUMN IF NOT EXISTS ip_hash TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_receipt_events_ip_hash
  ON receipt_events(ip_hash, created_at);
