-- Auction Intelligence Platform — Database Migration
-- Phase 1: Copart + unified auction backend foundation
--
-- Creates:
--   auction_lots           — normalized lot snapshots (one row per source+lot)
--   auction_eval_reports   — evaluated reports cached 24h per lot
--
-- Modifies:
--   garage_vehicles        — adds auction_eval_report_id for auction-sourced vehicles

-- ── auction_lots ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auction_lots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_source    text NOT NULL CHECK (auction_source IN ('copart', 'iaai', 'manheim')),
  lot_number        text NOT NULL,
  vin               text,
  normalized_data   jsonb NOT NULL,
  provider_name     text,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_source, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_auction_lots_vin
  ON auction_lots (vin)
  WHERE vin IS NOT NULL;

-- ── auction_eval_reports ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auction_eval_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_lot_id      uuid REFERENCES auction_lots (id) ON DELETE CASCADE,
  user_id             uuid,
  receipt_token       text,
  salvage_risk        jsonb NOT NULL,
  arbitrage           jsonb,              -- null for free / unpaid users
  routine_fit         jsonb,              -- null when no routine provided
  recalls             jsonb,
  routine_profile_id  uuid,              -- for routine-aware cache keying (Phase 3)
  is_paid             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_auction_eval_lot_expires
  ON auction_eval_reports (auction_lot_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_auction_eval_token
  ON auction_eval_reports (receipt_token)
  WHERE receipt_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_eval_user
  ON auction_eval_reports (user_id)
  WHERE user_id IS NOT NULL;

-- ── garage_vehicles — add auction_eval_report_id ──────────────────────────────

ALTER TABLE garage_vehicles
  ADD COLUMN IF NOT EXISTS auction_eval_report_id text;
