-- OFFO News Engine + Recall Alerts Migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- All statements are idempotent (IF NOT EXISTS) — safe to re-run.

-- ============================================================================
-- Table: daily_routine_news
-- Stores scored articles from RSS + NewsData.io daily pipeline.
-- article_id is a stable sha256(url)[:16] dedup key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_routine_news (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    scored_at           TIMESTAMPTZ,

    -- Article metadata
    article_id          TEXT UNIQUE NOT NULL,  -- sha256 dedup key (16 hex chars)
    title               TEXT NOT NULL,
    summary             TEXT,
    url                 TEXT NOT NULL,
    source              TEXT,                  -- 'Electrek', 'InsideEVs', 'newsdata', etc.
    published_at        TEXT,                  -- raw string from feed (varies by source)

    -- AI scoring (Grok)
    impact_score        INT NOT NULL DEFAULT 0
                        CHECK (impact_score BETWEEN 0 AND 100),
    is_routine_impact   BOOLEAN NOT NULL DEFAULT FALSE,
    key_routine_effects TEXT[],                -- ['charging', 'recall', 'winter', 'range', ...]
    ai_summary          TEXT,                  -- Grok one-sentence routine impact summary
    post_worthy         BOOLEAN NOT NULL DEFAULT FALSE,

    -- Generated posts (populated on-demand via dashboard)
    generated_x_thread  JSONB,
    generated_facebook  JSONB,
    generated_reddit    JSONB,
    posts_generated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_daily_routine_news_scored_at
    ON daily_routine_news(scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_routine_news_impact_score
    ON daily_routine_news(impact_score DESC);

CREATE INDEX IF NOT EXISTS idx_daily_routine_news_is_routine_impact
    ON daily_routine_news(is_routine_impact);

CREATE INDEX IF NOT EXISTS idx_daily_routine_news_key_effects
    ON daily_routine_news USING GIN(key_routine_effects);

CREATE INDEX IF NOT EXISTS idx_daily_routine_news_source
    ON daily_routine_news(source);


-- ============================================================================
-- Table: vehicle_recalls
-- Stores recall data per saved garage vehicle.
-- Scanned daily by recall_scanner.py via NHTSA free API.
-- UNIQUE on (vehicle_id, recall_id) — safe to re-run scanner daily.
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_recalls (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Links
    vehicle_id           UUID REFERENCES garage_vehicles(id) ON DELETE CASCADE,
    user_id              UUID,                  -- denormalized for fast per-user queries

    -- Recall identity
    recall_id            TEXT NOT NULL,         -- NHTSA campaign number (e.g. '21V-650')
    source               TEXT NOT NULL DEFAULT 'nhtsa',  -- 'nhtsa' | 'autodev' | 'vinaudit'

    -- Recall content
    title                TEXT NOT NULL,
    description          TEXT,
    consequence          TEXT,
    remedy               TEXT,
    manufacturer         TEXT,
    recall_date          DATE,
    component            TEXT,                  -- 'BATTERY', 'CHARGING PORT', 'SOFTWARE', etc.

    -- AI routine impact scoring (Grok)
    routine_impact_score INT DEFAULT 0
                         CHECK (routine_impact_score BETWEEN 0 AND 10),
    affected_systems     TEXT[],                -- ['battery', 'charging', 'software', 'range', 'safety']
    ai_summary           TEXT,                  -- one-sentence routine impact summary
    is_safety_critical   BOOLEAN NOT NULL DEFAULT FALSE,

    -- Lifecycle status
    status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'fixed', 'dismissed', 'unknown')),

    -- Notification timestamps
    notified_at          TIMESTAMPTZ,
    dismissed_at         TIMESTAMPTZ,
    acknowledged_at      TIMESTAMPTZ,

    -- Dedup: one record per (vehicle, recall_id) — scanner can safely re-run daily
    UNIQUE (vehicle_id, recall_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_recalls_vehicle_id
    ON vehicle_recalls(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_recalls_user_id
    ON vehicle_recalls(user_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_recalls_status
    ON vehicle_recalls(status);

CREATE INDEX IF NOT EXISTS idx_vehicle_recalls_created_at
    ON vehicle_recalls(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_recalls_routine_impact
    ON vehicle_recalls(routine_impact_score DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_recalls_safety_critical
    ON vehicle_recalls(is_safety_critical)
    WHERE is_safety_critical = TRUE;


-- ============================================================================
-- Table: recall_scan_log
-- Lightweight telemetry for each daily scanner run.
-- Useful for monitoring cron health in Supabase dashboard.
-- ============================================================================

CREATE TABLE IF NOT EXISTS recall_scan_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    vehicles_scanned INT NOT NULL DEFAULT 0,
    recalls_found    INT NOT NULL DEFAULT 0,
    new_recalls      INT NOT NULL DEFAULT 0,
    errors           INT NOT NULL DEFAULT 0,
    duration_ms      INT,
    run_by           TEXT DEFAULT 'cron'   -- 'cron' | 'manual' | 'api'
);

CREATE INDEX IF NOT EXISTS idx_recall_scan_log_created_at
    ON recall_scan_log(created_at DESC);
