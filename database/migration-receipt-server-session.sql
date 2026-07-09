-- Add server_session_id to receipts table.
-- This column stores an HttpOnly cookie value set by the server on first receipt generation.
-- It survives localStorage clears, making it a second identity signal for the first-receipt-free check.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS server_session_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_server_session ON receipts(server_session_id) WHERE server_session_id IS NOT NULL;
