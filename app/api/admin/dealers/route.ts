/**
 * Admin: List Dealers
 * GET /api/admin/dealers?status=pending|approved|rejected
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
    .from("dealerships")
    .select("id, name, slug, city, state, contact_name, contact_email, status, is_verified, rejection_reason, reviewed_at, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, dealers: data ?? [], status });
}
