/**
 * Rescore all curated_deals using AI (no re-scraping).
 *
 * Run from the ev-risk project root:
 *   npx tsx scripts/rescore-all-deals.ts
 *
 * Uses DB-stored fields (year/make/model/trim/price/mileage/location) to build
 * the AI prompt — no CarGurus/AutoTrader scraping, no timeout risk.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and AI provider
 * keys in .env.local.
 */

import { resolve } from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Import scoring libs (dynamic to ensure dotenv is loaded first)
  const { scoreWithAi, inferSignalsFromListing } = await import("../lib/deals-score.js");
  const { scoreReceiptV2 } = await import("../lib/receipt-scoring-v2.js");
  const { computeDealQualityScore } = await import("../lib/deal-quality-score.js");

  // Delete blank rows (no make OR no vehicle_label)
  const { count: deleted, error: delErr } = await supabase
    .from("curated_deals")
    .delete({ count: "exact" })
    .or("make.is.null,vehicle_label.is.null");

  if (delErr) {
    console.error("Delete failed:", delErr.message);
  } else {
    console.log(`Deleted ${deleted ?? 0} blank rows`);
  }

  // Fetch all scoreable rows
  const { data: rows, error: fetchErr } = await supabase
    .from("curated_deals")
    .select("id, listing_url, make, model, year, trim, price, mileage, location")
    .not("make", "is", null)
    .order("created_at", { ascending: true });

  if (fetchErr || !rows) {
    console.error("Fetch failed:", fetchErr?.message);
    process.exit(1);
  }

  console.log(`Rescoring ${rows.length} deals...`);

  let rescored = 0, failed = 0;

  for (const row of rows) {
    try {
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
        console.error(`  ✗ ${row.id} (${row.make} ${row.model}):`, updateErr.message);
        failed++;
      } else {
        console.log(`  ✓ ${row.make} ${row.model} ${row.year} → ${scoring.verdict} [${aiResult.source}]`);
        rescored++;
      }
    } catch (err) {
      console.error(`  ✗ ${row.id}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nDone — rescored: ${rescored}, failed: ${failed}, deleted: ${deleted ?? 0}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
