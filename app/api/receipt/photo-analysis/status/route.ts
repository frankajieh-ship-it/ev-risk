/**
 * GET /api/receipt/photo-analysis/status?job_id=<uuid>
 *
 * Returns current job status. When done, also returns the full photo_analysis
 * result from the receipts table.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import type { PhotoAnalysisResult } from "@/lib/photo-due-diligence-types";

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const job_id = request.nextUrl.searchParams.get("job_id");
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: job, error } = await supabase
    .from("receipt_photo_jobs")
    .select("id, receipt_id, status, error, created_at")
    .eq("id", job_id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Detect stale jobs — mark failed if stuck > 20 minutes
  if (job.status === "pending" || job.status === "processing") {
    const ageMs = Date.now() - new Date(job.created_at as string).getTime();
    if (ageMs > 20 * 60 * 1000) {
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: "timeout", finished_at: new Date().toISOString() })
        .eq("id", job_id);
      return NextResponse.json({ status: "failed", error: "timeout" });
    }
    // Return any partial results already written by the background function
    const { data: receipt } = await supabase
      .from("receipts")
      .select("photo_analysis")
      .eq("id", job.receipt_id)
      .single();
    return NextResponse.json({
      status: job.status,
      photo_analysis: (receipt?.photo_analysis as PhotoAnalysisResult | null) ?? null,
    });
  }

  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", error: job.error ?? null });
  }

  // Fetch analysis result from receipts
  const { data: receipt } = await supabase
    .from("receipts")
    .select("photo_analysis")
    .eq("id", job.receipt_id)
    .single();

  const photoAnalysis = (receipt?.photo_analysis as PhotoAnalysisResult | null) ?? null;
  if (!photoAnalysis) {
    return NextResponse.json({ status: "failed", error: "no_result" });
  }

  return NextResponse.json({
    status: "done",
    photo_analysis: photoAnalysis,
  });
}
