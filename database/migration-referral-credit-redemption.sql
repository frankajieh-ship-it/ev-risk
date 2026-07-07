-- Referral credit redemption tracking
-- Run after migration-referral-credits.sql

-- Track that a purchase was created by redeeming a referral credit (not real payment)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS referral_credit_redeemed BOOLEAN NOT NULL DEFAULT FALSE;

-- Track which receipt a credit was redeemed for
ALTER TABLE referral_credits
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redeemed_for_scenario_id UUID;

CREATE INDEX IF NOT EXISTS idx_referral_credits_unredeemed
  ON referral_credits (referrer_user_id)
  WHERE redeemed_at IS NULL;
