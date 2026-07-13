/**
 * POST /api/receipt/photo-analysis/enqueue
 *
 * Creates a receipt_photo_jobs entry and fires the background analysis function.
 * Idempotent: returns existing job_id if a pending/processing job already exists.
 *
 * Body: { receipt_id: string, photo_urls: string[] }
 *
 * photo_urls must be local paths (start with "/") or plain CDN https:// URLs —
 * NOT base64 data: URIs. The background function fetches them server-side via
 * the /api/img proxy. Storing data: URIs here would blow past Netlify's 6MB
 * function request body limit.
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

  // Strip out any data: URIs that slipped through — they'd bloat the DB write
  // and make the payload unmanageably large. Only accept real URLs.
  const filteredUrls = (photo_urls as string[]).filter(
    (u) => typeof u === "string" && !u.startsWith("data:") && u.length > 0
  );

  if (filteredUrls.length === 0) {
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
      return NextResponse.json({ job_id: existing.id, status: existing.status });
    }
    if (existing.status === "done") {
      const { data: receiptRow } = await supabase
        .from("receipts")
        .select("photo_analysis")
        .eq("id", receipt_id)
        .single();
      const analysis = receiptRow?.photo_analysis as { photos?: unknown[] } | null;
      const analysedCount = Array.isArray(analysis?.photos) ? analysis.photos.length : 0;
      if (analysis && analysedCount >= filteredUrls.length) {
        return NextResponse.json({ job_id: existing.id, status: "done", photo_analysis: analysis });
      }
      // Stale — invalidate and re-enqueue
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

  // Insert new job — store URLs here so the background function can read them
  // without needing them in the HTTP request body.
  const { data: job, error: insertErr } = await supabase
    .from("receipt_photo_jobs")
    .insert({ receipt_id, status: "pending", photo_urls: filteredUrls.slice(0, 20) })
    .select("id")
    .single();

  if (insertErr || !job) {
    console.error("[photo-analysis/enqueue] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  // Fire background function with only IDs — no image data in the body.
  // The background function reads photo_urls from the receipt_photo_jobs row.
  const rawBaseUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const isLocalDev = !rawBaseUrl || rawBaseUrl.includes("localhost");
  const baseUrl = isLocalDev ? "http://localhost:8888" : rawBaseUrl;
  const secret = process.env.PHOTO_ANALYSIS_SECRET;
  const functionUrl = `${baseUrl}/.netlify/functions/analyze-receipt-photos-background`;

  console.log("[photo-analysis/enqueue] baseUrl:", baseUrl, "secret set:", Boolean(secret), "photos:", filteredUrls.length);

  if (secret) {
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Photo-Analysis-Secret": secret,
      },
      body: JSON.stringify({ receipt_id, job_id: job.id }),
    })
      .then(async (r) => {
        const text = await r.text().catch(() => "");
        console.log("[photo-analysis/enqueue] background trigger response:", r.status, text.slice(0, 200));
      })
      .catch((err) => {
        console.error("[photo-analysis/enqueue] background trigger failed:", err);
      });
  } else {
    console.warn("[photo-analysis/enqueue] skipping background trigger — no PHOTO_ANALYSIS_SECRET");
  }

  return NextResponse.json({ job_id: job.id, status: "pending" });
}
