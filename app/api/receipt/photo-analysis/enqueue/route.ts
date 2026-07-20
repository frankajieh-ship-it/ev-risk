/**
 * POST /api/receipt/photo-analysis/enqueue
 *
 * Runs photo analysis synchronously within the request lifetime and streams
 * partial results to the DB after each photo so the UI can poll for progress.
 * Returns when all photos are done (or failed).
 *
 * Accepts both remote URLs (fetched server-side via /api/img) and data: URLs
 * (user-dragged base64 images — processed directly without fetching).
 *
 * Body: { receipt_id: string, photo_urls: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { analysePhoto, buildCoverage } from "@/lib/photo-due-diligence";
import type { PhotoAnalysisResult, DamageFinding } from "@/lib/photo-due-diligence-types";

export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

async function fetchAsBase64(url: string): Promise<string | null> {
  const fetchUrl = url.startsWith("/")
    ? `${SITE_URL}${url}`
    : `${SITE_URL}/api/img?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error("[photo-analysis] HTTP", res.status, "for", url.slice(0, 80));
      return null;
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    return `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
  } catch (err) {
    console.error("[photo-analysis] fetchAsBase64 failed:", url.slice(0, 80), err);
    return null;
  }
}

function buildSummary(photos: PhotoAnalysisResult["photos"]): string {
  const allFindings: (DamageFinding & { angle: string })[] = [];
  for (const p of photos) {
    for (const f of p.findings) allFindings.push({ ...f, angle: p.angle_id });
  }
  if (allFindings.length === 0) return "No visible damage detected in listing photos.";
  const byType: Record<string, number> = {};
  for (const f of allFindings) byType[f.type] = (byType[f.type] ?? 0) + 1;
  const parts = Object.entries(byType).map(([type, count]) =>
    count === 1 ? `1 ${type.replace("_", " ")}` : `${count} ${type.replace("_", " ")}s`
  );
  const valueAffecting = allFindings.filter((f) => f.affects_value).length;
  return (
    parts.join(", ") +
    (valueAffecting > 0
      ? ` — ${valueAffecting} finding${valueAffecting > 1 ? "s" : ""} may affect resale value`
      : "") +
    "."
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.receipt_id !== "string" || !Array.isArray(body.photo_urls)) {
    return NextResponse.json({ error: "receipt_id and photo_urls required" }, { status: 400 });
  }

  const { receipt_id, photo_urls } = body as { receipt_id: string; photo_urls: string[] };

  // Accept both data: (user-dragged) and remote URLs. Cap at 20 total.
  const allUrls = (photo_urls as string[]).filter((u) => typeof u === "string" && u.length > 0);
  const dataUrls = allUrls.filter((u) => u.startsWith("data:")).slice(0, 20);
  const remoteUrls = allUrls.filter((u) => !u.startsWith("data:")).slice(0, 20);
  const urlsToProcess = [...dataUrls, ...remoteUrls].slice(0, 20);

  if (urlsToProcess.length === 0) {
    return NextResponse.json({ error: "No photos to analyse" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasOpenAI && !hasAnthropic) {
    return NextResponse.json({ error: "No AI provider configured" }, { status: 503 });
  }

  // Check for a prior completed job with the same photo count — return cached result
  const { data: existing } = await supabase
    .from("receipt_photo_jobs")
    .select("id, status")
    .eq("receipt_id", receipt_id)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: receiptRow } = await supabase
      .from("receipts")
      .select("photo_analysis")
      .eq("id", receipt_id)
      .single();
    const analysis = receiptRow?.photo_analysis as { photos?: unknown[] } | null;
    const analysedCount = Array.isArray(analysis?.photos) ? analysis.photos.length : 0;
    if (analysis && analysedCount >= urlsToProcess.length) {
      return NextResponse.json({ job_id: existing.id, status: "done", photo_analysis: analysis });
    }
    // Stale — invalidate so we re-run below
    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "failed", error: "stale_photo_set", finished_at: new Date().toISOString() })
      .eq("id", existing.id);
    await supabase.from("receipts").update({ photo_analysis: null }).eq("id", receipt_id);
  }

  // Cancel any stuck pending/processing job for this receipt
  await supabase
    .from("receipt_photo_jobs")
    .update({ status: "failed", error: "superseded", finished_at: new Date().toISOString() })
    .eq("receipt_id", receipt_id)
    .in("status", ["pending", "processing"]);

  // Create job record — store only remote URLs (data: blobs are too large for a DB column)
  const { data: job, error: insertErr } = await supabase
    .from("receipt_photo_jobs")
    .insert({ receipt_id, status: "processing", photo_urls: remoteUrls.slice(0, 20), started_at: new Date().toISOString() })
    .select("id")
    .single();

  if (insertErr || !job) {
    console.error("[photo-analysis/enqueue] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  const jobId = job.id;
  console.log(`[photo-analysis] job ${jobId} — ${urlsToProcess.length} photos (${dataUrls.length} data:, ${remoteUrls.length} remote)`);

  try {
    // Resolve all URLs to base64 concurrently (data: pass-through, remote fetched)
    const resolved = await Promise.all(
      urlsToProcess.map(async (url) => ({
        url,
        dataUrl: url.startsWith("data:") ? url : await fetchAsBase64(url),
      }))
    );
    const fetchable = resolved.filter((r) => r.dataUrl !== null);
    console.log(`[photo-analysis] job ${jobId}: ${fetchable.length}/${resolved.length} resolved`);

    if (fetchable.length === 0) {
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: "all_fetches_failed", finished_at: new Date().toISOString() })
        .eq("id", jobId);
      return NextResponse.json({ job_id: jobId, status: "failed", error: "all_fetches_failed" });
    }

    const completedPhotos: PhotoAnalysisResult["photos"] = [];

    for (const { url, dataUrl } of fetchable) {
      const { angle_id, findings } = await analysePhoto(dataUrl!);
      completedPhotos.push({ url, angle_id, findings });

      // Write partial result after each photo so the UI can show live progress
      const allFindings = completedPhotos.flatMap((p) => p.findings);
      const partial: PhotoAnalysisResult = {
        analyzed_at: new Date().toISOString(),
        coverage: buildCoverage(completedPhotos.map((p) => p.angle_id)),
        photos: completedPhotos,
        total_findings: allFindings.length,
        severe_findings: allFindings.filter((f) => f.severity === "severe").length,
        summary: buildSummary(completedPhotos),
      };
      await supabase.from("receipts").update({ photo_analysis: partial }).eq("id", receipt_id);
    }

    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", jobId);

    const allFindings = completedPhotos.flatMap((p) => p.findings);
    const finalResult: PhotoAnalysisResult = {
      analyzed_at: new Date().toISOString(),
      coverage: buildCoverage(completedPhotos.map((p) => p.angle_id)),
      photos: completedPhotos,
      total_findings: allFindings.length,
      severe_findings: allFindings.filter((f) => f.severity === "severe").length,
      summary: buildSummary(completedPhotos),
    };

    console.log(`[photo-analysis] job ${jobId} complete — ${completedPhotos.length} photos`);
    return NextResponse.json({ job_id: jobId, status: "done", photo_analysis: finalResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[photo-analysis] job ${jobId} error:`, message);
    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    return NextResponse.json({ job_id: jobId, status: "failed", error: message });
  }
}
