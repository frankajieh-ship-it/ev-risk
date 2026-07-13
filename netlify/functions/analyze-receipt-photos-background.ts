/**
 * Netlify Background Function: Receipt Photo Analysis
 *
 * POST /.netlify/functions/analyze-receipt-photos
 *
 * Runs asynchronously for up to 15 minutes. Triggered by
 * POST /api/receipt/photo-analysis/enqueue after a listing fetch.
 *
 * Security: validated via X-Photo-Analysis-Secret header.
 *
 * For each listing photo:
 *   1. Classifies the angle (front, rear, interior, etc.)
 *   2. Detects visible damage (dents, scratches, rust, etc.)
 *
 * Writes results to receipts.photo_analysis and marks the job done.
 */

import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { analysePhoto, buildCoverage } from "../../lib/photo-due-diligence.js";
import type { PhotoAnalysisResult, DamageFinding } from "../../lib/photo-due-diligence-types.js";

interface PhotoAnalysisPayload {
  receipt_id: string;
  job_id: string;
  // photo_urls is no longer sent in the HTTP body — the background function
  // reads them from the receipt_photo_jobs row to avoid Netlify's 6MB body limit.
  photo_urls?: string[];
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Fetch image and return as base64 data URL so OpenAI/Anthropic can process it.
// - Local paths (/vehicles/...) are fetched directly from the site origin.
// - External CDN URLs are routed through /api/img proxy which adds the correct
//   User-Agent and strips Referer to bypass hotlink protection.
async function fetchAsBase64(url: string, siteUrl: string): Promise<string | null> {
  // Local public/ path — fetch directly, no proxy needed
  const fetchUrl = url.startsWith("/")
    ? `${siteUrl}${url}`
    : `${siteUrl}/api/img?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error("[fetchAsBase64] HTTP", res.status, "for", url.slice(0, 80));
      return null;
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${ct};base64,${b64}`;
  } catch (err) {
    console.error("[fetchAsBase64] failed for", url.slice(0, 80), err);
    return null;
  }
}


function buildSummary(photos: PhotoAnalysisResult["photos"]): string {
  const allFindings: (DamageFinding & { angle: string })[] = [];
  for (const p of photos) {
    for (const f of p.findings) {
      allFindings.push({ ...f, angle: p.angle_id });
    }
  }

  if (allFindings.length === 0) return "No visible damage detected in listing photos.";

  const byType: Record<string, number> = {};
  for (const f of allFindings) {
    byType[f.type] = (byType[f.type] ?? 0) + 1;
  }

  const parts = Object.entries(byType).map(([type, count]) =>
    count === 1 ? `1 ${type.replace("_", " ")}` : `${count} ${type.replace("_", " ")}s`
  );

  const valueAffecting = allFindings.filter((f) => f.affects_value).length;
  const suffix =
    valueAffecting > 0
      ? ` — ${valueAffecting} finding${valueAffecting > 1 ? "s" : ""} may affect resale value`
      : "";

  return parts.join(", ") + suffix + ".";
}

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const secret = event.headers["x-photo-analysis-secret"];
  const expectedSecret = process.env.PHOTO_ANALYSIS_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let payload: PhotoAnalysisPayload;
  try {
    payload = JSON.parse(event.body ?? "{}") as PhotoAnalysisPayload;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { receipt_id, job_id } = payload;
  if (!receipt_id || !job_id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  // Check AI provider availability before touching the DB
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`[analyze-receipt-photos] providers — openai:${hasOpenAI} anthropic:${hasAnthropic}`);
  if (!hasOpenAI && !hasAnthropic) {
    console.error("[analyze-receipt-photos] No AI provider configured — OPENAI_API_KEY and ANTHROPIC_API_KEY both missing");
    return { statusCode: 500, body: JSON.stringify({ error: "No AI provider configured" }) };
  }

  // Site URL used to route image fetches through our proxy (handles hotlink protection)
  const siteUrl = (process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || "https://offolab.com").replace(/\/$/, "");

  const supabase = getSupabase();

  // Read photo_urls from the job row — they were stored by the enqueue route
  // so we don't have to receive them in the HTTP body (avoids 6MB Netlify limit).
  const { data: jobRow } = await supabase
    .from("receipt_photo_jobs")
    .select("photo_urls")
    .eq("id", job_id)
    .single();

  const photo_urls: string[] = Array.isArray(jobRow?.photo_urls) ? jobRow.photo_urls : [];
  if (photo_urls.length === 0) {
    console.error("[analyze-receipt-photos] No photo_urls found on job row:", job_id);
    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "failed", error: "no_photo_urls", finished_at: new Date().toISOString() })
      .eq("id", job_id);
    return { statusCode: 400, body: JSON.stringify({ error: "No photos to analyse" }) };
  }

  // Mark job processing
  await supabase
    .from("receipt_photo_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", job_id);

  try {
    // Fetch up to 20 photos in full parallel — independent requests, no need to batch.
    const resolvedUrls = await Promise.all(
      photo_urls.slice(0, 20).map(async (url) => ({ url, dataUrl: await fetchAsBase64(url, siteUrl) }))
    );
    const fetchable = resolvedUrls.filter((r) => r.dataUrl !== null);
    console.log(`[analyze-receipt-photos] ${fetchable.length}/${resolvedUrls.length} photos fetched successfully`);

    // Analyse each photo sequentially — write partial results to DB after each one
    // so the status endpoint can return incremental data and the UI can update in real-time.
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
      await supabase
        .from("receipts")
        .update({ photo_analysis: partial })
        .eq("id", receipt_id);
    }

    // Mark job done — photo_analysis already has the final state from the last iteration
    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", job_id);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze-receipt-photos] Error:", message);

    await supabase
      .from("receipt_photo_jobs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", job_id);

    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
};

export { handler };
