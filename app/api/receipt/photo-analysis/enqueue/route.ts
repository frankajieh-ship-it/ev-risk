/**
 * POST /api/receipt/photo-analysis/enqueue
 *
 * Creates a receipt_photo_jobs entry and fires the background analysis function.
 * Idempotent: returns existing job_id if a pending/processing job already exists.
 *
 * Body: { receipt_id: string, photo_urls: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.receipt_id !== "string" || !Array.isArray(body.photo_urls)) {
    return NextResponse.json({ error: "receipt_id and photo_urls required" }, { status: 400 });
  }

  const { receipt_id, photo_urls } = body as { receipt_id: string; photo_urls: string[] };

  if (photo_urls.length === 0) {
    return NextResponse.json({ error: "No photos to analyse" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Check if an active job already exists
  const { data: existing } = await supabase
    .from("receipt_photo_jobs")
    .select("id, status")
    .eq("receipt_id", receipt_id)
    .in("status", ["pending", "processing", "done"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    if (existing.status === "pending" || existing.status === "processing") {
      // Still running — don't double-enqueue
      return NextResponse.json({ job_id: existing.id, status: existing.status });
    }
    // existing.status === "done" — check if analysis covers the current photo set.
    // If the stored analysis has fewer photos than what we're now submitting (e.g. new
    // photos were extracted after a fresh fetch), invalidate it and re-run.
    if (existing.status === "done") {
      const { data: receiptRow } = await supabase
        .from("receipts")
        .select("photo_analysis")
        .eq("id", receipt_id)
        .single();
      const analysis = receiptRow?.photo_analysis as { photos?: unknown[] } | null;
      const analysedCount = Array.isArray(analysis?.photos) ? analysis.photos.length : 0;
      // Count all incoming photos — data: (user uploads) and scraped URLs both count.
      const incomingCount = photo_urls.length;
      if (analysis && analysedCount >= incomingCount) {
        return NextResponse.json({ job_id: existing.id, status: "done", photo_analysis: analysis });
      }
      // Stale or missing — invalidate and re-enqueue
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: "stale_photo_set", finished_at: new Date().toISOString() })
        .eq("id", existing.id);
      await supabase
        .from("receipts")
        .update({ photo_analysis: null })
        .eq("id", receipt_id);
    }
  }

  // Insert new job
  const { data: job, error: insertErr } = await supabase
    .from("receipt_photo_jobs")
    .insert({ receipt_id, status: "pending" })
    .select("id")
    .single();

  if (insertErr || !job) {
    console.error("[photo-analysis/enqueue] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  // Fire-and-forget: trigger background function
  // Netlify sets URL automatically; NEXT_PUBLIC_SITE_URL is a fallback for local dev.
  // In local dev, `netlify dev` runs on port 8888 — use that if next.js is on localhost.
  const rawBaseUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const isLocalDev = !rawBaseUrl || rawBaseUrl.includes("localhost");
  const baseUrl = isLocalDev ? "http://localhost:8888" : rawBaseUrl;
  const secret = process.env.PHOTO_ANALYSIS_SECRET;
  const functionUrl = `${baseUrl}/.netlify/functions/analyze-receipt-photos`;

  console.log("[photo-analysis/enqueue] baseUrl:", baseUrl, "secret set:", Boolean(secret), "functionUrl:", functionUrl);

  if (secret) {
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Photo-Analysis-Secret": secret,
      },
      body: JSON.stringify({
        receipt_id,
        job_id: job.id,
        photo_urls: photo_urls.slice(0, 20),
      }),
    })
      .then(async (r) => {
        const text = await r.text().catch(() => "");
        console.log("[photo-analysis/enqueue] background trigger response:", r.status, text.slice(0, 200));
      })
      .catch((err) => {
        console.error("[photo-analysis/enqueue] background trigger failed:", err);
      });
  } else {
    console.warn("[photo-analysis/enqueue] skipping background trigger — baseUrl:", baseUrl, "secret:", Boolean(secret));
  }

  return NextResponse.json({ job_id: job.id, status: "pending" });
}
