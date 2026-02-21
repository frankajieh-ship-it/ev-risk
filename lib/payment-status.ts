/**
 * OFFO Decision Pack — Payment Status
 *
 * Shared logic for checking purchase status and entitlements.
 * Used by the status API endpoint and by gating in deep dive / PDF endpoints.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type PurchaseStatus = "pending" | "paid" | "failed" | "refunded" | "none";

export type PackTier = "starter_pack" | "decision_pack";

export interface PaymentStatusResult {
  unlocked_base: boolean;
  pack_tier: PackTier | null;
  purchase_status: PurchaseStatus;
  purchase_id?: string;
  compare_remaining: number;
  compare_bound_to: string | null;
  price_paid?: number;
}

/**
 * Check purchase status for a scenario.
 * Returns entitlement info including compare credit state.
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
  };

  if (!isSupabaseConfigured()) return none;

  try {
    // Check as base scenario
    const { data: basePurchase } = await supabase
      .from("purchases")
      .select(
        "purchase_id, status, compare_credit_total, compare_credit_used, compare_scenario_id, amount, anon_id, pack_tier"
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

      return {
        unlocked_base: basePurchase.status === "paid",
        pack_tier: (basePurchase.pack_tier as PackTier) || "decision_pack",
        purchase_status: basePurchase.status as PurchaseStatus,
        purchase_id: basePurchase.purchase_id,
        compare_remaining:
          basePurchase.status === "paid" &&
          basePurchase.compare_credit_used < basePurchase.compare_credit_total
            ? basePurchase.compare_credit_total - basePurchase.compare_credit_used
            : 0,
        compare_bound_to: basePurchase.compare_scenario_id || null,
        price_paid: basePurchase.status === "paid" ? basePurchase.amount : undefined,
      };
    }

    // Check if this scenario is a compare scenario bound to another purchase
    const { data: comparePurchase } = await supabase
      .from("purchases")
      .select("purchase_id, status, compare_credit_used, anon_id, pack_tier")
      .eq("compare_scenario_id", scenarioId)
      .eq("scenario_type", scenarioType)
      .eq("status", "paid")
      .maybeSingle();

    if (comparePurchase && comparePurchase.anon_id === anonId) {
      return {
        unlocked_base: true, // accessible via compare credit
        pack_tier: (comparePurchase.pack_tier as PackTier) || "decision_pack",
        purchase_status: "paid",
        purchase_id: comparePurchase.purchase_id,
        compare_remaining: 0, // credit already used
        compare_bound_to: scenarioId,
      };
    }

    // Cross-unlock: if the same anon_id has ANY paid purchase, unlock
    const { data: anyPurchase } = await supabase
      .from("purchases")
      .select("purchase_id, status, amount, anon_id, pack_tier")
      .eq("anon_id", anonId)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();

    if (anyPurchase) {
      return {
        unlocked_base: true,
        pack_tier: (anyPurchase.pack_tier as PackTier) || "decision_pack",
        purchase_status: "paid",
        purchase_id: anyPurchase.purchase_id,
        compare_remaining: 0,
        compare_bound_to: null,
        price_paid: anyPurchase.amount,
      };
    }

    return none;
  } catch (err) {
    console.error("[PaymentStatus] Error:", err);
    return none;
  }
}
