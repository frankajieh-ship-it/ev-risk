-- Deal Watch: saved searches + price drop tracking
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS deal_watch_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                        -- User-defined name e.g. "Tesla Model 3 under 25k"
  make TEXT,
  model TEXT,
  year_min INT,
  year_max INT,
  price_max INT,                              -- Max listing price in USD
  verdict_filter TEXT[],                      -- e.g. ['GREEN', 'YELLOW']
  sources TEXT[] DEFAULT ARRAY['listing'],    -- 'listing' | 'auction'
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  alert_email TEXT,                           -- Override email (defaults to user's email)
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_watch_searches_user
  ON deal_watch_searches(user_id, created_at DESC);

-- Tracks each listing/lot seen per saved search (for price change detection)
CREATE TABLE IF NOT EXISTS deal_watch_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES deal_watch_searches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  listing_url TEXT,                           -- Original listing URL (null for auction lots)
  lot_number TEXT,                            -- Auction lot number (null for listings)
  auction_source TEXT,                        -- 'copart' | 'iaai' (null for listings)
  vehicle_label TEXT NOT NULL,               -- e.g. "2021 Tesla Model 3 Long Range"
  last_price INT,                             -- Most recent price in USD cents
  last_verdict TEXT,                          -- GREEN | YELLOW | RED | null
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  alert_sent_at TIMESTAMPTZ,                 -- Null = no alert sent yet
  price_drop_amount INT,                      -- Cents dropped from previous price (null if no drop)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- False when listing removed/expired
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_watch_results_search
  ON deal_watch_results(search_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_watch_results_user
  ON deal_watch_results(user_id, is_active, last_seen_at DESC);

-- Enable Row Level Security
ALTER TABLE deal_watch_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_watch_results ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own rows
CREATE POLICY "deal_watch_searches_owner" ON deal_watch_searches
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "deal_watch_results_owner" ON deal_watch_results
  FOR ALL USING (auth.uid() = user_id);
