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
// since: optional ISO date string "YYYY-MM-DD" — only rescore rows created on/after that date
export async function runRescore(since?: string) {
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

  let deleted = 0;
  // Only delete blank rows when doing a full rescore, not a date-filtered one
  if (!since) {
    const { count } = await supabase
      .from("curated_deals")
      .delete({ count: "exact" })
      .or("make.is.null,vehicle_label.is.null");
    deleted = count ?? 0;
    console.log(`[rescore-all] deleted ${deleted} blank rows`);
  }

  // Fetch rows — filter by created_at when since is provided
  let query = supabase
    .from("curated_deals")
    .select("id, listing_url, make, model, year, trim, price, mileage, location")
    .not("make", "is", null)
    .order("created_at", { ascending: true });

  if (since) {
    // since = "2026-04-26" → rows created on that calendar day (UTC)
    const dayStart = `${since}T00:00:00.000Z`;
    const nextDay = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", dayStart).lt("created_at", nextDay);
    console.log(`[rescore-all] filtering to rows created ${since} (${dayStart} – ${nextDay})`);
  }

  const { data: rows, error: fetchErr } = await query;
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

  return { rescored, failed, deleted, total: rows?.length ?? 0 };
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

  // Fire-and-forget in both dev and prod — return 200 immediately, work runs async.
  // In dev, Next.js kills long-running route handlers (no true background support),
  // so we kick off the promise without awaiting and let the UI poll for results.
  runRescore(since).then((result) => {
    const msg = since
      ? `[rescore-all] ✓ ${result.rescored} deals from ${since} (${result.failed} failed)`
      : `[rescore-all] ✓ ${result.rescored} deals, deleted ${result.deleted} blank rows (${result.failed} failed)`;
    console.log(msg);
  }).catch((err) => {
    console.error("[rescore-all] failed:", err instanceof Error ? err.message : err);
  });

  if (process.env.NODE_ENV === "development") {
    return NextResponse.json({
      ok: true,
      message: since
        ? `Rescore started for ${since} — check server logs + refresh table in ~30s per deal`
        : "Rescore started — check server logs + refresh table in ~30s per deal",
    });
  }

  // Production: fire background function and return immediately
  const siteUrl = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const fnUrl = `${siteUrl}/.netlify/functions/rescore-all-deals`;

  fetch(fnUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ since }),
  }).catch((err) => {
    console.error("[deals-rescore-all] failed to trigger background function:", err.message);
  });

  return NextResponse.json({
    ok: true,
    message: since
      ? `Rescore job started for ${since} — check Netlify logs for progress.`
      : "Rescore job started in background — check Netlify logs for progress.",
  });
}
