-- ============================================================================
-- OFFO — Knowledge Base Table
-- ============================================================================
-- Central store that aggregates signals from three sources:
--   receipt        — analyzed EV listings with verdict + scores
--   news           — daily_routine_news articles with impact scores
--   reddit_session — posted Reddit operator replies
--
-- Each source keeps its own live table; this is the unified surface for
-- content generation (social posts) and analytics.
--
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS offo_knowledge_base (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source              TEXT        NOT NULL CHECK (source IN ('receipt', 'news', 'reddit_session')),
  source_id           TEXT        NOT NULL,   -- receipts.id | daily_routine_news.article_id | reddit_operator_sessions.id

  -- Shared normalized signal fields
  make                TEXT,
  model               TEXT,
  year                INT,
  verdict             TEXT,       -- GREEN/YELLOW/RED (receipt) | routine_impact/recall/used_market/charging_network (news)
  score               INT,        -- fit_score (receipt) | impact_score (news)
  summary             TEXT,       -- human-readable one-liner for content generation
  tags                TEXT[],     -- key_routine_effects (news) | friction_tags (reddit)
  url                 TEXT,       -- listing_url (receipt) | article url (news)

  -- Content generation flags
  post_worthy         BOOLEAN     NOT NULL DEFAULT FALSE,
  generated_posts     JSONB,      -- { reddit: {...}, x: [...], linkedin: {...}, facebook: {...} }
  posts_generated_at  TIMESTAMPTZ,

  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_source_created  ON offo_knowledge_base(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_post_worthy      ON offo_knowledge_base(post_worthy, created_at DESC) WHERE post_worthy = TRUE;
CREATE INDEX IF NOT EXISTS idx_kb_verdict          ON offo_knowledge_base(verdict, created_at DESC);

-- Verify: SELECT source, count(*), count(*) filter (where post_worthy) as post_worthy
--         FROM offo_knowledge_base GROUP BY source;
