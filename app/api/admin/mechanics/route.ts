/**
 * Admin: List Mechanics
 * GET /api/admin/mechanics?status=pending|approved|rejected
 * Protected by ADMIN_API_KEY header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const status = req.nextUrl.searchParams.get("status") || "pending";

  const { data, error } = await supabase
    .from("mechanic_profiles")
    .select(
      "id, slug, business_name, city, state, zip, contact_email, specialties, " +
      "is_verified, status, rejection_reason, reviewed_at, created_at, avg_rating, review_count"
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, mechanics: data ?? [], status });
}

/**
 * PATCH /api/admin/mechanics
 * Approve or reject a mechanic profile.
 * Body: { id: string, action: "approve" | "reject", rejection_reason?: string }
 */
export async function PATCH(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { id, action, rejection_reason } = await req.json() as {
    id: string;
    action: "approve" | "reject";
    rejection_reason?: string;
  };

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ success: false, error: "id and action (approve|reject) required" }, { status: 400 });
  }

  const update =
    action === "approve"
      ? { status: "approved", is_verified: true, reviewed_at: new Date().toISOString(), rejection_reason: null }
      : { status: "rejected", is_verified: false, reviewed_at: new Date().toISOString(), rejection_reason: rejection_reason ?? null };

  const { error } = await supabase.from("mechanic_profiles").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
