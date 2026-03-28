-- Auction Entitlements
-- Ties a paid copart_report unlock to a specific auction result_id (auc_xxx).
-- The purchases table uses UUID base_scenario_id which doesn't match auc_xxx text IDs,
-- so entitlements are tracked here separately after Stripe fulfillment.

CREATE TABLE IF NOT EXISTS auction_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id text NOT NULL,                                           -- auc_xxx stable identifier
  auction_analysis_id uuid REFERENCES auction_analyses(id) ON DELETE SET NULL,
  user_id uuid,                                                      -- set if authenticated at purchase time
  stripe_purchase_id uuid,                                           -- purchases.purchase_id (no FK — cross-schema safe)
  stripe_session_id text,
  pack_tier text NOT NULL DEFAULT 'copart_report',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_entitlements_result_id
  ON auction_entitlements (result_id);

CREATE INDEX IF NOT EXISTS idx_auction_entitlements_user_id
  ON auction_entitlements (user_id)
  WHERE user_id IS NOT NULL;
