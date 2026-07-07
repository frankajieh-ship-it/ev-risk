-- Referral credits migration
-- Tracks referrer on each purchase and stores a ledger of awarded credits.
-- Run in Supabase dashboard after deploying referral feature.

-- 1. Track referrer on individual purchases
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS referrer_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS referral_credit_awarded BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Referral credit ledger — one row per conversion event
CREATE TABLE IF NOT EXISTS referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL,
  referred_purchase_id UUID NOT NULL REFERENCES purchases(purchase_id),
  credit_amount INT NOT NULL DEFAULT 1,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_purchase_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_credits_referrer ON referral_credits(referrer_user_id);

-- 3. DB function to increment receipt_credits_total on referrer's most recent paid purchase
CREATE OR REPLACE FUNCTION increment_referral_credit(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  -- Find the referrer's most recent paid purchase that carries receipt credits
  SELECT purchase_id INTO v_purchase_id
  FROM purchases
  WHERE user_id = p_user_id
    AND status = 'paid'
    AND pack_tier IN ('buyer_pass', 'receipt_single')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_purchase_id IS NOT NULL THEN
    UPDATE purchases
    SET receipt_credits_total = receipt_credits_total + 1,
        updated_at = NOW()
    WHERE purchase_id = v_purchase_id;
  END IF;
END;
$$;
