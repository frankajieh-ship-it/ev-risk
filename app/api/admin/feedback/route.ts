/**
 * GET /api/admin/feedback
 * Returns paginated report_feedback rows joined to receipts for context.
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100"), 200);
  const rating = req.nextUrl.searchParams.get("rating"); // "5" | "3" | "1" | null

  let query = supabase
    .from("report_feedback")
    .select(`
      id,
      created_at,
      rating,
      feedback_text,
      would_recommend,
      report_id,
      receipts (
        listing_url,
        vin,
        listing_summary
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rating) query = query.eq("rating", parseInt(rating));

  const { data, error } = await query;

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, feedback: data ?? [] });
}
