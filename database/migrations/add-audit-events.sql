-- Audit events table: immutable log of security-relevant actions
-- Append-only by convention — never UPDATE or DELETE rows.
-- Covers: auth events, permission denials, admin actions, payment fulfillment.

CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id    TEXT,                   -- anon_id, user_id UUID as text, or NULL for unknown
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('anon', 'user', 'system', 'webhook')),
  action      TEXT NOT NULL,          -- e.g. 'auth.otp_sent', 'payment.fulfilled', 'admin.access_denied'
  resource    TEXT,                   -- e.g. 'receipt:abc123', 'purchase:xyz'
  result      TEXT NOT NULL CHECK (result IN ('ok', 'denied', 'error')),
  ip          TEXT,
  user_agent  TEXT,
  metadata    JSONB                   -- action-specific context; never log raw tokens or secrets
);

CREATE INDEX IF NOT EXISTS audit_events_actor_idx  ON audit_events (actor_id, ts DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events (action, ts DESC);
CREATE INDEX IF NOT EXISTS audit_events_ts_idx     ON audit_events (ts DESC);

-- Service-role only: no anon or authenticated user can read or write directly
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON audit_events
  TO service_role USING (true) WITH CHECK (true);
