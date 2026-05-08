-- ============================================================================
-- OFFO — Brand Content Table
-- ============================================================================
-- Stores product value propositions, FAQs, use cases, and differentiators
-- that the social post generator and AI can reference for content creation.
--
-- Separate from offo_knowledge_base (which is receipt/news/reddit data).
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

CREATE TABLE IF NOT EXISTS offo_brand_content (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_type TEXT        NOT NULL CHECK (content_type IN ('value_prop', 'faq', 'use_case', 'differentiator')),
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  signal_ids   TEXT[],
  post_worthy  BOOLEAN     NOT NULL DEFAULT TRUE,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  UNIQUE (content_type, title)
);

CREATE INDEX IF NOT EXISTS idx_brand_content_type ON offo_brand_content(content_type, active);

-- ============================================================================
-- Seed: 8 core value propositions (grounded in actual product capabilities)
-- ============================================================================

INSERT INTO offo_brand_content (content_type, title, body, signal_ids) VALUES

('value_prop',
 'Missing evidence is treated as a red flag',
 'Most tools only flag problems they can see. OFFO penalizes missing information — no battery health report, no service records, no title disclosure — because silence can hide a problem. A listing that says nothing about the battery is riskier than one that shows a bad report. OFFO surfaces these gaps so buyers know exactly what to ask for before visiting.',
 ARRAY['battery_proof_missing', 'service_records_missing', 'title_status_unclear', 'ownership_history_unclear']),

('value_prop',
 'Battery health estimated from mileage and age',
 'OFFO estimates battery state of health from mileage and model year using known degradation curves — even when the seller provides no report. This gives buyers a realistic baseline and flags when a seller''s claimed range looks suspiciously optimistic for a car of that age and mileage. Carfax does not do this.',
 ARRAY['battery_health_estimated', 'battery_report_recent', 'battery_proof_missing']),

('value_prop',
 'EV routine fit score across 6 dimensions',
 'The routine fit score measures whether a specific EV matches the buyer''s actual life: home vs. public charging, daily commute distance, climate (cold winters reduce real-world range 20–30%), longest single-day trip, budget including federal and state incentives, and vehicle utility. Most buyers only consider EPA range. OFFO checks all six.',
 ARRAY['no_home_charging', 'winter_high_exposure', 'longest_day_tight_buffer', 'routine_impossible']),

('value_prop',
 '38 EV-specific risk signals',
 'OFFO checks 38 signals designed for EVs — things like whether DC fast charging is required but unavailable on the model, whether a known model limitation conflicts with the buyer''s routine, or whether the seller is using common listing tricks like quoting EPA range without adjusting for real-world degradation. These signals fire on listing text automatically, no structured data needed.',
 ARRAY['dcfc_required_but_absent', 'model_known_limit_vs_routine', 'dealer_addon_pressure', 'odometer_title_mismatch']),

('value_prop',
 'Ready-to-send negotiation opener',
 'OFFO generates a buyer-specific opening message and three scenario-based negotiation scripts: issues found during inspection, fair condition with room to negotiate, and competitive interest scenario. Each script is tied to the actual risk signals found in the listing — not generic advice. Walk-away triggers are also listed explicitly.',
 NULL),

('value_prop',
 'Price vs. real comparable listings with buyer demand',
 'OFFO compares the listing price to 2–5 verified comparable listings in the region, shows where the price sits in the distribution as a percentile, and reports how many active buyers are competing for similar vehicles. A listing can look fair on average but be overpriced when buyer demand is low or inventory is plentiful.',
 ARRAY['price_over_market_10_15', 'price_over_market_15_plus']),

('value_prop',
 'VIN mismatch detection',
 'OFFO decodes the VIN against NHTSA''s database and cross-checks year, make, and model against what the listing claims. Mismatches are flagged immediately — a common sign of odometer fraud, vehicle misrepresentation, or a dealer listing the wrong trim. Buyers would need to do this manually with a separate NHTSA lookup.',
 ARRAY['odometer_title_mismatch', 'vin_decoded']),

('value_prop',
 'Confidence-gated verdicts: no fake GREENs',
 'A listing cannot receive a GREEN verdict without sufficient documentation. Low risk + missing evidence = YELLOW. This prevents the false confidence that comes from analyzing a vague listing that looks fine only because the seller disclosed nothing problematic. OFFO explicitly distinguishes between "no problems found" and "not enough information to tell."',
 ARRAY['clean_title_explicit', 'battery_proof_missing', 'title_status_unclear'])

ON CONFLICT (content_type, title) DO UPDATE
  SET body       = EXCLUDED.body,
      signal_ids = EXCLUDED.signal_ids,
      active     = TRUE;

-- Verify: SELECT content_type, count(*) FROM offo_brand_content GROUP BY content_type;
