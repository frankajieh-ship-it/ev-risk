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
import {
  classifyAngle,
  detectDamage,
  buildCoverage,
  type PhotoAnalysisResult,
  type DamageFinding,
} from "../../lib/photo-due-diligence.js";

interface PhotoAnalysisPayload {
  receipt_id: string;
  job_id: string;
  photo_urls: string[];
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Run items in parallel batches of N
async function batchedParallel<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
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

  const { receipt_id, job_id, photo_urls } = payload;
  if (!receipt_id || !job_id || !Array.isArray(photo_urls)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const supabase = getSupabase();

  // Mark job processing
  await supabase
    .from("receipt_photo_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", job_id);

  try {
    // Analyse each photo — classify angle + detect damage — in batches of 4
    const photos = await batchedParallel(
      photo_urls.slice(0, 20),
      4,
      async (url) => {
        const [angle_id, findings] = await Promise.all([
          classifyAngle(url),
          detectDamage(url),
        ]);
        return { url, angle_id, findings };
      }
    );

    const coverage = buildCoverage(photos.map((p) => p.angle_id));
    const allFindings = photos.flatMap((p) => p.findings);

    const result: PhotoAnalysisResult = {
      analyzed_at: new Date().toISOString(),
      coverage,
      photos,
      total_findings: allFindings.length,
      severe_findings: allFindings.filter((f) => f.severity === "severe").length,
      summary: buildSummary(photos),
    };

    // Persist to receipts
    await supabase
      .from("receipts")
      .update({ photo_analysis: result })
      .eq("id", receipt_id);

    // Mark job done
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
