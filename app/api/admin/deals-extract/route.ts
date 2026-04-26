/**
 * POST /api/admin/deals-extract
 *
 * Two-pass enrichment for curated_deals rows:
 *
 * Pass 1 — Scrape (for rows without a VIN):
 *   Fetches each listing page via ScrapingBee/proxy to extract the VIN,
 *   title_status, and raw listing text. Infers battery_report / service_records
 *   from the raw text. Skips rows that already have a VIN.
 *
 * Pass 2 — VIN lookup (for all rows that now have a VIN):
 *   Calls VinAudit liteCheck to get salvage/theft/accident history.
 *   Calls NHTSA decodeVin for fuel type, year/make/model.
 *   Calls NHTSA recalls API for open recall count.
 *   Stores vin_audit_summary (JSONB) and extracted_signals (TEXT[]) for use in rescore.
 *
 * Accepts optional `since` (ISO date "YYYY-MM-DD") to limit to rows
 * created on that date.
 *
 * Fire-and-forget — returns 200 immediately. Progress logged to console.
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { extractVehicleData } from "@/lib/listing-scraper";
import { liteCheck } from "@/lib/vinaudit-client";
import { validateVin, decodeVin } from "@/lib/vin-service";

export const maxDuration = 60;

/** Call NHTSA recalls API — returns recall count, or -1 on error */
async function checkNhtsaRecalls(year: number, make: string, model: string): Promise<number> {
  try {
    const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return -1;
    const data = await res.json() as { Count?: number; results?: unknown[] };
    return data.Count ?? data.results?.length ?? -1;
  } catch { return -1; }
}

const ADMIN_KEY = process.env.ADMIN_API_KEY;

/** Infer battery_report from listing raw_text */
function inferBatteryReport(rawText: string | undefined): "yes" | "no" | null {
  if (!rawText) return null;
  const t = rawText.toLowerCase();
  if (
    t.includes("battery health report") ||
    t.includes("battery report") ||
    t.includes("battery health certificate") ||
    t.includes("battery test") ||
    t.includes("battery condition report") ||
    t.includes("soh ") ||
    t.includes("state of health") ||
    t.includes("battery warranty") ||
    t.includes("battery health:") ||
    t.includes("battery health -")
  ) return "yes";
  if (
    t.includes("no battery report") ||
    t.includes("battery not tested") ||
    t.includes("battery health unknown") ||
    t.includes("no battery history")
  ) return "no";
  return null;
}

/** Infer service_records from listing raw_text */
function inferServiceRecords(rawText: string | undefined): "yes" | "no" | null {
  if (!rawText) return null;
  const t = rawText.toLowerCase();
  if (
    t.includes("service records") ||
    t.includes("service history") ||
    t.includes("maintenance records") ||
    t.includes("maintenance history") ||
    t.includes("full service history") ||
    t.includes("carfax report") ||
    t.includes("autocheck report")
  ) return "yes";
  if (
    t.includes("no service records") ||
    t.includes("no maintenance records") ||
    t.includes("no records") ||
    t.includes("service history unknown") ||
    t.includes("no history")
  ) return "no";
  return null;
}

