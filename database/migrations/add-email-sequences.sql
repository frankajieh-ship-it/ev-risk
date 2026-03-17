-- Email Nudge Sequences
-- Tracks 7-day retention email sequences for users who opt in.
-- Triggered after EVFit completion or receipt generation.
-- Append-only intent — do not delete rows; use unsubscribed flag instead.

CREATE TABLE IF NOT EXISTS email_sequences (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL,
  anon_id         TEXT,                          -- receipt_token or persistent_session_id
  trigger_event   TEXT        NOT NULL,          -- 'receipt_generated' | 'evfit_completed'
  trigger_id      TEXT,                          -- receipt_id or session_id
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  day1_sent_at    TIMESTAMPTZ,
  day3_sent_at    TIMESTAMPTZ,
  day7_sent_at    TIMESTAMPTZ,
  unsubscribed    BOOLEAN     NOT NULL DEFAULT false,
  unsubscribed_at TIMESTAMPTZ,
  metadata        JSONB                          -- vehicle, fit_verdict, top_vehicle, etc.
);

-- Prevent double-enrollment for same email + trigger combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_sequences_email_trigger
  ON email_sequences(email, trigger_event, COALESCE(trigger_id, ''));

-- Efficient scan for pending sends (only active subscribers)
CREATE INDEX IF NOT EXISTS idx_email_sequences_pending
  ON email_sequences(enrolled_at)
  WHERE unsubscribed = false;

-- Service-role only: no anon reads or writes
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON email_sequences
  TO service_role USING (true) WITH CHECK (true);
