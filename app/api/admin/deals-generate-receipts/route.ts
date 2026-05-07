/**
 * POST /api/admin/deals-generate-receipts
 *
 * Batch-generates lite receipts for curated deals that have receipt_id = null.
 * Calls the receipt pipeline directly (no HTTP self-call) to avoid Netlify
 * serverless networking issues. Processes the cheapest N active deals first.
 *
 * Query params:
 *   ?batch=N  — number of deals to process per run (default 10, max 20)
 *
 * Returns { generated, skipped, failed, total, errors } inline.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { buildEnhancedFallbackReceipt } from "@/lib/receipt-openai";
import { extractSignalsFromText } from "@/lib/receipt-signal-extractor";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import type { ReceiptGenerateRequest } from "@/types/receipt";

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
  const batch = Math.min(20, Math.max(1, parseInt(searchParams.get("batch") || "10", 10)));

  // Fetch cheapest active deals with no receipt yet
  const { data: rows, error } = await supabase
    .from("curated_deals")
    .select("id, listing_url, make, model, year, trim, price, mileage, location, vin")
    .is("receipt_id", null)
    .eq("is_active", true)
    .not("listing_url", "is", null)
    .not("make", "is", null)
    .order("price", { ascending: true, nullsFirst: false })
    .limit(batch);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ generated: 0, skipped: 0, failed: 0, total: 0, errors: [] });

  let generated = 0, failed = 0;
  const skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const receiptToken = `rt_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").substring(0, 24)}`;

      const input: ReceiptGenerateRequest = {
        listing_url: row.listing_url || null,
        listing_text: null,
        year: row.year ?? undefined,
        make: row.make ?? undefined,
        model: row.model ?? undefined,
        trim: row.trim ?? undefined,
        mileage: row.mileage ?? undefined,
        price: row.price ?? undefined,
        vin: row.vin ?? undefined,
        location: row.location ?? undefined,
        region: "US",
        mode: "single",
        receipt_token: receiptToken,
      };

      // Build lite receipt directly — no HTTP call, no AI, ~500ms
      const classification = classifyVehicle(input.make || "", input.model || "", input.trim, null);
      const signals = extractSignalsFromText(
        null,
        {
          vin: input.vin,
          mileage: input.mileage,
          year: input.year,
          title_status: undefined,
          service_history: undefined,
          accidents_reported: undefined,
          owners: undefined,
          carfax_available: undefined,
        },
        classification
      );
      const scoring = scoreReceipt(signals);
      const liteReceipt = buildEnhancedFallbackReceipt(input, signals, scoring);

      const urlDomain = row.listing_url
        ? (() => { try { return new URL(row.listing_url).hostname.replace("www.", ""); } catch { return null; } })()
        : null;

      const { error: insertErr } = await supabase.from("receipts").insert({
        id: liteReceipt.receipt_id,
        session_id: receiptToken,
        user_id: null,
        source: "deal_watch",
        page_source: "deal_watch_batch",
        listing_url: row.listing_url || null,
        url_domain: urlDomain,
        listing_text: null,
        input_json: input,
        output_json: liteReceipt,
        mode: "single",
        is_pro: false,
        generation_status: "lite",
      });

      if (insertErr) {
        console.warn(`[deals-generate-receipts] DB insert failed for ${row.listing_url}:`, insertErr.message);
        errors.push(`${row.listing_url}: insert error — ${insertErr.message}`);
        failed++;
        continue;
      }

      const receiptVerdict = liteReceipt.verdict;
      const { error: updateErr } = await supabase
        .from("curated_deals")
        .update({
          receipt_id: liteReceipt.receipt_id,
          ...(receiptVerdict ? { verdict: receiptVerdict } : {}),
        })
        .eq("id", row.id);

      if (updateErr) {
        console.warn(`[deals-generate-receipts] Failed to link receipt for deal ${row.id}:`, updateErr.message);
        errors.push(`${row.listing_url}: link error — ${updateErr.message}`);
        failed++;
      } else {
        console.log(`[deals-generate-receipts] Linked receipt ${liteReceipt.receipt_id} → deal ${row.id} (${receiptVerdict})`);
        generated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[deals-generate-receipts] Error for ${row.listing_url}:`, msg);
      errors.push(`${row.listing_url}: ${msg}`);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    generated,
    skipped,
    failed,
    total: rows.length,
    errors: errors.slice(0, 3),
  });
}
