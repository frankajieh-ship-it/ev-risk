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
import type { RoutineFitScore } from "@/types/v2";
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
  /** true when result was served from the 24h persistence cache */
  cached: boolean;
  created_at: string;
  expires_at: string;
}
