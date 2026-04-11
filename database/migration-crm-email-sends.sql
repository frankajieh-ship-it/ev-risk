-- CRM Email Sends Log
-- Tracks every outbound CRM email with idempotency and Resend message ID.
-- All sequences (activation, win_back, conversion, weekly_digest) write here.

CREATE TABLE IF NOT EXISTS crm_email_sends (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT        NOT NULL,
  user_id           UUID        NULL,
  anon_id           TEXT        NULL,
  sequence_type     TEXT        NOT NULL
    CHECK (sequence_type IN ('activation','win_back','conversion','weekly_digest','deal_watch','recall')),
  sequence_step     TEXT        NOT NULL,
  subject           TEXT        NOT NULL,
  resend_message_id TEXT        NULL,
  status            TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','failed','skipped')),
  error_message     TEXT        NULL,
  idempotency_key   TEXT        NOT NULL,
  metadata          JSONB       NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_sends_idempotency
  ON crm_email_sends(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_crm_sends_email_seq
  ON crm_email_sends(email, sequence_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_sends_user_id
  ON crm_email_sends(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_sends_created
  ON crm_email_sends(created_at DESC);

ALTER TABLE crm_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_sends_service_role" ON crm_email_sends
  TO service_role USING (true) WITH CHECK (true);
