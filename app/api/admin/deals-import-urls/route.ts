/**
 * POST /api/admin/deals-import-urls
 *
 * Accepts a JSON array of CarGurus (or any supported marketplace) listing URLs,
 * scrapes each one, runs deterministic OFFO scoring (scoreReceiptV2), and
 * upserts the result into curated_deals.
 *
 * No AI required — fully deterministic. Runs in a single Next.js API route
 * (max 60s); batch size should stay at or below 20 URLs per call.
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
import { scoreReceiptV2 } from "@/lib/receipt-scoring-v2";
import { computeDealQualityScore } from "@/lib/deal-quality-score";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const MAX_URLS_PER_CALL = 20;

// --- Signal inference from scraped listing data ---
// We don't have AI to extract signals, so we infer the most reliable ones
// from what the scraper actually returns (VIN present, title status, etc.)

function inferSignalsFromListing(data: {
  vin?: string;
  title_status?: "clean" | "salvage" | "rebuilt" | "unknown";
  accidents_reported?: "yes" | "no" | "unknown";
  mileage?: number;
  price?: number;
  battery_kwh?: number;
  dc_fast_kw?: number;
  range_mi?: number;
}): string[] {
  const signals: string[] = [];

  // VIN presence → strong evidence signal
  if (data.vin) {
    signals.push("vin_decoded");
  } else {
    signals.push("vin_missing");
  }

  // Title status
  if (data.title_status === "clean") {
    signals.push("clean_title_explicit");
  } else if (data.title_status === "salvage" || data.title_status === "rebuilt") {
    signals.push("title_salvage");
  } else {
    signals.push("title_status_unclear");
  }

  // Accident history
  if (data.accidents_reported === "yes") {
    signals.push("prior_damage_minor");
  }

  // Missing battery proof — no battery report shown in listing
  signals.push("battery_proof_missing");

  // Missing service records — can't confirm from listing alone
  signals.push("service_records_missing");

  // DC fast charge confirmed if scraped
  if (data.dc_fast_kw && data.dc_fast_kw > 0) {
    signals.push("dcfc_confirmed");
  }

  // High mileage penalty (>80k for EV is meaningful)
  if (data.mileage && data.mileage > 80000) {
    signals.push("ownership_turnover_high");
  }

  return signals;
}

async function fetchPhotoUrl(
  make: string,
  model: string | null,
  year: number | null,
  baseUrl: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ make });
    if (model) params.set("model", model);
    if (year) params.set("year", String(year));
    const res = await fetch(`${baseUrl}/api/photos?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.photo_urls?.[0] as string) ?? null;
  } catch {
    return null;
  }
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

    // Infer signals from extracted data
    const signals = inferSignalsFromListing(d);

    // Run deterministic V2 scoring
    const scoring = scoreReceiptV2(signals);

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
      scoring.risk_points,
      scoring.fit_score,
    );

    // Top 3 risk flags from scoring reasons (negative points = risk)
    const riskFlags = scoring.scoring_reasons
      .filter((r) => r.points <= 0)
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
      .slice(0, 3)
      .map((r) => r.label);

    // Auto-fetch photo
    let photoUrl: string | null = null;
    if (d.make) {
      photoUrl = await fetchPhotoUrl(d.make, d.model ?? null, d.year ?? null, baseUrl);
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
        risk_points: scoring.risk_points,
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
        risk_points: scoring.risk_points,
        deal_quality_score: dealQualityScore,
        extraction_confidence: d.confidence,
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
