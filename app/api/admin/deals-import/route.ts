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
 *   price, mileage, location, vin, title_status, battery_report, service_records,
 *   verdict, risk_flags, photo_url, url_domain
 *
 * title_status: clean | salvage | rebuilt | unknown
 * battery_report: yes | no (blank = unknown)
 * service_records: yes | no (blank = unknown)
 * risk_flags: semicolon-separated, e.g. "Battery unknown;Service history missing"
 * verdict: GREEN | YELLOW | RED
 */

import { existsSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { computeDealQualityScore } from "@/lib/deal-quality-score";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { lookupLocalImages } from "@/lib/vehicle-image-db";
import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";

/**
 * Derive listing_signals from structured CSV fields (no AI needed).
 * These map directly to the scoring rules in receipt-rules.ts.
 */
function signalsFromStructuredData(opts: {
  vin: string | null;
  title_status: string | null;
  battery_report: string | null;
  service_records: string | null;
}): string[] {
  const signals: string[] = [];
  // VIN
  if (opts.vin) signals.push("vin_decoded"); else signals.push("vin_missing");
  // Title
  if (opts.title_status === "clean") signals.push("clean_title_explicit");
  else if (opts.title_status === "salvage" || opts.title_status === "rebuilt") signals.push("title_salvage");
  else signals.push("title_status_unclear");
  // Battery report
  if (opts.battery_report === "yes") signals.push("battery_report_recent");
  else if (opts.battery_report === "no") signals.push("battery_proof_missing");
  // Service records
  if (opts.service_records === "yes") signals.push("service_records_shown");
  else if (opts.service_records === "no") signals.push("service_records_missing");
  return signals;
}

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

function proxyIfWikimedia(url: string): string {
  return url.includes("upload.wikimedia.org")
    ? `/api/img?url=${encodeURIComponent(url)}`
    : url;
}

function resolvePhotoSync(make: string, model: string | null, year: number | null): string | null {
  // Tier 0: local CSV (exact vehicle match, year-aware)
  if (model) {
    const local = lookupLocalImages(make, model, year ?? undefined);
    if (local.matched && local.urls.length > 0) return proxyIfWikimedia(local.urls[0]);
  }
  // Tier 1: static Wikimedia map
  const staticUrl = getStaticPhotoUrl(make, model ?? undefined, year ?? undefined);
  if (staticUrl) return proxyIfWikimedia(staticUrl);
  // Tier 2: make-level fallback
  const fallback = MAKE_FALLBACK_MAP[make.toLowerCase()];
  return fallback ? proxyIfWikimedia(fallback) : null;
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
    const vin = row["vin"]?.trim() || null;
    const titleStatusRaw = row["title_status"]?.trim().toLowerCase() || null;
    const title_status = (["clean", "salvage", "rebuilt", "unknown"].includes(titleStatusRaw ?? "") ? titleStatusRaw : null) as "clean" | "salvage" | "rebuilt" | "unknown" | null;
    const batteryReportRaw = row["battery_report"]?.trim().toLowerCase() || null;
    const battery_report = (["yes", "no"].includes(batteryReportRaw ?? "") ? batteryReportRaw : null) as "yes" | "no" | null;
    const serviceRecordsRaw = row["service_records"]?.trim().toLowerCase() || null;
    const service_records = (["yes", "no"].includes(serviceRecordsRaw ?? "") ? serviceRecordsRaw : null) as "yes" | "no" | null;

    // ── v4 fields (charging + range + seller + options + climate + warranty) ──
    const dcfc_kw_max = row["dcfc_kw_max"] ? parseInt(row["dcfc_kw_max"]) : null;
    const ac_charger_kw = row["ac_charger_kw"] ? parseFloat(row["ac_charger_kw"]) : null;
    const charge_port_type = row["charge_port_type"]?.trim() || null;
    // Accept both "epa_range_mi" and "battery range" (CSV export header)
    const epa_range_mi = (row["epa_range_mi"] || row["battery range"]) ? parseInt((row["epa_range_mi"] || row["battery range"]).replace(/[^0-9]/g, "")) : null;
    const estimated_real_range_mi = row["estimated_real_range_mi"] ? parseInt(row["estimated_real_range_mi"]) : null;
    const sellerTypeRaw = row["seller_type"]?.trim().toLowerCase() || null;
    const seller_type = (["private", "dealer", "cpo", "auction"].includes(sellerTypeRaw ?? "") ? sellerTypeRaw : null) as "private" | "dealer" | "cpo" | "auction" | null;
    const days_on_market = row["days_on_market"] ? parseInt(row["days_on_market"]) : null;
    // Accept both "exterior_color" and "exterrior color" (typo in CSV header)
    const exterior_color = (row["exterior_color"] || row["exterrior color"] || row["exterior color"])?.trim() || null;
    const heatedSeatsRaw = (row["heated_seats"] || "").trim().toLowerCase();
    const heated_seats = heatedSeatsRaw === "true" || heatedSeatsRaw === "yes" ? true : heatedSeatsRaw === "false" || heatedSeatsRaw === "no" ? false : null;
    const heatPumpRaw = (row["heat_pump"] || "").trim().toLowerCase();
    const heat_pump = heatPumpRaw === "true" || heatPumpRaw === "yes" ? true : heatPumpRaw === "false" || heatPumpRaw === "no" ? false : null;
    const towHitchRaw = (row["tow_hitch"] || "").trim().toLowerCase();
    const tow_hitch = towHitchRaw === "true" || towHitchRaw === "yes" ? true : towHitchRaw === "false" || towHitchRaw === "no" ? false : null;
    const climateZoneRaw = row["climate_zone"]?.trim().toLowerCase() || null;
    const climate_zone = (["hot", "cold", "temperate", "humid"].includes(climateZoneRaw ?? "") ? climateZoneRaw : null) as "hot" | "cold" | "temperate" | "humid" | null;
    const warranty_remaining_months = row["warranty_remaining_months"] ? parseInt(row["warranty_remaining_months"]) : null;
    const superchargerRaw = (row["supercharger_access"] || "").trim().toLowerCase();
    const supercharger_access = superchargerRaw === "true" || superchargerRaw === "yes" ? true : superchargerRaw === "false" || superchargerRaw === "no" ? false : null;
    const otaRaw = (row["ota_capable"] || "").trim().toLowerCase();
    const ota_capable = otaRaw === "true" || otaRaw === "yes" ? true : otaRaw === "false" || otaRaw === "no" ? false : null;

    // ── v4b fields (physical specs from CSV download) ──
    const drivetrain = row["drivetrain"]?.trim().toUpperCase() || null;
    // Accept both "interior_color" and "interior color"
    const interior_color = (row["interior_color"] || row["interior color"])?.trim() || null;
    const doors = row["doors"] ? parseInt(row["doors"]) : null;
    const front_legroom_in = row["front legroom"] ? parseFloat(row["front legroom"].replace(/[^0-9.]/g, "")) : null;
    const rear_legroom_in = row["back legroom"] ? parseFloat(row["back legroom"].replace(/[^0-9.]/g, "")) : null;
    const cargo_volume_cuft = row["cargo volume"] ? parseFloat(row["cargo volume"].replace(/[^0-9.]/g, "")) : null;
    const charge_time_notes = (row["battery charge time"] || row["charge_time_notes"])?.trim() || null;
    const additional_notes = (row["additional"] || row["additional_notes"])?.trim() || null;
    // v4c fields
    const body_type = (row["body type"] || row["body_type"])?.trim() || null;
    const towing_capacity_lbs = (row["towing capacity"] || row["towing_capacity_lbs"]) ? parseInt((row["towing capacity"] || row["towing_capacity_lbs"]).replace(/[^0-9]/g, "")) : null;

    const riskFlagsRaw = row["risk_flags"]?.trim();
    const vehicleLabel = row["vehicle_label"]?.trim() || [year, make, model, trim].filter(Boolean).join(" ") || null;
    let photoUrl = row["photo_url"]?.trim() || null;

    // Normalize Windows absolute paths → web-relative paths
    // e.g. "C:\Dev\ev-risk\public\vehicles\foo.webp" → "/vehicles/foo.webp"
    if (photoUrl && (photoUrl.includes("\\") || /^[A-Za-z]:\//.test(photoUrl))) {
      const normalized = photoUrl.replace(/\\/g, "/");
      const publicIdx = normalized.indexOf("/public/");
      if (publicIdx !== -1) {
        photoUrl = normalized.slice(publicIdx + "/public".length);
      }
    }
    // Normalize bare relative paths → root-relative paths
    // e.g. "vehicles/foo.jpg" → "/vehicles/foo.jpg"
    if (photoUrl && !photoUrl.startsWith("/") && !photoUrl.startsWith("http")) {
      photoUrl = "/" + photoUrl;
    }

    // For /vehicles/ paths: verify file exists; if not, try alternate extensions
    // Handles missing extensions (e.g. "/vehicles/foo" → "/vehicles/foo.webp")
    // and wrong extensions (e.g. "/vehicles/foo.jpg" when file is actually foo.webp)
    if (photoUrl?.startsWith("/vehicles/")) {
      const publicDir = join(process.cwd(), "public");
      const fullPath = join(publicDir, photoUrl);
      if (!existsSync(fullPath)) {
        // Strip extension (if any) and try alternates
        const base = photoUrl.replace(/\.\w{2,5}$/, "");
        for (const ext of [".webp", ".jpg", ".jpeg", ".png"]) {
          const candidate = join(publicDir, base + ext);
          if (existsSync(candidate)) {
            photoUrl = base + ext;
            break;
          }
        }
      }
    }

    const urlDomain = row["url_domain"]?.trim() || (() => {
      try { return new URL(listingUrl).hostname.replace("www.", ""); } catch { return null; }
    })();

    // Resolve photo: local CSV → static map → make fallback (all sync, no HTTP)
    // Local vehicle-images.csv always wins — it's the curated source of truth
    if (make) {
      const localOverride = model ? lookupLocalImages(make, model, year ?? undefined) : { matched: false, urls: [] };
      if (localOverride.matched && localOverride.urls.length > 0) {
        photoUrl = proxyIfWikimedia(localOverride.urls[0]);
      } else if (!photoUrl) {
        photoUrl = resolvePhotoSync(make, model, year);
      }
    }

    // Compute scores from structured fields — no AI call needed for basic signals.
    // If any structured fields are provided, use them; otherwise fall back to null scores
    // (AI rescore triggered at end of import will fill these in).
    const hasStructuredData = vin || title_status || battery_report || service_records;
    let computedVerdict = (verdictRaw || null) as "GREEN" | "YELLOW" | "RED" | null;
    let computedRiskFlags: string[] | null = riskFlagsRaw
      ? riskFlagsRaw.split(";").map((f) => f.trim()).filter(Boolean).slice(0, 3)
      : null;
    let evidenceScore: number | null = null;
    let fitScore: number | null = null;
    let riskPoints: number | null = null;
    let dealQualityScore = computeDealQualityScore(null, null, null);

    if (hasStructuredData) {
      const signals = signalsFromStructuredData({ vin, title_status, battery_report, service_records });
      const scoring = scoreReceipt(signals);
      evidenceScore = scoring.evidence_score;
      fitScore = scoring.fit_score;
      riskPoints = Math.max(0, Math.round((100 - scoring.fit_score) / 10));
      dealQualityScore = computeDealQualityScore(evidenceScore, riskPoints, fitScore);
      // Override verdict from scoring unless manually set in CSV
      if (!verdictRaw) computedVerdict = scoring.verdict;
      // Override risk flags from scoring unless manually set in CSV
      if (!computedRiskFlags) {
        computedRiskFlags = scoring.scoring_reasons
          .filter((r: { points: number }) => r.points <= 0)
          .sort((a: { points: number }, b: { points: number }) => Math.abs(b.points) - Math.abs(a.points))
          .slice(0, 3)
          .map((r: { label: string }) => r.label);
      }
    }

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
        vin,
        title_status,
        battery_report,
        service_records,
        verdict: computedVerdict ?? "YELLOW",
        evidence_score: evidenceScore,
        fit_score: fitScore,
        risk_points: riskPoints,
        deal_quality_score: dealQualityScore,
        risk_flags: computedRiskFlags,
        photo_url: photoUrl,
        receipt_id: null,
        last_analyzed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        is_active: true,
        // v4 fields
        ...(dcfc_kw_max !== null && { dcfc_kw_max }),
        ...(ac_charger_kw !== null && { ac_charger_kw }),
        ...(charge_port_type && { charge_port_type }),
        ...(epa_range_mi !== null && { epa_range_mi }),
        ...(estimated_real_range_mi !== null && { estimated_real_range_mi }),
        ...(seller_type && { seller_type }),
        ...(days_on_market !== null && { days_on_market }),
        ...(exterior_color && { exterior_color }),
        ...(heated_seats !== null && { heated_seats }),
        ...(heat_pump !== null && { heat_pump }),
        ...(tow_hitch !== null && { tow_hitch }),
        ...(climate_zone && { climate_zone }),
        ...(warranty_remaining_months !== null && { warranty_remaining_months }),
        ...(supercharger_access !== null && { supercharger_access }),
        ...(ota_capable !== null && { ota_capable }),
        // v4b fields
        ...(drivetrain && { drivetrain }),
        ...(interior_color && { interior_color }),
        ...(doors !== null && { doors }),
        ...(front_legroom_in !== null && { front_legroom_in }),
        ...(rear_legroom_in !== null && { rear_legroom_in }),
        ...(cargo_volume_cuft !== null && { cargo_volume_cuft }),
        ...(charge_time_notes && { charge_time_notes }),
        ...(additional_notes && { additional_notes }),
        // v4c fields
        ...(body_type && { body_type }),
        ...(towing_capacity_lbs !== null && { towing_capacity_lbs }),
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

  // Auto-rescore newly imported rows with AI — fire-and-forget
  // Scoped to today so we don't re-score the full database on every import.
  const today = new Date().toISOString().slice(0, 10);
  fetch(`${baseUrl}/api/admin/deals-rescore-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ since: today }),
  }).catch((err) => {
    console.warn("[deals-import] auto-rescore trigger failed:", err instanceof Error ? err.message : err);
  });

  return NextResponse.json({
    success: true,
    imported: results.imported,
    skipped: results.skipped,
    deactivated: results.deactivated,
    rescore_started: true,
    errors: results.errors.slice(0, 20),
    total_rows: rows.length,
  });
}
