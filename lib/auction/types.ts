/**
 * Auction Intelligence Platform — Shared Types
 *
 * All types shared across the auction vertical:
 * - Adapter interface (one impl per source)
 * - NormalizedAuctionLot (canonical cross-source schema)
 * - AuctionEvalInput / AuctionEvalReport (orchestrator I/O)
 */

import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { ArbitrageResult } from "@/lib/copart-arbitrage-engine";
import type { RoutineFitScore, OffoScore } from "@/types/v2";
import type { MinimumViableRoutine } from "@/types/v2";

// ── Source identifiers ─────────────────────────────────────────────────────────

export type AuctionSource = "copart" | "iaai" | "manheim";

// ── Errors ────────────────────────────────────────────────────────────────────

export class AuctionSourceNotSupportedError extends Error {
  constructor(public readonly source: AuctionSource) {
    super(`Auction source not yet supported: ${source}`);
    this.name = "AuctionSourceNotSupportedError";
  }
}

export class AuctionLotNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Lot not found: ${identifier}`);
    this.name = "AuctionLotNotFoundError";
  }
}

// ── Normalized lot (single cross-source schema) ───────────────────────────────

export interface NormalizedAuctionLot {
  auction_source: AuctionSource;
  lot_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  title_status: string | null;
  /** Inferred via inferDamageType() inside the adapter */
  damage_type: string | null;
  primary_damage: string | null;
  secondary_damage: string | null;
  current_bid: number | null;
  buy_now_price: number | null;
  odometer: number | null;
  odometer_brand: string | null;
  run_and_drive_status: string | null;
  loss_type: string | null;
  sale_date: string | null;
  location: string | null;
  photos: string[];
  /** Combined free-text for scoring: highlights + damage descriptions */
  condition_notes: string | null;
  /** Provider that returned the data: "copart_api" | "apify" | "iaai_api" etc. */
  provider_name: string;
  /** Raw response stored for debugging — never used downstream */
  raw_provider_payload: unknown;
  /** Apify: deal quality score relative to market value */
  deal_score: number | null;
  /** Apify: estimated discount % vs. typical resale price */
  discount_percent: number | null;
  /** Apify: days remaining until auction */
  days_until_auction: number | null;
  /** Apify: categorized damage severity (e.g. "minor" | "moderate" | "severe") */
  damage_level: string | null;
  /** Apify: mileage bucket ("low" | "medium" | "high") */
  mileage_category: string | null;
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface AuctionSourceAdapter {
  fetchByUrl(url: string): Promise<NormalizedAuctionLot>;
  fetchByLot(lotNumber: string): Promise<NormalizedAuctionLot>;
  fetchByVin(vin: string): Promise<NormalizedAuctionLot>;
}

// ── NHTSA recall type (lightweight, matches /api/recalls/nhtsa response) ──────

export interface NhtsaRecallSummary {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
}

// ── data_v2 enrichment types ──────────────────────────────────────────────────

export interface ChargingProfileSummary {
  peak_dc_kw: number | null;
  time_10_to_80_min: number | null;
  cold_derate_percent: number;
  curve_shape: "flat" | "tapered" | "steep_taper";
  source_model: string;
}

export interface RangeProjection {
  epa_range_mi: number | null;
  real_world_range_mi: number | null;
  cold_range_mi: number | null;
  extreme_cold_range_mi: number | null;
  heat_range_mi: number | null;
  climate_note: string | null;
}

export interface IncentiveStatus {
  federal_new_amount: number;
  federal_used_amount: number;
  /** Salvage-titled vehicles are never eligible for §30D */
  salvage_title_disqualifies: boolean;
  state: string | null;
  state_amount: number;
  notes: string | null;
}

export interface ElectricityContext {
  state: string;
  residential_kwh_cents: number;
  ev_tou_kwh_cents: number | null;
  monthly_cost_estimate_usd: number | null;
}

// ── Orchestrator input / output ───────────────────────────────────────────────

export interface AuctionEvalInput {
  url?: string;
  lot_number?: string;
  auction_source: AuctionSource;
  /** Identifies the session for payment status checks */
  receipt_token: string;
  /** Supabase user id — enables garage upsert after evaluation */
  user_id?: string | null;
  /** If provided, routine fit is computed and included in report */
  routine_profile?: MinimumViableRoutine | null;
}

export interface AuctionEvalReport {
  report_id: string;
  lot: NormalizedAuctionLot;
  salvage_risk: SalvageRiskResult;
  /** null for unauthenticated / unpaid users */
  arbitrage: ArbitrageResult | null;
  recalls: NhtsaRecallSummary[];
  /** null when no routine_profile provided */
  routine_fit: RoutineFitScore | null;
  /** DC charging performance from data_v2; null when vehicle not in catalog */
  charging_profile: ChargingProfileSummary | null;
  /** Temperature-adjusted range projection; null when vehicle not in catalog */
  range_projection: RangeProjection | null;
  /** Federal + state incentive eligibility; null when make/model/year unknown */
  incentive_status: IncentiveStatus | null;
  /** State electricity rate + monthly cost estimate; null when location unknown */
  electricity_context: ElectricityContext | null;
  /** Unified OFFO score — composite verdict combining salvage risk + routine fit */
  offo_score?: OffoScore;
  /** true when result was served from the 24h persistence cache */
  cached: boolean;
  created_at: string;
  expires_at: string;
}
