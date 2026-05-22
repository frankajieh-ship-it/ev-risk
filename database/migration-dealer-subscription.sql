-- Dealer Subscription Columns
-- Adds Stripe subscription tracking to the dealerships table.
-- All existing dealers default to 'trial' so they are not locked out.

ALTER TABLE dealerships
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

-- Index for webhook lookups by Stripe customer/subscription ID
CREATE INDEX IF NOT EXISTS idx_dealerships_stripe_customer ON dealerships(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_dealerships_stripe_subscription ON dealerships(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_dealerships_subscription_status ON dealerships(subscription_status);
