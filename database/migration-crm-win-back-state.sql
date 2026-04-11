-- CRM Win-Back State
-- Tracks which auth users are in the win-back sequence and which steps have been sent.

CREATE TABLE IF NOT EXISTS crm_win_back_state (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL UNIQUE,
  email               TEXT        NOT NULL,
  winback_30_sent_at  TIMESTAMPTZ NULL,
  winback_60_sent_at  TIMESTAMPTZ NULL,
  last_receipt_at     TIMESTAMPTZ NULL,   -- snapshot of last activity at enrollment time
  enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at           TIMESTAMPTZ NULL    -- set when user returns (generates receipt / logs in)
);

CREATE INDEX IF NOT EXISTS idx_win_back_pending
  ON crm_win_back_state(enrolled_at)
  WHERE exited_at IS NULL;

ALTER TABLE crm_win_back_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "win_back_service_role" ON crm_win_back_state
  TO service_role USING (true) WITH CHECK (true);
