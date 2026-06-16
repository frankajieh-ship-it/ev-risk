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
    return NextResponse.json({ job_id: existing.id, status: existing.status });
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
  // Netlify sets URL automatically; NEXT_PUBLIC_SITE_URL is a fallback for local dev
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const secret = process.env.PHOTO_ANALYSIS_SECRET;
  const functionUrl = `${baseUrl}/.netlify/functions/analyze-receipt-photos`;

  console.log("[photo-analysis/enqueue] baseUrl:", baseUrl, "secret set:", Boolean(secret), "functionUrl:", functionUrl);

  if (baseUrl && secret && !baseUrl.includes("localhost")) {
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
