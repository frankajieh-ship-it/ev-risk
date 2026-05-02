-- OFFO Reddit Operator Tool v2 — Supabase Migration
-- Run this in the Supabase dashboard SQL editor or via supabase CLI: supabase db push
-- Replaces the local SQLite offo_operator.db file.

-- -------------------------
-- Table: reddit_operator_sessions
-- Replaces the SQLite "analyses" table.
-- Stores every /assist and /analyze call.
-- -------------------------

CREATE TABLE IF NOT EXISTS reddit_operator_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Request context
    mode                TEXT NOT NULL DEFAULT 'operator',  -- 'operator' | 'receipt' | 'analyze_v1'
    source              TEXT,
    subreddit           TEXT,
    thread_type         TEXT,
    region_hint         TEXT,
    tone                TEXT,
    post_title          TEXT,
    post_body           TEXT,
    top_comment_context JSONB,   -- array of strings
    receipt_id          TEXT,    -- FK reference to receipts table (receipt mode only)

    -- Classification output
    intent              TEXT,
    user_state          TEXT,
    ownership_phase     TEXT,
    friction_tags       TEXT[],  -- array (was CSV in SQLite)
    tool_intro          TEXT,    -- kept for /analyze backward compat

    -- Pipeline metadata
    pipeline_stages     TEXT[],  -- which stages actually ran
    grok_classify_ms    INT,
    claude_empathy_ms   INT,
    gpt4o_technical_ms  INT,
    grok_polish_ms      INT,
    total_latency_ms    INT,

    -- Draft output
    draft_reply_short   TEXT,
    draft_reply_long    TEXT,
    reddit_draft_json   JSONB,   -- receipt mode: full RedditDraft object
    safety_flags        TEXT[],

    -- EVRoutine funnel tracking
    evroutine_invited   BOOLEAN DEFAULT FALSE,
    invite_trigger      TEXT,    -- 'friction_tag' | 'user_uncertain' | 'asked_directly'
    invite_accepted     BOOLEAN, -- null = no action taken yet

    -- Operator feedback (learning)
    operator_edit       TEXT,
    posted_outcome      TEXT,    -- 'posted' | 'skipped' | 'edited'
    upvotes             INT,
    reply_count         INT
);

CREATE INDEX IF NOT EXISTS idx_reddit_operator_sessions_created_at
    ON reddit_operator_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reddit_operator_sessions_subreddit
    ON reddit_operator_sessions(subreddit);

CREATE INDEX IF NOT EXISTS idx_reddit_operator_sessions_friction_tags
    ON reddit_operator_sessions USING GIN(friction_tags);

CREATE INDEX IF NOT EXISTS idx_reddit_operator_sessions_mode
    ON reddit_operator_sessions(mode);


-- -------------------------
-- Table: reddit_operator_funnel_events
-- Lightweight event log for analytics dashboard.
-- -------------------------

CREATE TABLE IF NOT EXISTS reddit_operator_funnel_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id   UUID REFERENCES reddit_operator_sessions(id) ON DELETE SET NULL,
    event_name   TEXT NOT NULL,  -- 'invite_shown' | 'invite_accepted' | 'draft_copied' | 'reply_posted'
    event_data   JSONB
);

CREATE INDEX IF NOT EXISTS idx_reddit_funnel_events_session
    ON reddit_operator_funnel_events(session_id);

CREATE INDEX IF NOT EXISTS idx_reddit_funnel_events_name
    ON reddit_operator_funnel_events(event_name);

CREATE INDEX IF NOT EXISTS idx_reddit_funnel_events_created_at
    ON reddit_operator_funnel_events(created_at DESC);


-- -------------------------
-- Table: reddit_comment_examples
-- Few-shot training examples imported from Comment Insights CSV.
-- Used by Stage 2 (Gemini) and Stage 3 (GPT-4o) prompts for grounded,
-- community-language replies instead of template repetition.
-- -------------------------

CREATE TABLE IF NOT EXISTS reddit_comment_examples (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    post_title      TEXT NOT NULL,
    post_body       TEXT,
    successful_reply TEXT NOT NULL,
    upvotes         INT DEFAULT 0,
    upvote_rate     FLOAT DEFAULT 1.0,
    reply_count     INT DEFAULT 0,
    comment_date    DATE,
    intent_tag      TEXT,   -- e.g. 'purchase_advice', 'comparison', 'listing_evaluation'
    subreddit       TEXT
);

