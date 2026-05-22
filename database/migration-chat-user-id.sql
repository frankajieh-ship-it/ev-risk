-- Add user_id and advisor_session_id to chat_messages for session persistence
-- Run in Supabase SQL Editor.

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advisor_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON chat_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_advisor_session
  ON chat_messages(advisor_session_id, created_at DESC);
