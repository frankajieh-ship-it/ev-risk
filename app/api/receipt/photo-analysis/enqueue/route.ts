/**
 * POST /api/receipt/photo-analysis/enqueue
 *
 * Creates a receipt_photo_jobs entry, responds immediately with job_id,
 * then runs the full photo analysis in the post-response phase using next/server `after()`.
 * This avoids the need for a separate background function entirely and sidesteps the
 * unreliable self-HTTP-invocation pattern on Netlify.
 *
 * Body: { receipt_id: string, photo_urls: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { analysePhoto, buildCoverage } from "@/lib/photo-due-diligence";
import type { PhotoAnalysisResult, DamageFinding } from "@/lib/photo-due-diligence-types";

export const maxDuration = 60;

async function fetchAsBase64(url: string): Promise<string | null> {
  const siteUrl = "https://offolab.com";
  const fetchUrl = url.startsWith("/")
    ? `${siteUrl}${url}`
    : `${siteUrl}/api/img?url=${encodeURIComponent(url)}`;
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
  return parts.join(", ") + (valueAffecting > 0 ? ` — ${valueAffecting} finding${valueAffecting > 1 ? "s" : ""} may affect resale value` : "") + ".";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.receipt_id !== "string" || !Array.isArray(body.photo_urls)) {
    return NextResponse.json({ error: "receipt_id and photo_urls required" }, { status: 400 });
  }

  const { receipt_id, photo_urls } = body as { receipt_id: string; photo_urls: string[] };

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

  // Check for existing active job
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
      // Invalidate stale job — fall through to create fresh one with current photo set
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: "superseded", finished_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else if (existing.status === "done") {
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
      // Stale result — invalidate and re-run
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: "stale_photo_set", finished_at: new Date().toISOString() })
        .eq("id", existing.id);
      await supabase.from("receipts").update({ photo_analysis: null }).eq("id", receipt_id);
    }
  }

  // Create fresh job
  const { data: job, error: insertErr } = await supabase
    .from("receipt_photo_jobs")
    .insert({ receipt_id, status: "pending", photo_urls: filteredUrls.slice(0, 20) })
    .select("id")
    .single();

  if (insertErr || !job) {
    console.error("[photo-analysis/enqueue] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  const jobId = job.id;
  const urlsToProcess = filteredUrls.slice(0, 20);

  console.log("[photo-analysis/enqueue] job", jobId, "created —", urlsToProcess.length, "photos, running after()");

  // Run analysis after response is sent — no separate function needed
  after(async () => {
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
    console.log(`[photo-analysis] job ${jobId} starting — openai:${hasOpenAI} anthropic:${hasAnthropic}`);

    if (!hasOpenAI && !hasAnthropic) {
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: "no_ai_provider", finished_at: new Date().toISOString() })
        .eq("id", jobId);
      return;
    }

    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", jobId);

    try {
      const resolvedUrls = await Promise.all(
        urlsToProcess.map(async (url) => ({ url, dataUrl: await fetchAsBase64(url) }))
      );
      const fetchable = resolvedUrls.filter((r) => r.dataUrl !== null);
      console.log(`[photo-analysis] job ${jobId}: ${fetchable.length}/${resolvedUrls.length} photos fetched`);

      if (fetchable.length === 0) {
        await supabase
          .from("receipt_photo_jobs")
          .update({ status: "failed", error: "all_fetches_failed", finished_at: new Date().toISOString() })
          .eq("id", jobId);
        return;
      }

      const completedPhotos: PhotoAnalysisResult["photos"] = [];

      for (const { url, dataUrl } of fetchable) {
        const { angle_id, findings } = await analysePhoto(dataUrl!);
        completedPhotos.push({ url, angle_id, findings });

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

      console.log(`[photo-analysis] job ${jobId} complete — ${completedPhotos.length} photos analysed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[photo-analysis] job ${jobId} error:`, message);
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", jobId);
    }
  });

  return NextResponse.json({ job_id: jobId, status: "pending" });
}
