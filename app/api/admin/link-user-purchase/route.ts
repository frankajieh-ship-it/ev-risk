/**
 * POST /api/admin/link-user-purchase
 *
 * Backfills user_id onto purchases that were made anonymously.
 * Finds the auth user by email, finds their paid purchases by anon_id or email,
 * and sets user_id so the workspace "My Reports" page surfaces them.
 *
 * Body: { email: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!ADMIN_KEY || auth !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  // 1. Look up the auth user by email
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError || !authData) {
    return NextResponse.json({ error: "Failed to list auth users", detail: authError?.message }, { status: 500 });
  }

  const authUser = authData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!authUser) {
    return NextResponse.json({ error: `No auth user found with email: ${email}` }, { status: 404 });
  }

  const userId = authUser.id;

  // 2. Find all paid purchases that belong to this user but have no user_id set
  //    Strategy A: match by anon_id stored in checklist_email_captures (email → anon_id)
  //    Strategy B: match any purchase with no user_id that may belong to this user

  // Find anon_ids associated with this email (from email capture table)
  const { data: emailCaptures } = await supabase
    .from("checklist_email_captures")
    .select("anon_id")
    .eq("email", email.toLowerCase())
    .not("anon_id", "is", null);

  const anonIds = (emailCaptures ?? []).map((r: { anon_id: string }) => r.anon_id).filter(Boolean);

  let updated = 0;
  const updatedPurchaseIds: string[] = [];

  // Backfill by anon_id matches
  if (anonIds.length > 0) {
    const { data: byAnon, error: byAnonErr } = await supabase
      .from("purchases")
      .update({ user_id: userId })
      .in("anon_id", anonIds)
      .is("user_id", null)
      .eq("status", "paid")
      .select("purchase_id, anon_id, amount, scenario_type, created_at");

    if (!byAnonErr && byAnon) {
      updated += byAnon.length;
      updatedPurchaseIds.push(...byAnon.map((p: { purchase_id: string }) => p.purchase_id));
    }
  }

  // Also check if there are purchases already linked to this user_id (nothing to do)
  const { data: existingLinked } = await supabase
    .from("purchases")
    .select("purchase_id, amount, scenario_type, base_scenario_id, created_at, anon_id")
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(20);

  // Return full diagnostic picture
  return NextResponse.json({
    ok: true,
    user_id: userId,
    email,
    email_confirmed: !!authUser.email_confirmed_at,
    anon_ids_found: anonIds,
    purchases_backfilled: updated,
    backfilled_purchase_ids: updatedPurchaseIds,
    already_linked_purchases: (existingLinked ?? []).map((p: {
      purchase_id: string;
      amount: number;
      scenario_type: string;
      base_scenario_id: string;
      created_at: string;
      anon_id: string;
    }) => ({
      purchase_id: p.purchase_id,
      amount_cents: p.amount,
      scenario_type: p.scenario_type,
      receipt_id: p.base_scenario_id,
      created_at: p.created_at,
      anon_id: p.anon_id,
    })),
  });
}
