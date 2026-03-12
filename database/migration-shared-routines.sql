/**
 * Migration: Shared Routines + Invites
 *
 * Creates tables for:
 * - shared_routines: public EV Fit share links (mirrors shared_receipts)
 * - invites: co-shopper invite tokens
 *
 * Run with:
 *   psql $DATABASE_URL < database/migration-shared-routines.sql
 */

BEGIN;

-- ============================================================
-- shared_routines
-- ============================================================

CREATE TABLE IF NOT EXISTS shared_routines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_slug       TEXT UNIQUE NOT NULL,
  run_id           UUID NOT NULL,
  snapshot_json    JSONB NOT NULL,
  creator_anon_id  TEXT,
  view_count       INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shared_routines_slug ON shared_routines(share_slug);
CREATE INDEX IF NOT EXISTS idx_shared_routines_run_id ON shared_routines(run_id);
CREATE INDEX IF NOT EXISTS idx_shared_routines_created_at ON shared_routines(created_at);

-- ============================================================
-- invites
-- ============================================================

CREATE TABLE IF NOT EXISTS invites (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token              TEXT UNIQUE NOT NULL,
  inviter_user_id    UUID,
  inviter_anon_id    TEXT,
  share_slug         TEXT NOT NULL REFERENCES shared_routines(share_slug) ON DELETE CASCADE,
  invitee_email      TEXT,
  status             TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'converted')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  opened_at          TIMESTAMPTZ,
  converted_at       TIMESTAMPTZ,
  converted_anon_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_share_slug ON invites(share_slug);
CREATE INDEX IF NOT EXISTS idx_invites_inviter_anon ON invites(inviter_anon_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
CREATE INDEX IF NOT EXISTS idx_invites_created_at ON invites(created_at);

COMMIT;
