/**
 * Scan Photo Jobs — Scheduled Function
 *
 * Runs every minute via Netlify scheduled functions.
 * Polls receipt_photo_jobs for pending rows and processes them directly —
 * no HTTP trigger needed, which avoids the self-invocation reliability problem.
 *
 * Processes up to 3 pending jobs per run (one at a time) to stay within
 * the 60s scheduled function timeout.
 */

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { analysePhoto, buildCoverage } from "../../lib/photo-due-diligence.js";
import type { PhotoAnalysisResult, DamageFinding } from "../../lib/photo-due-diligence-types.js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function fetchAsBase64(url: string, siteUrl: string): Promise<string | null> {
  const fetchUrl = url.startsWith("/")
    ? `${siteUrl}${url}`
    : `${siteUrl}/api/img?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error("[scan-photo-jobs] HTTP", res.status, "for", url.slice(0, 80));
      return null;
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    return `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
  } catch (err) {
    console.error("[scan-photo-jobs] fetchAsBase64 failed for", url.slice(0, 80), err);
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

async function processJob(
  supabase: ReturnType<typeof getSupabase>,
  job: { id: string; receipt_id: string; photo_urls: string[] },
  siteUrl: string
): Promise<void> {
  console.log(`[scan-photo-jobs] processing job ${job.id} — ${job.photo_urls.length} photos`);

  await supabase
    .from("receipt_photo_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", job.id);

  const resolvedUrls = await Promise.all(
    job.photo_urls.slice(0, 20).map(async (url) => ({ url, dataUrl: await fetchAsBase64(url, siteUrl) }))
  );
  const fetchable = resolvedUrls.filter((r) => r.dataUrl !== null);
  console.log(`[scan-photo-jobs] ${fetchable.length}/${resolvedUrls.length} photos fetched`);

  if (fetchable.length === 0) {
    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "failed", error: "all_fetches_failed", finished_at: new Date().toISOString() })
      .eq("id", job.id);
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
    await supabase.from("receipts").update({ photo_analysis: partial }).eq("id", job.receipt_id);
  }

  await supabase
    .from("receipt_photo_jobs")
    .update({ status: "done", finished_at: new Date().toISOString() })
    .eq("id", job.id);

  console.log(`[scan-photo-jobs] job ${job.id} complete — ${completedPhotos.length} photos analysed`);
}

export default async function handler() {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`[scan-photo-jobs] providers — openai:${hasOpenAI} anthropic:${hasAnthropic}`);

  if (!hasOpenAI && !hasAnthropic) {
    console.error("[scan-photo-jobs] No AI provider configured");
    return;
  }

  const supabase = getSupabase();
  const siteUrl = "https://offolab.com";

  // Reset jobs stuck in "processing" for > 10 minutes (function timeout is 60s,
  // so anything stuck longer than that crashed without cleaning up)
  await supabase
    .from("receipt_photo_jobs")
    .update({ status: "pending", error: "reset_from_stuck_processing" })
    .eq("status", "processing")
    .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  // Fetch up to 3 pending jobs
  const { data: jobs, error } = await supabase
    .from("receipt_photo_jobs")
    .select("id, receipt_id, photo_urls")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    console.error("[scan-photo-jobs] DB error:", error.message);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log("[scan-photo-jobs] no pending jobs");
    return;
  }

  console.log(`[scan-photo-jobs] found ${jobs.length} pending job(s)`);

  // Process jobs sequentially to avoid overloading AI APIs
  for (const job of jobs) {
    if (!Array.isArray(job.photo_urls) || job.photo_urls.length === 0) {
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: "no_photo_urls", finished_at: new Date().toISOString() })
        .eq("id", job.id);
      continue;
    }
    try {
      await processJob(supabase, job as { id: string; receipt_id: string; photo_urls: string[] }, siteUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scan-photo-jobs] job ${job.id} failed:`, message);
      await supabase
        .from("receipt_photo_jobs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", job.id);
    }
  }
}

export const config: Config = {
  schedule: "* * * * *",  // every minute
};
