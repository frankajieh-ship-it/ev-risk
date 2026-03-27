-- Phase 5: AI Chat Signals
-- Adds extracted_signals JSONB column to chat_messages.
-- Also adds scenario_id index for efficient per-vehicle lookups.
-- Run in Supabase SQL Editor.

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS extracted_signals JSONB;
-- Shape: {"signals": [{"text": str, "confidence": int, "category": str, "count_mentions": int}],
--         "signal_strength": "high"|"medium"|"low"|"none",
--         "extracted_at": ISO timestamp}

-- Index for fast lookups by scenario_id (vehicle thread)
CREATE INDEX IF NOT EXISTS idx_chat_messages_scenario
  ON chat_messages (scenario_id, created_at DESC);

-- Index for dealer join: find messages with signals for a given scenario_type
CREATE INDEX IF NOT EXISTS idx_chat_messages_signals
  ON chat_messages (scenario_id)
  WHERE extracted_signals IS NOT NULL;
