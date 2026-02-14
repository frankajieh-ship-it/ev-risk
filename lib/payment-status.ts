/**
 * OFFO Decision Pack — Payment Status
 *
 * Shared logic for checking purchase status and entitlements.
 * Used by the status API endpoint and by gating in deep dive / PDF endpoints.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type PurchaseStatus = "pending" | "paid" | "failed" | "refunded" | "none";

export interface PaymentStatusResult {
  unlocked_base: boolean;
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
        "purchase_id, status, compare_credit_total, compare_credit_used, compare_scenario_id, amount, anon_id"
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
      .select("purchase_id, status, compare_credit_used, anon_id")
      .eq("compare_scenario_id", scenarioId)
      .eq("scenario_type", scenarioType)
      .eq("status", "paid")
      .maybeSingle();

    if (comparePurchase && comparePurchase.anon_id === anonId) {
      return {
        unlocked_base: true, // accessible via compare credit
        purchase_status: "paid",
        purchase_id: comparePurchase.purchase_id,
        compare_remaining: 0, // credit already used
        compare_bound_to: scenarioId,
      };
    }

    return none;
  } catch (err) {
    console.error("[PaymentStatus] Error:", err);
    return none;
  }
}
