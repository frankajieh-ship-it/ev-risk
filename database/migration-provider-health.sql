-- Provider Health: persistent AI provider success/failure counters
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS provider_health (
  provider TEXT PRIMARY KEY,
  success_count BIGINT NOT NULL DEFAULT 0,
  failure_count BIGINT NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed rows so upserts always find a row
INSERT INTO provider_health (provider) VALUES
  ('openai'), ('gemini'), ('grok'), ('anthropic')
ON CONFLICT (provider) DO NOTHING;

-- Atomic increment functions (avoids read-modify-write races)
CREATE OR REPLACE FUNCTION increment_provider_success(p_provider TEXT)
RETURNS void LANGUAGE sql AS $$
  UPDATE provider_health
  SET success_count = success_count + 1, updated_at = now()
  WHERE provider = p_provider;
$$;

CREATE OR REPLACE FUNCTION increment_provider_failure(p_provider TEXT)
RETURNS void LANGUAGE sql AS $$
  UPDATE provider_health
  SET failure_count = failure_count + 1, updated_at = now()
  WHERE provider = p_provider;
$$;
