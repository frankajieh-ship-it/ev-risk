/**
 * GET /api/receipt/photo-analysis/status?job_id=<uuid>
 *
 * Returns current job status. When done, also returns the full photo_analysis
 * result from the receipts table.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import type { PhotoAnalysisResult } from "@/lib/photo-due-diligence";

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const job_id = request.nextUrl.searchParams.get("job_id");
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: job, error } = await supabase
    .from("receipt_photo_jobs")
    .select("id, receipt_id, status, error")
    .eq("id", job_id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "done") {
    return NextResponse.json({ status: job.status, error: job.error ?? null });
  }

  // Fetch analysis result from receipts
  const { data: receipt } = await supabase
    .from("receipts")
    .select("photo_analysis")
    .eq("id", job.receipt_id)
    .single();

  return NextResponse.json({
    status: "done",
    photo_analysis: (receipt?.photo_analysis as PhotoAnalysisResult | null) ?? null,
  });
}
