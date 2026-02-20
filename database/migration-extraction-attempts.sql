-- Extraction attempts diagnostics table
-- Tracks every URL/text extraction attempt with detailed diagnostics
-- for debugging extraction failures and measuring success rates.

CREATE TABLE IF NOT EXISTS extraction_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT,
  domain TEXT,
  input_mode TEXT CHECK (input_mode IN ('url', 'text')),
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  fetch_method TEXT,
  proxy_status INTEGER,
  direct_status INTEGER,
  bot_protection_detected BOOLEAN DEFAULT FALSE,
  bot_protection_type TEXT,
  extracted_field_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_extraction_domain ON extraction_attempts(domain);
CREATE INDEX IF NOT EXISTS idx_extraction_created ON extraction_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_extraction_session ON extraction_attempts(session_id);
