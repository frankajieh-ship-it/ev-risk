/**
 * POST /api/admin/deals-import
 *
 * Accepts a CSV file upload (multipart/form-data, field name "file"),
 * parses it, validates each row, and upserts into curated_deals.
 * Skips AI analysis — trusts your manual verdict and risk_flags.
 * If photo_url is blank, fetches one from /api/photos automatically.
 *
 * Protected by ADMIN_API_KEY bearer token.
 *
 * CSV columns (in any order, header row required):
 *   listing_url, vehicle_label, year, make, model, trim,
 *   price, mileage, location, verdict, risk_flags, photo_url, url_domain
 *
 * risk_flags: semicolon-separated, e.g. "Battery unknown;Service history missing"
 * verdict: GREEN | YELLOW | RED
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { computeDealQualityScore } from "@/lib/deal-quality-score";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const VALID_VERDICTS = new Set(["GREEN", "YELLOW", "RED"]);

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

async function fetchPhotoUrl(make: string, model: string | null, year: number | null, baseUrl: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ make });
    if (model) params.set("model", model);
    if (year) params.set("year", String(year));
    const res = await fetch(`${baseUrl}/api/photos?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.photo_urls?.[0] ?? null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let csvText: string;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded — send multipart/form-data with field 'file'" }, { status: 400 });
    }
    csvText = await (file as Blob).text();
  } catch {
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV is empty or has no data rows" }, { status: 400 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://offolab.com").replace(/\/$/, "");

  const results = { imported: 0, skipped: 0, deactivated: 0, errors: [] as string[] };

  // Collect all valid URLs from this CSV so we can deactivate rows not in it
  const csvUrls = new Set(
    rows
      .map((r) => r["listing_url"]?.trim())
      .filter((u): u is string => !!u && u.startsWith("http"))
  );

  for (const row of rows) {
    const listingUrl = row["listing_url"]?.trim();
    if (!listingUrl || !listingUrl.startsWith("http")) {
      results.errors.push(`Row skipped: invalid listing_url "${listingUrl}"`);
      results.skipped++;
      continue;
    }

    const verdictRaw = row["verdict"]?.toUpperCase().trim();
    if (verdictRaw && !VALID_VERDICTS.has(verdictRaw)) {
      results.errors.push(`Row skipped (${listingUrl}): invalid verdict "${verdictRaw}" — must be GREEN, YELLOW, or RED`);
      results.skipped++;
      continue;
    }

    const year = row["year"] ? parseInt(row["year"]) : null;
    const price = row["price"] ? parseInt(row["price"].replace(/[$,]/g, "")) : null;
    const mileage = row["mileage"] ? parseInt(row["mileage"].replace(/[,]/g, "")) : null;
    const make = row["make"]?.trim() || null;
    const model = row["model"]?.trim() || null;
    const trim = row["trim"]?.trim() || null;
    const location = row["location"]?.trim() || null;
    const verdict = (verdictRaw || "YELLOW") as "GREEN" | "YELLOW" | "RED";
    const riskFlagsRaw = row["risk_flags"]?.trim();
    const riskFlags = riskFlagsRaw ? riskFlagsRaw.split(";").map((f) => f.trim()).filter(Boolean).slice(0, 3) : null;
    const vehicleLabel = row["vehicle_label"]?.trim() || [year, make, model, trim].filter(Boolean).join(" ") || null;
    let photoUrl = row["photo_url"]?.trim() || null;
    const urlDomain = row["url_domain"]?.trim() || (() => {
      try { return new URL(listingUrl).hostname.replace("www.", ""); } catch { return null; }
    })();

    // Auto-fetch photo if not provided
    if (!photoUrl && make) {
      photoUrl = await fetchPhotoUrl(make, model, year, baseUrl);
    }

    // Compute deal quality score (no evidence/fit data for manual entries — uses defaults)
    const dealQualityScore = computeDealQualityScore(null, null, null);

    const { error: upsertErr } = await supabase
      .from("curated_deals")
      .upsert({
        listing_url: listingUrl,
        url_domain: urlDomain,
        vehicle_label: vehicleLabel,
        year,
        make,
        model,
        trim,
        price,
        mileage,
        location,
        verdict,
        evidence_score: null,
        fit_score: null,
        risk_points: null,
        deal_quality_score: dealQualityScore,
        risk_flags: riskFlags,
        photo_url: photoUrl,
        receipt_id: null,
        last_analyzed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: "listing_url", ignoreDuplicates: false });

    if (upsertErr) {
      results.errors.push(`Upsert failed for ${listingUrl}: ${upsertErr.message}`);
      results.skipped++;
    } else {
      results.imported++;
    }
  }

  // Deactivate any currently-active rows whose URLs are NOT in this CSV upload.
  // This handles sold/removed listings that were manually deleted from the CSV.
  if (csvUrls.size > 0) {
    const { data: activeRows } = await supabase
      .from("curated_deals")
      .select("id, listing_url")
      .eq("is_active", true);

    const toDeactivate = (activeRows ?? [])
      .filter((r) => !csvUrls.has(r.listing_url))
      .map((r) => r.id);

    if (toDeactivate.length > 0) {
      await supabase
        .from("curated_deals")
        .update({ is_active: false })
        .in("id", toDeactivate);
      results.deactivated = toDeactivate.length;
    }
  }

  return NextResponse.json({
    success: true,
    imported: results.imported,
    skipped: results.skipped,
    deactivated: results.deactivated,
    errors: results.errors.slice(0, 20),
    total_rows: rows.length,
  });
}
