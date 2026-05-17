/**
 * POST /api/admin/deals-rescore
 *
 * Re-scores all active curated deals using the same deterministic pipeline
 * as deals-generate-receipts (no AI, no HTTP). Writes verdict back to
 * curated_deals.verdict and updates last_analyzed_at.
 *
 * Query params:
 *   ?batch=N   — deals per run (default 50, max 100)
 *   ?qa=true   — dry-run: compare old vs new verdict without writing to DB
 *
 * Returns:
 *   Normal: { ok, rescored, changed, unchanged, failed, total, sample }
 *   QA:     { ok, total, diffs: [{ id, label, old_verdict, new_verdict, changed }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { extractSignalsFromText } from "@/lib/receipt-signal-extractor";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { classifyVehicle } from "@/lib/vehicle-classifier";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const batch = Math.min(100, Math.max(1, parseInt(searchParams.get("batch") || "50", 10)));
  const qa = searchParams.get("qa") === "true";

  const { data: rows, error } = await supabase
    .from("curated_deals")
    .select("id, listing_url, vehicle_label, make, model, year, trim, price, mileage, location, vin, verdict, receipt_id, title_status, battery_report, service_records, extracted_signals")
    .eq("is_active", true)
    .not("listing_url", "is", null)
    .not("make", "is", null)
    .order("created_at", { ascending: false })
    .limit(batch);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ ok: true, rescored: 0, changed: 0, unchanged: 0, failed: 0, total: 0 });

  let rescored = 0, changed = 0, unchanged = 0, failed = 0;
  const diffs: { id: string; label: string; old_verdict: string | null; new_verdict: string; changed: boolean }[] = [];
  const sample: { id: string; label: string; verdict: string }[] = [];

  for (const row of rows) {
    try {
      const classification = classifyVehicle(row.make ?? "", row.model ?? "", row.trim ?? null, null);
      const structuredSignals = extractSignalsFromText(
        null,
        {
          vin: row.vin ?? undefined,
          mileage: row.mileage ?? undefined,
          year: row.year ?? undefined,
          title_status: (row.title_status as string | undefined) ?? undefined,
          service_history: row.service_records === "yes" ? "yes" : row.service_records === "no" ? "no" : undefined,
          accidents_reported: undefined,
          owners: undefined,
          carfax_available: undefined,
        },
        classification
      );
      // Merge in any previously extracted signals from the AI extraction pass
      const storedSignals: string[] = Array.isArray(row.extracted_signals) ? row.extracted_signals : [];
      const mergedSet = new Set([...structuredSignals, ...storedSignals]);
      const signals = Array.from(mergedSet);
      const scoring = scoreReceipt(signals);
      const newVerdict = scoring.verdict;
      const oldVerdict = row.verdict ?? null;
      const verdictChanged = oldVerdict !== newVerdict;

      if (qa) {
        diffs.push({
          id: row.id,
          label: row.vehicle_label ?? `${row.year} ${row.make} ${row.model}`,
          old_verdict: oldVerdict,
          new_verdict: newVerdict,
          changed: verdictChanged,
        });
      } else {
        const { error: updateErr } = await supabase
          .from("curated_deals")
          .update({
            verdict: newVerdict,
            last_analyzed_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updateErr) {
          failed++;
        } else {
          rescored++;
          if (verdictChanged) changed++;
          else unchanged++;
          if (sample.length < 5) {
            sample.push({ id: row.id, label: row.vehicle_label ?? `${row.year} ${row.make} ${row.model}`, verdict: newVerdict });
          }
        }
      }
    } catch {
      failed++;
    }
  }

  if (qa) {
    return NextResponse.json({ ok: true, total: rows.length, diffs });
  }

  return NextResponse.json({ ok: true, rescored, changed, unchanged, failed, total: rows.length, sample });
}