CREATE INDEX IF NOT EXISTS idx_reddit_comment_examples_intent
    ON reddit_comment_examples(intent_tag);

CREATE INDEX IF NOT EXISTS idx_reddit_comment_examples_date
    ON reddit_comment_examples(comment_date DESC);


-- -------------------------
-- Reddit Operator v2 → Full-OFFO upgrade
-- Run this block if the base tables already exist (safe — IF NOT EXISTS / IF NOT EXISTS guard on columns)
-- -------------------------

ALTER TABLE reddit_operator_sessions
    ADD COLUMN IF NOT EXISTS secondary_intent    TEXT,
    ADD COLUMN IF NOT EXISTS detected_vehicle    JSONB,
    ADD COLUMN IF NOT EXISTS suggested_tool      TEXT,
    ADD COLUMN IF NOT EXISTS offer_by_permission BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS market_data         JSONB;

CREATE INDEX IF NOT EXISTS idx_reddit_operator_sessions_intent
    ON reddit_operator_sessions(intent);

CREATE INDEX IF NOT EXISTS idx_reddit_operator_sessions_suggested_tool
    ON reddit_operator_sessions(suggested_tool);


-- -------------------------
-- Reddit Scanner v3 columns
-- Add these if the base table already exists.
-- -------------------------

ALTER TABLE reddit_operator_sessions
    ADD COLUMN IF NOT EXISTS reddit_post_id      TEXT,
    ADD COLUMN IF NOT EXISTS reddit_post_url     TEXT,
    ADD COLUMN IF NOT EXISTS qualification_score FLOAT;

-- Index for Scan Feed tab: quick lookup of pending scanner sessions
CREATE INDEX IF NOT EXISTS idx_reddit_operator_sessions_pending
    ON reddit_operator_sessions(posted_outcome, source)
    WHERE posted_outcome = 'pending';


-- -------------------------
-- Market Analytics cache
-- Stores Auto.dev Listings API responses per VIN or YMM key for 24h.
-- -------------------------

CREATE TABLE IF NOT EXISTS market_cache (
    cache_key   TEXT PRIMARY KEY,      -- 'vin:5YJSA...' or 'ymm:2022:tesla:model3'
    data        JSONB NOT NULL,        -- processed market analytics dict
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_cache_fetched_at
    ON market_cache(fetched_at DESC);


-- -------------------------
-- AI Jobs (Phase 2/3 async batch operations)
-- Persists batch_copart_scan and dealer_inventory_match jobs.
-- -------------------------

CREATE TABLE IF NOT EXISTS ai_jobs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type     TEXT NOT NULL,
    payload      JSONB NOT NULL,
    status       TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | error
    result       JSONB,
    error        TEXT,
    created_at   TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status
    ON ai_jobs(status);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at
    ON ai_jobs(created_at DESC);


-- -------------------------
-- AI Cache (general-purpose LLM result cache)
-- Used by AiCache service for tasks with cache_ttl_s > 0 (e.g. copart_analyze).
-- -------------------------

CREATE TABLE IF NOT EXISTS ai_cache (
    cache_key  TEXT PRIMARY KEY,
    task_id    TEXT NOT NULL,
    value      JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at
    ON ai_cache(expires_at);


-- -------------------------
-- Reddit Post Comments
-- Stores comments scraped from Reddit posts where OFFO replied.
-- Populated by outcome_tracker.py on each tracking pass.
-- -------------------------

CREATE TABLE IF NOT EXISTS reddit_post_comments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id           UUID REFERENCES reddit_operator_sessions(id) ON DELETE CASCADE,
    reddit_post_id       TEXT NOT NULL,
    reddit_comment_id    TEXT NOT NULL UNIQUE,
    comment_author       TEXT,
    comment_body         TEXT NOT NULL,
    comment_score        INT DEFAULT 0,
    depth                INT DEFAULT 0,
    is_reply_to_op       BOOLEAN DEFAULT FALSE,
    comment_date         TIMESTAMPTZ,
    fetched_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reddit_post_comments_session ON reddit_post_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_reddit_post_comments_post_id ON reddit_post_comments(reddit_post_id);
CREATE INDEX IF NOT EXISTS idx_reddit_post_comments_fetched ON reddit_post_comments(fetched_at DESC);
