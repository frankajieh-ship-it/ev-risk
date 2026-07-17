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
    .select("id, created_at, rating, feedback_text, would_recommend, report_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rating) query = query.eq("rating", parseInt(rating));

  const { data: feedback, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (!feedback?.length) return NextResponse.json({ success: true, feedback: [] });

  // Manual join — report_id is not a FK in the schema
  const reportIds = [...new Set(feedback.map(f => f.report_id).filter(Boolean))];
  const { data: receipts } = reportIds.length
    ? await supabase
        .from("receipts")
        .select("id, listing_url, vin, listing_summary")
        .in("id", reportIds)
    : { data: [] };

  const receiptMap = Object.fromEntries((receipts ?? []).map(r => [r.id, r]));

  const rows = feedback.map(f => ({
    ...f,
    receipts: f.report_id ? (receiptMap[f.report_id] ?? null) : null,
  }));

  return NextResponse.json({ success: true, feedback: rows });
}
