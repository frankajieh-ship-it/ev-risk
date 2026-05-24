/**
 * POST /api/admin/deals-import-urls
 *
 * Accepts a JSON array of CarGurus (or any supported marketplace) listing URLs,
 * scrapes each one, runs the full OFFO AI scoring pipeline (same as /api/receipt),
 * and upserts the result into curated_deals.
 *
 * Uses hedgedGenerate + SYSTEM_PROMPT + buildUserPrompt so verdicts and risk_flags
 * match exactly what a user would get running the same listing through /receipt.
 * Falls back to deterministic scoreReceiptV2 if AI fails.
 *
 * Request body:
 *   { urls: string[], tag?: string }
 *
 * Response:
 *   { success, results: ImportUrlResult[], imported, skipped, errors }
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { extractVehicleData } from "@/lib/listing-scraper";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { computeDealQualityScore } from "@/lib/deal-quality-score";
import { scoreWithAi, inferSignalsFromListing } from "@/lib/deals-score";
import { lookupLocalImages } from "@/lib/vehicle-image-db";
import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
// AI scoring takes ~5-10s per listing; keep batches small to stay within 60s Next.js limit
const MAX_URLS_PER_CALL = 5;


function proxyIfWikimedia(url: string): string {
  return url.includes("upload.wikimedia.org")
    ? `/api/proxy-image?url=${encodeURIComponent(url)}`
    : url;
}

function resolvePhotoSync(make: string, model: string | null, year: number | null): string | null {
  if (model) {
    const local = lookupLocalImages(make, model, year ?? undefined);
    if (local.matched && local.urls.length > 0) return proxyIfWikimedia(local.urls[0]);
  }
  const staticUrl = getStaticPhotoUrl(make, model ?? undefined, year ?? undefined);
  if (staticUrl) return proxyIfWikimedia(staticUrl);
  const fallback = MAKE_FALLBACK_MAP[make.toLowerCase()];
  return fallback ? proxyIfWikimedia(fallback) : null;
}

export interface ImportUrlResult {
  url: string;
  status: "imported" | "skipped" | "error";
  vehicle_label?: string;
  verdict?: string;
  fit_score?: number;
  evidence_score?: number;
  risk_points?: number;
  deal_quality_score?: number;
  error?: string;
  extraction_confidence?: string;
  scoring_source?: "ai" | "deterministic";
}

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let body: { urls?: unknown; tag?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrls = body.urls;
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty urls array" },
      { status: 400 },
    );
  }

  const urls: string[] = rawUrls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => u.startsWith("http"));

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "No valid URLs found (must start with http)" },
      { status: 400 },
    );
  }

  if (urls.length > MAX_URLS_PER_CALL) {
    return NextResponse.json(
      { error: `Max ${MAX_URLS_PER_CALL} URLs per request` },
      { status: 400 },
    );
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const results: ImportUrlResult[] = [];
  let imported = 0;
  let skipped = 0;

  for (const url of urls) {
    // Extract vehicle data via the existing scraper
    const extraction = await extractVehicleData(url);

    if (!extraction.success || !extraction.data) {
      const reason = extraction.diagnostics?.failureReason ?? "unknown";
      results.push({
        url,
        status: "error",
        error: extraction.error ?? `Extraction failed (${reason})`,
      });
      skipped++;
      continue;
    }

    const d = extraction.data;

    // Need at least year+make+model to be useful
    if (!d.year || !d.make || !d.model) {
      results.push({
        url,
        status: "error",
        error: `Could not extract vehicle identity (got: year=${d.year}, make=${d.make}, model=${d.model})`,
      });
      skipped++;
      continue;
    }

    // Run AI scoring (same pipeline as /api/receipt); falls back to deterministic on failure
    const aiResult = await scoreWithAi(url, d);

    // Run deterministic V1 scorer on AI-extracted signals
    const scoring = scoreReceipt(
      aiResult.signals.length > 0 ? aiResult.signals : inferSignalsFromListing(d)
    );
    const riskPoints = Math.max(0, Math.round((100 - scoring.fit_score) / 10));

    // Build vehicle label
    const vehicleLabel = [d.year, d.make, d.model, d.trim]
      .filter(Boolean)
      .join(" ");

    // Resolve url_domain
    let urlDomain: string | null = null;
    try {
      urlDomain = new URL(url).hostname.replace("www.", "");
    } catch {
      urlDomain = null;
    }

    // Compute composite deal quality score
    const dealQualityScore = computeDealQualityScore(
      scoring.evidence_score,
      riskPoints,
      scoring.fit_score,
    );

    // Risk flags: use AI-authored strings if available; otherwise top 3 scoring reason labels
    const riskFlags = aiResult.riskFlags.length > 0
      ? aiResult.riskFlags
      : scoring.scoring_reasons
          .filter((r: { points: number }) => r.points <= 0)
          .sort((a: { points: number }, b: { points: number }) => Math.abs(b.points) - Math.abs(a.points))
          .slice(0, 3)
          .map((r: { label: string }) => r.label);

    // Resolve photo: local CSV → static map → make fallback (all sync, no HTTP)
    let photoUrl: string | null = null;
    if (d.make) {
      photoUrl = resolvePhotoSync(d.make, d.model ?? null, d.year ?? null);
    }

    // Upsert into curated_deals
    const { error: upsertErr } = await supabase.from("curated_deals").upsert(
      {
        listing_url: url,
        url_domain: urlDomain,
        vehicle_label: vehicleLabel,
        year: d.year ?? null,
        make: d.make ?? null,
        model: d.model ?? null,
        trim: d.trim ?? null,
        price: d.price ?? null,
        mileage: d.mileage ?? null,
        location: d.location ?? null,
        verdict: scoring.verdict,
        evidence_score: scoring.evidence_score,
        fit_score: scoring.fit_score,
        risk_points: riskPoints,
        deal_quality_score: dealQualityScore,
        risk_flags: riskFlags.length > 0 ? riskFlags : null,
        photo_url: photoUrl,
        receipt_id: null,
        last_analyzed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: "listing_url", ignoreDuplicates: false },
    );

    if (upsertErr) {
      results.push({
        url,
        status: "error",
        error: `DB upsert failed: ${upsertErr.message}`,
        vehicle_label: vehicleLabel,
      });
      skipped++;
    } else {
      results.push({
        url,
        status: "imported",
        vehicle_label: vehicleLabel,
        verdict: scoring.verdict,
        fit_score: scoring.fit_score,
        evidence_score: scoring.evidence_score,
        risk_points: riskPoints,
        deal_quality_score: dealQualityScore,
        extraction_confidence: d.confidence,
        scoring_source: aiResult.source,
      });
      imported++;
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    errors: results.filter((r) => r.status === "error").map((r) => r.error),
    results,
  });
}
