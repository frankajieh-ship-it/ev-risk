/**
 * OFFO Buyer Pass — Payment Status
 *
 * Shared logic for checking purchase status and entitlements.
 * Used by the status API endpoint and by gating in deep dive / PDF endpoints.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type PurchaseStatus = "pending" | "paid" | "failed" | "refunded" | "none";

export type PackTier = "buyer_pass";

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
}

/**
 * Check purchase status for a scenario.
 * Returns entitlement info including receipt credit state.
 */
export async function checkPurchaseStatus(
  scenarioType: string,
  scenarioId: string,
  anonId: string
): Promise<PaymentStatusResult> {
  const none: PaymentStatusResult = {
    unlocked_base: false,
    pack_tier: null,
    purchase_status: "none",
    compare_remaining: 0,
    compare_bound_to: null,
    receipt_credits_remaining: 0,
    receipt_credits_total: 0,
  };

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

      return {
        unlocked_base: basePurchase.status === "paid",
        pack_tier: (basePurchase.pack_tier as PackTier) || "buyer_pass",
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

      return {
        unlocked_base: true, // accessible via compare credit
        pack_tier: (comparePurchase.pack_tier as PackTier) || "buyer_pass",
        purchase_status: "paid",
        purchase_id: comparePurchase.purchase_id,
        compare_remaining: 0, // credit already used
        compare_bound_to: scenarioId,
        receipt_credits_remaining: Math.max(0, creditsTotal - creditsUsed),
        receipt_credits_total: creditsTotal,
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

      return {
        unlocked_base: true,
        pack_tier: (anyPurchase.pack_tier as PackTier) || "buyer_pass",
        purchase_status: "paid",
        purchase_id: anyPurchase.purchase_id,
        compare_remaining: 0,
        compare_bound_to: null,
        price_paid: anyPurchase.amount,
        receipt_credits_remaining: Math.max(0, creditsTotal - creditsUsed),
        receipt_credits_total: creditsTotal,
      };
    }

    return none;
  } catch (err) {
    console.error("[PaymentStatus] Error:", err);
    return none;
  }
}
