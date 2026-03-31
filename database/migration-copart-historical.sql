-- Migration: copart_historical
-- Stores actual closing prices from Copart auctions to power the market
-- closing estimate data flywheel. Once 100+ rows accumulate per make/model/damage
-- type, the deterministic 38% constant can be replaced with real percentile data.

CREATE TABLE IF NOT EXISTS copart_historical (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_number    text NOT NULL,
  vin           text,
  make          text,
  model         text,
  year          int,
  trim          text,
  damage_type   text,
  title_status  text,
  odometer      int,
  asking_price  int,           -- cents (pre-auction estimate/current_bid)
  hammer_price  int,           -- cents (actual closing price)
  arv_at_time   int,           -- cents (Auto.dev ARV when recorded)
  arv_pct       numeric(5,2),  -- hammer / arv as percentage
  auction_date  date,
  location      text,
  source        text NOT NULL DEFAULT 'copart',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for make/model/year lookups (market closing by vehicle type)
CREATE INDEX IF NOT EXISTS copart_historical_make_model
  ON copart_historical(make, model, year);

-- Index for damage type analytics (closing pct by damage category)
CREATE INDEX IF NOT EXISTS copart_historical_damage
  ON copart_historical(damage_type);

-- Composite index for the primary query pattern:
-- "what does a {make} {model} with {damage_type} close at?"
CREATE INDEX IF NOT EXISTS copart_historical_make_model_damage
  ON copart_historical(make, model, damage_type);

-- Partial index: only rows with both ARV and hammer price (usable for pct calc)
CREATE INDEX IF NOT EXISTS copart_historical_complete
  ON copart_historical(make, model, damage_type, arv_pct)
  WHERE arv_at_time IS NOT NULL AND hammer_price IS NOT NULL;

COMMENT ON TABLE copart_historical IS
  'Actual Copart auction closing prices. Used to replace the deterministic 38% ARV constant with real market data once sufficient rows exist per make/model/damage type.';

COMMENT ON COLUMN copart_historical.arv_pct IS
  'hammer_price / arv_at_time as a percentage. E.g. 38.5 means vehicle closed at 38.5% of clean ARV.';