async function runExtract(since?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("DB not configured");

  let query = supabase
    .from("curated_deals")
    .select("id, listing_url, vehicle_label, vin, make, model, year")
    .eq("is_active", true)
    .not("listing_url", "is", null)
    .order("created_at", { ascending: true });

  if (since) {
    const dayStart = `${since}T00:00:00.000Z`;
    const nextDay = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", dayStart).lt("created_at", nextDay);
    console.log(`[deals-extract] filtering to rows created ${since}`);
  }

  const { data: rows, error: fetchErr } = await query;
  if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);
  if (!rows?.length) {
    console.log("[deals-extract] No rows to extract");
    return { scraped: 0, vin_enriched: 0, failed: 0, sold: 0, total: 0 };
  }

  console.log(`[deals-extract] Processing ${rows.length} listings`);
  let scraped = 0, vinEnriched = 0, failed = 0, sold = 0;

  // ── Pass 1: Scrape rows that don't have a VIN yet ──────────────────────────
  for (const row of rows) {
    const existingVin = (row.vin as string | null)?.trim();
    if (existingVin && validateVin(existingVin)) {
      console.log(`[deals-extract] Skipping scrape (VIN already present): ${row.vehicle_label}`);
      continue;
    }

    try {
      console.log(`[deals-extract] Scraping: ${row.vehicle_label ?? row.listing_url}`);
      const result = await extractVehicleData(row.listing_url as string, { adminKey: ADMIN_KEY ?? undefined });

      if (!result.success && result.diagnostics?.failureReason === "listing_sold") {
        console.log(`[deals-extract] Deactivating sold listing: ${row.vehicle_label}`);
        await supabase.from("curated_deals").update({ is_active: false }).eq("id", row.id as string);
        sold++;
        continue;
      }

      if (!result.success || !result.data) {
        console.warn(`[deals-extract] Scrape failed for ${row.listing_url}: ${result.error} (${result.diagnostics?.failureReason})`);
        failed++;
        continue;
      }

      const d = result.data;
      const inferredBattery = inferBatteryReport(d.raw_text);
      const inferredService = inferServiceRecords(d.raw_text);

      const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
      if (d.year) update.year = d.year;
      if (d.make) update.make = d.make;
      if (d.model) update.model = d.model;
      if (d.trim) update.trim = d.trim;
      if (d.price) update.price = d.price;
      if (d.mileage) update.mileage = d.mileage;
      if (d.location) update.location = d.location;
      if (d.vin) {
        update.vin = d.vin;
        // Update the in-memory row.vin so Pass 2 can use it
        (row as Record<string, unknown>).vin = d.vin;
      }
      if (d.title_status && d.title_status !== "unknown") update.title_status = d.title_status;
      if (inferredBattery) update.battery_report = inferredBattery;
      if (inferredService) update.service_records = inferredService;
      if (!row.vehicle_label && d.year && d.make && d.model) {
        update.vehicle_label = [d.year, d.make, d.model, d.trim].filter(Boolean).join(" ");
      }

      const { error: updateErr } = await supabase.from("curated_deals").update(update).eq("id", row.id as string);
      if (updateErr) {
        console.error(`[deals-extract] Update failed for ${row.id}:`, updateErr.message);
        failed++;
      } else {
        const fields = Object.keys(update).filter((k) => k !== "last_seen_at");
        console.log(`[deals-extract] ✓ Scraped ${row.vehicle_label ?? row.id} → ${fields.join(", ")}`);
        scraped++;
      }
    } catch (err) {
      console.error(`[deals-extract] Scrape error on ${row.listing_url}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  // ── Pass 2: VIN lookup for all rows that have a VIN ───────────────────────
  for (const row of rows) {
    const rawVin = (row.vin as string | null)?.trim();
    if (!rawVin) continue;

    const cleanVin = validateVin(rawVin);
    if (!cleanVin) {
      console.warn(`[deals-extract] Invalid VIN format for ${row.vehicle_label}: ${rawVin}`);
      continue;
    }

    try {
      console.log(`[deals-extract] VIN lookup: ${cleanVin} (${row.vehicle_label})`);
      const update: Record<string, unknown> = {};
      const extractedSignals: string[] = [];

      // Always mark VIN as decoded
      extractedSignals.push("vin_decoded");

      // VinAudit lite check — title status, salvage/theft, accident/sale counts
      const vaResult = await liteCheck(cleanVin);
      if (vaResult.success) {
        const isSalvage = vaResult.summary.salvage_reported || vaResult.summary.theft_reported;
        update.title_status = isSalvage ? "salvage" : "clean";
        update.vin_audit_summary = {
          salvage: vaResult.summary.salvage_reported,
          theft: vaResult.summary.theft_reported,
          accident_count: vaResult.summary.accident_count,
          sale_count: vaResult.summary.sale_count,
        };
        if (isSalvage) {
          extractedSignals.push("title_salvage");
        } else {
          extractedSignals.push("clean_title_explicit");
        }
        if (vaResult.summary.accident_count > 0) {
          extractedSignals.push("prior_damage_minor");
        }
        if (vaResult.summary.sale_count >= 3) {
          extractedSignals.push("ownership_turnover_high");
        } else if (!isSalvage) {
          extractedSignals.push("ownership_history_clear");
        }
        console.log(`[deals-extract] VinAudit ${cleanVin}: salvage=${vaResult.summary.salvage_reported}, accidents=${vaResult.summary.accident_count}, sales=${vaResult.summary.sale_count}`);
      } else {
        console.warn(`[deals-extract] VinAudit failed for ${cleanVin}: ${vaResult.error}`);
      }

      // NHTSA decode — fill in any missing year/make/model/trim; check fuel type
      const nhtsaResult = await decodeVin(cleanVin, {
        year: (row.year as number | null) ?? undefined,
        make: (row.make as string | null) ?? undefined,
        model: (row.model as string | null) ?? undefined,
      });
      if (nhtsaResult.success) {
        if (!row.year && nhtsaResult.decoded.year) update.year = nhtsaResult.decoded.year;
        if (!row.make && nhtsaResult.decoded.make) update.make = nhtsaResult.decoded.make;
        if (!row.model && nhtsaResult.decoded.model) update.model = nhtsaResult.decoded.model;
        if (nhtsaResult.decoded.fuel_type?.toLowerCase().includes("electric")) {
          extractedSignals.push("dcfc_confirmed");
        }
      }

      // Battery health estimate — possible for any EV with year + mileage
      const resolvedYear = (update.year ?? row.year) as number | null;
      const resolvedMake = (update.make ?? row.make) as string | null;
      const resolvedModel = (update.model ?? row.model) as string | null;
      if (resolvedYear && (row as Record<string, unknown>).mileage) {
        extractedSignals.push("battery_health_estimated");
      }

      // NHTSA recall check
      if (resolvedYear && resolvedMake && resolvedModel) {
        const recallCount = await checkNhtsaRecalls(resolvedYear, resolvedMake, resolvedModel);
        if (recallCount === 0) {
          extractedSignals.push("recall_status_clear");
        }
      }

      update.extracted_signals = extractedSignals;

      const { error: updateErr } = await supabase.from("curated_deals").update(update).eq("id", row.id as string);
      if (updateErr) {
        console.error(`[deals-extract] VIN update failed for ${row.id}:`, updateErr.message);
        failed++;
      } else {
        console.log(`[deals-extract] ✓ VIN enriched ${row.vehicle_label}: signals=[${extractedSignals.join(", ")}]`);
        vinEnriched++;
      }
    } catch (err) {
      console.error(`[deals-extract] VIN lookup error for ${rawVin}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`[deals-extract] Done — scraped: ${scraped}, VIN enriched: ${vinEnriched}, sold: ${sold}, failed: ${failed}`);
  return { scraped, vin_enriched: vinEnriched, failed, sold, total: rows.length };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let since: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.since)) {
      since = body.since;
    }
  } catch { /* no body is fine */ }

  runExtract(since).catch((err) => {
    console.error("[deals-extract] failed:", err instanceof Error ? err.message : err);
  });

  return NextResponse.json({
    ok: true,
    message: since
      ? `Extraction started for ${since} — refresh in ~15s per listing`
      : "Extraction started — refresh table in a couple of minutes",
  });
}
