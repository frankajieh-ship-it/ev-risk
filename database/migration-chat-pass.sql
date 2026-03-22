-- OFFO AI Unlimited — chat_pass pack tier
-- Run in Supabase SQL Editor.

-- 1. Add chat_pass to pack_tier constraint
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_pack_tier_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_pack_tier_check
  CHECK (pack_tier IN ('buyer_pass', 'seller_questions', 'chat_pass'));

-- 2. Add chat to scenario_type constraint
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_scenario_type_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_scenario_type_check
  CHECK (scenario_type IN ('receipt', 'evroutine', 'routine', 'compare', 'chat'));

-- 3. ai_unlocked flag for fast chat entitlement lookup
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS ai_unlocked BOOLEAN DEFAULT FALSE;

-- 4. Index for fast chat unlock checks
CREATE INDEX IF NOT EXISTS idx_purchases_chat_unlock
  ON purchases(anon_id, pack_tier, status)
  WHERE pack_tier = 'chat_pass' AND status = 'paid';

-- 5. Daily free-tier usage tracking
CREATE TABLE IF NOT EXISTS chat_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INT DEFAULT 0,
  UNIQUE(session_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_chat_daily_usage_session
  ON chat_daily_usage(session_id, usage_date DESC);
