-- Migration: receipt_upgrade_jobs
-- Persistent job queue for background receipt AI upgrades.
-- Replaces fire-and-forget HTTP enqueue with durable, retryable records.
-- Every enqueue attempt is recorded; failures are visible and auto-retried
-- by the scan-stuck-upgrades scheduled function (every 5 minutes).

CREATE TABLE IF NOT EXISTS receipt_upgrade_jobs (
  job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id    UUID NOT NULL,
  receipt_token TEXT NOT NULL,
  -- Full UpgradePayload stored so retry needs no reconstruction from other tables
  payload       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'dead_letter')),
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  last_error    TEXT,
  -- next_retry_at: when the scanner should next attempt this job (exponential backoff)
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for the retry scanner: finds jobs due for retry in one seek
CREATE INDEX IF NOT EXISTS idx_upgrade_jobs_retry
  ON receipt_upgrade_jobs (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

-- Index for orphaned-processing detection: finds jobs stuck in processing
CREATE INDEX IF NOT EXISTS idx_upgrade_jobs_processing
  ON receipt_upgrade_jobs (status, updated_at)
  WHERE status = 'processing';

-- Index for receipt lookup (admin panel / manual retry endpoint)
CREATE INDEX IF NOT EXISTS idx_upgrade_jobs_receipt_id
  ON receipt_upgrade_jobs (receipt_id);
