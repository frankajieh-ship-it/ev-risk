/**
 * OFFO Buyer Pass — Payment Status
 *
 * Shared logic for checking purchase status and entitlements.
 * Used by the status API endpoint and by gating in deep dive / PDF endpoints.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/api-auth";

export type PurchaseStatus = "pending" | "paid" | "failed" | "refunded" | "none";

export type PackTier = "buyer_pass" | "seller_questions" | "chat_pass" | "copart_report" | "receipt_single";

export type EntitlementLevel = "free" | "seller_pack" | "buyer_pass";

export interface PaymentStatusResult {
  unlocked_base: boolean;
  pack_tier: PackTier | null;
  purchase_status: PurchaseStatus;
  purchase_id?: string;
  compare_remaining: number;
  compare_bound_to: string | null;
  price_paid?: number;
  receipt_credits_remaining: number;
  receipt_credits_total: number;
  entitlement_level: EntitlementLevel;
  seller_pack_unlocked: boolean;
  chat_unlocked: boolean;
}

/**
 * Check purchase status for a scenario.
 * Returns entitlement info including receipt credit state.
 *
 * ipHash / serverSessionId are used to harden the first-receipt-free check
 * against token cycling (clearing localStorage to get a new anon_id).
 */
export async function checkPurchaseStatus(
  scenarioType: string,
  scenarioId: string,
  anonId: string,
  ipHash?: string,
  serverSessionId?: string,
): Promise<PaymentStatusResult> {
  const none: PaymentStatusResult = {
    unlocked_base: false,
    pack_tier: null,
    purchase_status: "none",
    compare_remaining: 0,
    compare_bound_to: null,
    receipt_credits_remaining: 0,
    receipt_credits_total: 0,
    entitlement_level: "free",
    seller_pack_unlocked: false,
    chat_unlocked: false,
  };

  // Derive entitlement level from pack_tier (buyer_pass ⊃ seller_pack)
  function deriveEntitlement(tier: string | null): { entitlement_level: EntitlementLevel; seller_pack_unlocked: boolean; chat_unlocked: boolean } {
    if (tier === "buyer_pass") return { entitlement_level: "buyer_pass", seller_pack_unlocked: true, chat_unlocked: false };
    if (tier === "seller_questions") return { entitlement_level: "seller_pack", seller_pack_unlocked: true, chat_unlocked: false };
    if (tier === "chat_pass") return { entitlement_level: "free", seller_pack_unlocked: false, chat_unlocked: true };
    if (tier === "copart_report") return { entitlement_level: "buyer_pass", seller_pack_unlocked: true, chat_unlocked: false };
    if (tier === "receipt_single") return { entitlement_level: "buyer_pass", seller_pack_unlocked: true, chat_unlocked: false };
    return { entitlement_level: "free", seller_pack_unlocked: false, chat_unlocked: false };
  }

  if (!isSupabaseConfigured()) return none;

  try {
    // Check as base scenario
    const { data: basePurchase } = await supabase
      .from("purchases")
      .select(
        "purchase_id, status, compare_credit_total, compare_credit_used, compare_scenario_id, amount, anon_id, pack_tier, receipt_credits_total, receipt_credits_used"
      )
      .eq("base_scenario_id", scenarioId)
      .eq("scenario_type", scenarioType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (basePurchase) {
      // Security: verify ownership
      if (basePurchase.anon_id !== anonId) {
        return none;
      }

      const creditsTotal = basePurchase.receipt_credits_total || 0;
      const creditsUsed = basePurchase.receipt_credits_used || 0;

      const tier = (basePurchase.pack_tier as PackTier) || "buyer_pass";
      return {
        unlocked_base: basePurchase.status === "paid",
        pack_tier: tier,
        purchase_status: basePurchase.status as PurchaseStatus,
        purchase_id: basePurchase.purchase_id,
        compare_remaining:
          basePurchase.status === "paid" &&
          basePurchase.compare_credit_used < basePurchase.compare_credit_total
            ? basePurchase.compare_credit_total - basePurchase.compare_credit_used
            : 0,
        compare_bound_to: basePurchase.compare_scenario_id || null,
        price_paid: basePurchase.status === "paid" ? basePurchase.amount : undefined,
        receipt_credits_remaining: basePurchase.status === "paid" ? Math.max(0, creditsTotal - creditsUsed) : 0,
        receipt_credits_total: creditsTotal,
        ...deriveEntitlement(basePurchase.status === "paid" ? tier : null),
      };
    }

    // Check if this scenario is a compare scenario bound to another purchase
    const { data: comparePurchase } = await supabase
      .from("purchases")
      .select("purchase_id, status, compare_credit_used, anon_id, pack_tier, receipt_credits_total, receipt_credits_used")
      .eq("compare_scenario_id", scenarioId)
      .eq("scenario_type", scenarioType)
      .eq("status", "paid")
      .maybeSingle();

    if (comparePurchase && comparePurchase.anon_id === anonId) {
      const creditsTotal = comparePurchase.receipt_credits_total || 0;
      const creditsUsed = comparePurchase.receipt_credits_used || 0;
      const compareTier = (comparePurchase.pack_tier as PackTier) || "buyer_pass";

      return {
        unlocked_base: true, // accessible via compare credit
        pack_tier: compareTier,
        purchase_status: "paid",
        purchase_id: comparePurchase.purchase_id,
        compare_remaining: 0, // credit already used
        compare_bound_to: scenarioId,
        receipt_credits_remaining: Math.max(0, creditsTotal - creditsUsed),
        receipt_credits_total: creditsTotal,
        ...deriveEntitlement(compareTier),
      };
    }

    // Cross-unlock: if the same anon_id has ANY paid purchase, unlock
    const { data: anyPurchase } = await supabase
      .from("purchases")
      .select("purchase_id, status, amount, anon_id, pack_tier, receipt_credits_total, receipt_credits_used")
      .eq("anon_id", anonId)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();

    if (anyPurchase) {
      const creditsTotal = anyPurchase.receipt_credits_total || 0;
      const creditsUsed = anyPurchase.receipt_credits_used || 0;
      const anyTier = (anyPurchase.pack_tier as PackTier) || "buyer_pass";

      return {
        unlocked_base: true,
        pack_tier: anyTier,
        purchase_status: "paid",
        purchase_id: anyPurchase.purchase_id,
        compare_remaining: 0,
        compare_bound_to: null,
        price_paid: anyPurchase.amount,
        receipt_credits_remaining: Math.max(0, creditsTotal - creditsUsed),
        receipt_credits_total: creditsTotal,
        ...deriveEntitlement(anyTier),
      };
    }

    // First receipt free: if this session has never completed a receipt before,
    // treat this one as unlocked at starter tier (same as receipt_single paid).
    // Uses admin client to query receipts table securely.
    //
    // Three-signal check to prevent token cycling (clearing localStorage):
    //   1. anon_id (receipt_token) — primary identity
    //   2. ip_hash — same IP that already got a free receipt can't get another
    //   3. server_session_id — HttpOnly cookie set server-side, survives localStorage clear
    // Any one signal showing a prior completed receipt blocks the free unlock.
    try {
      const adminSupabase = getSupabaseAdmin();
      if (adminSupabase) {
        // Signal 1: by anon_id on receipts table
        const { count: byToken } = await adminSupabase
          .from("receipts")
          .select("id", { count: "exact", head: true })
          .eq("session_id", anonId)
          .eq("generation_status", "full");

        // Signal 2: by ip_hash on receipt_events (generate events only)
        let byIp = 0;
        if (ipHash) {
          const { count: ipCount } = await adminSupabase
            .from("receipt_events")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .eq("event_type", "generate");
          byIp = ipCount ?? 0;
        }

        // Signal 3: by server_session_id on receipts table (HttpOnly cookie, survives localStorage clear)
        let byServerSession = 0;
        if (serverSessionId) {
          const { count: ssCount } = await adminSupabase
            .from("receipts")
            .select("id", { count: "exact", head: true })
            .eq("server_session_id", serverSessionId)
            .eq("generation_status", "full");
          byServerSession = ssCount ?? 0;
        }

        const hasPriorReceipt = (byToken ?? 0) > 0 || byIp > 0 || byServerSession > 0;

        if (!hasPriorReceipt) {
          return {
            unlocked_base: true,
            pack_tier: "receipt_single",
            purchase_status: "none",
            compare_remaining: 0,
            compare_bound_to: null,
            receipt_credits_remaining: 0,
            receipt_credits_total: 0,
            entitlement_level: "buyer_pass",
            seller_pack_unlocked: true,
            chat_unlocked: false,
          };
        }
      }
    } catch {
      // Non-critical — fall through to locked state if this check fails
    }

    return none;
  } catch (err) {
    console.error("[PaymentStatus] Error:", err);
    return none;
  }
}
