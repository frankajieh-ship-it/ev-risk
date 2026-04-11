-- CRM Email Preferences
-- Per-address opt-in/out settings, bounce tracking, and global suppression.

CREATE TABLE IF NOT EXISTS crm_email_preferences (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE,
  user_id         UUID        NULL,
  -- Per-sequence opt-in booleans (default true = opted in)
  activation      BOOLEAN     NOT NULL DEFAULT true,
  win_back        BOOLEAN     NOT NULL DEFAULT true,
  conversion      BOOLEAN     NOT NULL DEFAULT true,
  weekly_digest   BOOLEAN     NOT NULL DEFAULT true,
  deal_watch      BOOLEAN     NOT NULL DEFAULT true,
  recall          BOOLEAN     NOT NULL DEFAULT true,
  -- Global kill switch
  all_marketing   BOOLEAN     NOT NULL DEFAULT true,
  -- Bounce / complaint tracking
  bounced         BOOLEAN     NOT NULL DEFAULT false,
  bounced_at      TIMESTAMPTZ NULL,
  bounce_type     TEXT        NULL   CHECK (bounce_type IN ('hard','soft','complaint')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_prefs_user_id
  ON crm_email_preferences(user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE crm_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_prefs_service_role" ON crm_email_preferences
  TO service_role USING (true) WITH CHECK (true);
