/**
 * OFFO Decision Pack — Compare Credit Binding
 *
 * POST /api/payments/bind-compare
 *
 * Binds a compare credit from a paid purchase to a second scenario.
 * Each purchase includes 1 compare credit. Once bound, the credit
 * cannot be moved to a different scenario.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const purchaseId = body.purchase_id as string;
  const compareScenarioId = body.compare_scenario_id as string;
  const compareScenarioType = (body.compare_scenario_type as string) || "receipt";

  if (!purchaseId) {
    return NextResponse.json({ error: "Missing purchase_id" }, { status: 400 });
  }
  if (!compareScenarioId) {
    return NextResponse.json({ error: "Missing compare_scenario_id" }, { status: 400 });
  }

  // 1. Fetch the purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select(
      "purchase_id, status, compare_credit_total, compare_credit_used, compare_scenario_id, anon_id, scenario_type"
    )
    .eq("purchase_id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // 2. Validate purchase state
  if (purchase.status !== "paid") {
    return NextResponse.json(
      { error: "Purchase is not in paid status" },
      { status: 400 }
    );
  }

  if (purchase.compare_credit_used >= purchase.compare_credit_total) {
    return NextResponse.json(
      { error: "Compare credit already used", compare_bound_to: purchase.compare_scenario_id },
      { status: 409 }
    );
  }

  // 3. Verify the compare scenario exists and belongs to the same anon_id
  const tableName = compareScenarioType === "receipt" ? "receipts" : "reports";
  const { data: scenario } = await supabase
    .from(tableName)
    .select("id, session_id")
    .eq("id", compareScenarioId)
    .maybeSingle();

  if (!scenario) {
    return NextResponse.json({ error: "Compare scenario not found" }, { status: 404 });
  }

  // For receipts, verify session_id matches anon_id
  if (compareScenarioType === "receipt" && scenario.session_id !== purchase.anon_id) {
    return NextResponse.json({ error: "Unauthorized — scenario belongs to a different user" }, { status: 403 });
  }

  // 4. Bind the compare credit
  const { data: updated, error: updateError } = await supabase
    .from("purchases")
    .update({
      compare_scenario_id: compareScenarioId,
      compare_credit_used: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("purchase_id", purchaseId)
    .eq("compare_credit_used", 0) // Optimistic lock — prevents race conditions
    .select("purchase_id, compare_scenario_id")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Compare credit already used (race condition)" },
      { status: 409 }
    );
  }

  console.log("[BindCompare] Credit bound:", {
    purchaseId,
    compareScenarioId,
    compareScenarioType,
  });

  return NextResponse.json({
    success: true,
    purchase_id: purchaseId,
    compare_scenario_id: compareScenarioId,
  });
}
