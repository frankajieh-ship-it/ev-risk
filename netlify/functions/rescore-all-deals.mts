/**
 * Netlify Background Function: Rescore All Curated Deals
 *
 * POST /.netlify/functions/rescore-all-deals
 *
 * Re-scores every curated_deal using DB-stored fields (year/make/model/trim/price/mileage/location)
 * WITHOUT re-scraping listing pages. CarGurus/AutoTrader block scrapers — re-scraping would fail.
 * The structured data already in the row is sufficient for the AI prompt.
 *
 * Also deletes blank rows (no make, no vehicle_label) before scoring.
 *
 * Runs as a Netlify Background Function (up to 15 minutes, 202 fires immediately).
 * Triggered by POST /api/admin/deals-rescore-all.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

/// <reference types="node" />
import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { scoreWithAi, inferSignalsFromListing } from "../../lib/deals-score.js";
import { scoreReceiptV2 } from "../../lib/receipt-scoring-v2.js";
import { computeDealQualityScore } from "../../lib/deal-quality-score.js";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const handler: Handler = async (event: HandlerEvent) => {
  const auth = event.headers?.["authorization"] || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  // Optional date filter — "YYYY-MM-DD" — only rescore rows from that day
  let since: string | undefined;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    if (typeof body?.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.since)) {
      since = body.since;
    }
  } catch { /* ignore parse errors */ }

  const supabase = getSupabase();
  if (!supabase) return { statusCode: 503, body: "DB not configured" };

  let deleted = 0;
  // Only purge blank rows on a full rescore, not a date-scoped one
  if (!since) {
    const { count } = await supabase
      .from("curated_deals")
      .delete({ count: "exact" })
      .or("make.is.null,vehicle_label.is.null");
    deleted = count ?? 0;
    console.log(`[rescore-all-deals] deleted ${deleted} blank rows`);
  }

  // Fetch rows — optionally scoped to a single calendar day (UTC)
  let query = supabase
    .from("curated_deals")
    .select("id, listing_url, make, model, year, trim, price, mileage, location")
    .not("make", "is", null)
    .order("created_at", { ascending: true });

  if (since) {
    const dayStart = `${since}T00:00:00.000Z`;
    const nextDay = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", dayStart).lt("created_at", nextDay);
    console.log(`[rescore-all-deals] scoped to ${since}`);
  }

  const { data: rows, error: fetchErr } = await query;

  if (fetchErr || !rows) {
    console.error("[rescore-all-deals] fetch error:", fetchErr?.message);
    return { statusCode: 500, body: fetchErr?.message ?? "Fetch failed" };
  }

  console.log(`[rescore-all-deals] rescoring ${rows.length} deals${since ? ` from ${since}` : ""} (DB fields only)`);

  let rescored = 0, failed = 0;

  for (const row of rows) {
    try {
      // Build ScrapedListing from DB-stored fields — no network request needed
      const d = {
        year: row.year as number | undefined,
        make: row.make as string | undefined,
        model: row.model as string | undefined,
        trim: row.trim as string | undefined,
        price: row.price as number | undefined,
        mileage: row.mileage as number | undefined,
        location: row.location as string | undefined,
      };

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

      const { error: updateErr } = await supabase
        .from("curated_deals")
        .update({
          verdict: scoring.verdict,
          evidence_score: scoring.evidence_score,
          fit_score: scoring.fit_score,
          risk_points: scoring.risk_points,
          deal_quality_score: dealQualityScore,
          risk_flags: riskFlags.length > 0 ? riskFlags : null,
          is_active: true,
          last_analyzed_at: new Date().toISOString(),
        })
        .eq("id", row.id as string);

      if (updateErr) {
        console.error(`[rescore-all-deals] update failed for ${row.id}:`, updateErr.message);
        failed++;
      } else {
        console.log(`[rescore-all-deals] ✓ ${row.id} → ${scoring.verdict} (${aiResult.source})`);
        rescored++;
      }
    } catch (err) {
      console.error(`[rescore-all-deals] error on ${row.id}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`[rescore-all-deals] done — rescored: ${rescored}, failed: ${failed}, deleted: ${deleted}`);
  return {
    statusCode: 200,
    body: JSON.stringify({ rescored, failed, deleted, total: rows.length }),
  };
};

export { handler };
