/**
 * POST /api/admin/deals-rescore-all
 *
 * Re-scores every curated_deal using DB-stored fields (no re-scrape).
 * Builds the AI prompt from year/make/model/trim/price/mileage/location already
 * in the row — avoids bot-protected scrape failures on CarGurus/AutoTrader.
 *
 * Also deletes blank rows (no make, no vehicle_label, no price) before scoring.
 *
 * In prod: fires rescore-all-deals Netlify Background Function, returns immediately.
 * In dev (next dev): runs inline synchronously, returns when done.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 min — enough for ~60 deals at 5s each in dev

const ADMIN_KEY = process.env.ADMIN_API_KEY;

// Shared rescore logic — used by both dev inline path and background function
export async function runRescore() {
  const [
    { scoreWithAi, inferSignalsFromListing },
    { scoreReceiptV2 },
    { computeDealQualityScore },
    { getSupabaseAdmin },
  ] = await Promise.all([
    import("@/lib/deals-score"),
    import("@/lib/receipt-scoring-v2"),
    import("@/lib/deal-quality-score"),
    import("@/lib/api-auth"),
  ]);

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("DB not configured");

  // Delete blank rows (no make AND no vehicle_label — nothing usable)
  // Use OR: delete if make is null OR vehicle_label is null
  const { count: deleted } = await supabase
    .from("curated_deals")
    .delete({ count: "exact" })
    .or("make.is.null,vehicle_label.is.null");

  console.log(`[rescore-all] deleted ${deleted ?? 0} blank rows`);

  // Fetch all rows that have at least make+model to work with
  const { data: rows, error: fetchErr } = await supabase
    .from("curated_deals")
    .select("id, listing_url, make, model, year, trim, price, mileage, location")
    .not("make", "is", null)
    .order("created_at", { ascending: true });

  if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);

  let rescored = 0, failed = 0;

  for (const row of rows ?? []) {
    try {
      // Build a ScrapedListing from DB-stored fields — NO re-scraping
      const d = {
        year: row.year as number | undefined,
        make: row.make as string | undefined,
        model: row.model as string | undefined,
        trim: row.trim as string | undefined,
        price: row.price as number | undefined,
        mileage: row.mileage as number | undefined,
        location: row.location as string | undefined,
        // No raw_text — AI will work from structured fields only
      };

      // AI scoring (falls back to deterministic if AI fails)
      const aiResult = await scoreWithAi(row.listing_url as string | undefined, d);
      const signals = aiResult.signals.length > 0 ? aiResult.signals : inferSignalsFromListing(d);
      const scoring = scoreReceiptV2(signals);
      const dealQualityScore = computeDealQualityScore(
        scoring.evidence_score, scoring.risk_points, scoring.fit_score
      );
      const riskFlags = aiResult.riskFlags.length > 0
        ? aiResult.riskFlags
        : scoring.scoring_reasons
            .filter((r) => r.points <= 0)
            .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
            .slice(0, 3)
            .map((r) => r.label);

      const { error: updateErr } = await supabase.from("curated_deals").update({
        verdict: scoring.verdict,
        evidence_score: scoring.evidence_score,
        fit_score: scoring.fit_score,
        risk_points: scoring.risk_points,
        deal_quality_score: dealQualityScore,
        risk_flags: riskFlags.length > 0 ? riskFlags : null,
        is_active: true,
        last_analyzed_at: new Date().toISOString(),
      }).eq("id", row.id as string);

      if (updateErr) {
        console.error(`[rescore-all] update failed for ${row.id}:`, updateErr.message);
        failed++;
      } else {
        console.log(`[rescore-all] ✓ ${row.id} → ${scoring.verdict} (${aiResult.source})`);
        rescored++;
      }
    } catch (err) {
      console.error(`[rescore-all] error on ${row.id}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  return { rescored, failed, deleted: deleted ?? 0, total: rows?.length ?? 0 };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    try {
      const result = await runRescore();
      return NextResponse.json({
        ok: true,
        message: `Rescored ${result.rescored} deals, deleted ${result.deleted} blank rows (${result.failed} failed)`,
        ...result,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Rescore failed" },
        { status: 500 }
      );
    }
  }

  // Production: fire background function and return immediately
  const siteUrl = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const fnUrl = `${siteUrl}/.netlify/functions/rescore-all-deals`;

  fetch(fnUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_KEY}`, "Content-Type": "application/json" },
  }).catch((err) => {
    console.error("[deals-rescore-all] failed to trigger background function:", err.message);
  });

  return NextResponse.json({
    ok: true,
    message: "Rescore job started in background — check Netlify logs for progress.",
  });
}
