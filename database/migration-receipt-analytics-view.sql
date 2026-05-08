-- ============================================================================
-- OFFO — Receipt Analytics View
-- ============================================================================
-- Extracts structured fields from receipts.output_json so downstream queries
-- (admin dashboard, knowledge base population, content generation) don't need
-- to write raw JSONB expressions everywhere.
--
-- Run in Supabase SQL Editor. Safe to re-run (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE VIEW receipt_analytics AS
SELECT
  r.id,
  r.created_at,
  r.session_id,
  r.listing_url,
  r.url_domain,
  r.is_pro,
  r.generation_status,
  r.source,

  -- Listing summary
  (r.output_json -> 'listing_summary' ->> 'year')::int           AS year,
  r.output_json -> 'listing_summary' ->> 'make'                   AS make,
  r.output_json -> 'listing_summary' ->> 'model'                  AS model,
  r.output_json -> 'listing_summary' ->> 'trim'                   AS trim,
  (r.output_json -> 'listing_summary' ->> 'price')::int           AS price,
  (r.output_json -> 'listing_summary' ->> 'mileage')::int         AS mileage,
  r.output_json -> 'listing_summary' ->> 'title_status'           AS title_status,
  r.output_json -> 'listing_summary' ->> 'accidents_reported'     AS accidents_reported,
  r.output_json -> 'listing_summary' ->> 'seller_type'            AS seller_type,
  r.output_json -> 'listing_summary' ->> 'service_history'        AS service_history,

  -- Verdict & scores
  r.output_json ->> 'verdict'                                      AS verdict,
  (r.output_json ->> 'fit_score')::int                            AS fit_score,
  (r.output_json ->> 'evidence_score')::int                       AS evidence_score,
  r.output_json ->> 'evidence_label'                              AS evidence_label,

  -- Price sanity
  r.output_json -> 'price_sanity' ->> 'label'                     AS price_label,
  r.output_json -> 'price_sanity' ->> 'rationale_short'           AS price_rationale,
  (r.output_json -> 'price_sanity' -> 'user_market_range' ->> 'low')::int  AS market_low,
  (r.output_json -> 'price_sanity' -> 'user_market_range' ->> 'high')::int AS market_high,

  -- Risk blockers
  jsonb_array_length(COALESCE(r.output_json -> 'why_not_green', '[]')) AS blocker_count,
  r.output_json -> 'why_not_green'                                AS blockers

FROM receipts r
WHERE r.generation_status = 'full';

-- Verify: SELECT count(*), verdict FROM receipt_analytics GROUP BY verdict;
