/**
 * POST /api/admin/deals-backfill-photos
 *
 * Batch-fills photo_url for all active curated_deals rows where photo_url IS NULL.
 * Fetches photos via VinAudit (primary) → Auto.dev (fallback).
 * Processes up to 50 rows per call to avoid timeouts.
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getVehicleImages } from "@/lib/vinaudit-client";
import { searchListings } from "@/lib/auto-dev-client";
import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";
import { lookupLocalImages } from "@/lib/vehicle-image-db";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

// Mirrors normalizeForAutodev from /api/photos/route.ts
const MODEL_EXACT_MAP: Record<string, string> = {
  "leaf": "LEAF", "leaf s": "LEAF", "leaf sv": "LEAF", "leaf sl": "LEAF",
  "leaf plus": "LEAF", "leaf plus s": "LEAF", "leaf plus sv": "LEAF", "leaf plus sl": "LEAF",
  "mustang mach-e": "Mustang Mach-E",
  "mustang mach-e select rwd": "Mustang Mach-E", "mustang mach-e select": "Mustang Mach-E",
  "mustang mach-e premium rwd": "Mustang Mach-E", "mustang mach-e premium awd": "Mustang Mach-E",
  "mustang mach-e premium": "Mustang Mach-E", "mustang mach-e gt awd": "Mustang Mach-E",
  "mustang mach-e gt": "Mustang Mach-E",
  "mustang mach-e california route 1 awd": "Mustang Mach-E",
  "mustang mach-e california route 1 rwd": "Mustang Mach-E",
  "mustang mach-e california route 1": "Mustang Mach-E",
  "c40 recharge twin ultimate eawd": "C40", "c40 recharge twin ultimate": "C40",
  "c40 recharge twin": "C40", "c40 recharge single": "C40", "c40 recharge": "C40", "c40": "C40",
  "xc40 recharge twin ultimate": "XC40", "xc40 recharge twin": "XC40",
  "xc40 recharge single": "XC40", "xc40 recharge": "XC40", "xc40": "XC40",
  "gv60 performance": "GV60", "gv60 advanced": "GV60", "gv60 standard": "GV60",
  "gv70 electrified": "GV70 Electrified", "gv70 gt-line": "GV70", "gv70": "GV70",
  "gv80 electrified": "GV80 Electrified", "g80 electrified": "G80 Electrified",
  "ioniq 5": "Ioniq 5", "ioniq 6": "Ioniq 6",
  "ev6": "EV6", "ev9": "EV9",
  "r1t": "R1T", "r1s": "R1S",
  "id.4": "ID.4", "id4": "ID.4",
  "cybertruck": "Cybertruck", "cybertruck crew cab": "Cybertruck",
  "cybertruck foundation series": "Cybertruck",
  "bolt euv": "Bolt EUV", "bolt euv lt": "Bolt EUV", "bolt euv premier": "Bolt EUV",
  "bolt ev": "Bolt EV", "bolt ev lt": "Bolt EV", "bolt ev premier": "Bolt EV", "bolt": "Bolt EV",
  "equinox ev": "Equinox EV", "blazer ev": "Blazer EV", "silverado ev": "Silverado EV",
  "lyriq": "LYRIQ", "lyriq luxury 1": "LYRIQ", "lyriq luxury 2": "LYRIQ", "lyriq luxury 3": "LYRIQ",
  "lyriq sport 1": "LYRIQ", "lyriq sport 2": "LYRIQ", "lyriq v-series": "LYRIQ",
  "optiq": "OPTIQ", "escalade iq": "ESCALADE IQ",
  "i3": "i3", "i4": "i4", "i5": "i5", "i7": "i7", "ix": "iX", "ix3": "iX3",
  "i4 edrive40": "i4", "i4 m50": "i4", "i5 xdrive40": "i5", "i5 edrive40": "i5",
  "i7 xdrive60": "i7", "ix xdrive40": "iX", "ix xdrive50": "iX", "ix m60": "iX", "ix xdrive60": "iX",
  "eqs 450+": "EQS", "eqs 580 4matic": "EQS", "eqs": "EQS",
  "eqb 300 4matic": "EQB", "eqb": "EQB",
  "eqe 350+": "EQE", "eqe": "EQE",
};

const TRIM_SUFFIXES = [
  " crew cab", " super crew", " super cab", " extended cab", " double cab",
  " quad cab", " mega cab", " king cab", " access cab", " regular cab",
  " foundation series",
  " rear-wheel drive", " all-wheel drive", " front-wheel drive",
  " dual motor", " tri motor", " single motor",
  " long range", " standard range plus", " standard range", " extended range", " extended", " standard",
  " performance", " plaid", " plaid+",
  " gt", " gt-line", " gt line", " wind", " earth", " light",
  " sel", " se", " limited", " blue",
  " large pack", " max pack", " adventure",
  " xdrive50", " xdrive40", " edrive40", " edrive35", " m50",
  " 4s", " turbo", " turbo s", " cross turismo", " sport turismo",
  " pure", " grand touring", " grand touring+",
  " p100d", " p90d", " p85d", " p85+", " p85",
  " 100d", " 90d", " 85d", " 75d", " 70d", " 60d",
  " awd", " rwd", " fwd", " 4wd",
  " 450+", " 580", " 350+",
  " e-4wd",
  " select", " premium", " pro s", " pro", " plus", " s",
  " twin ultimate eawd", " twin ultimate", " twin", " single motor eawd", " single motor",
  " recharge",
  " electrified", " performance", " advanced",
  " california route 1", " california route",
  " hatchback", " sedan", " suv", " crossover", " coupe", " convertible", " wagon",
  " electric", " ev",
];

const MAKE_ALIASES: Record<string, string> = { "mercedes": "Mercedes-Benz" };

function normalizeForAutodev(make: string | undefined, model: string | undefined) {
  const normalizedMake = make ? (MAKE_ALIASES[make.toLowerCase()] ?? make) : make;
  if (!model) return { make: normalizedMake, model };
  let m = model.trim();
  if (normalizedMake && m.toLowerCase().startsWith(normalizedMake.toLowerCase() + " ")) {
    m = m.slice(normalizedMake.length + 1).trim();
  } else if (make && m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }
  const exactKey = m.toLowerCase();
  if (MODEL_EXACT_MAP[exactKey]) return { make: normalizedMake, model: MODEL_EXACT_MAP[exactKey] };
  let stripped = true;
  while (stripped) {
    stripped = false;
    const mLower = m.toLowerCase();
    for (const suffix of TRIM_SUFFIXES) {
      if (mLower.endsWith(suffix)) {
        m = m.slice(0, m.length - suffix.length).trim();
        const newKey = m.toLowerCase();
        if (MODEL_EXACT_MAP[newKey]) return { make: normalizedMake, model: MODEL_EXACT_MAP[newKey] };
        stripped = true;
        break;
      }
    }
  }
  return { make: normalizedMake, model: m };
}

function proxyIfWikimedia(url: string): string {
  if (url.includes("upload.wikimedia.org")) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function fetchPhoto(row: { id: string; make: string | null; model: string | null; year: number | null; trim: string | null }): Promise<string | null> {
  const make = row.make ?? undefined;
  const rawModel = [row.model, row.trim].filter(Boolean).join(" ") || undefined;

  // Tier 0a: OFFO local CSV — year-aware, handles trim variants (e.g. "Blazer EV LT RWD" → "Blazer EV")
  if (make && rawModel) {
    const local = lookupLocalImages(make, rawModel, row.year ?? undefined);
    if (local.matched && local.urls.length > 0) return proxyIfWikimedia(local.urls[0]);
  }

  // Tier 0b: static curated photo map — zero latency, most reliable for common EVs
  const staticUrl = getStaticPhotoUrl(make, rawModel, row.year ?? undefined);
  if (staticUrl) return proxyIfWikimedia(staticUrl);

  // Tier 0b: make-level fallback
  const makeFallback = make ? MAKE_FALLBACK_MAP[make.toLowerCase()] : undefined;
  if (makeFallback) return proxyIfWikimedia(makeFallback);

  // Tier 1: VinAudit
  const vinauditResult = await getVehicleImages({ year: row.year ?? undefined, make, model: rawModel, limit: 1 });
  if (vinauditResult.success && vinauditResult.photo_urls.length > 0) {
    return vinauditResult.photo_urls[0];
  }

  // Tier 2: Auto.dev
  const { make: normMake, model: normModel } = normalizeForAutodev(make, rawModel);
  let result = await searchListings({ make: normMake, model: normModel, year: row.year ?? undefined, limit: 3 });
  if (!result?.records?.length && row.year) {
    result = await searchListings({ make: normMake, model: normModel, limit: 3 });
  }
  if (result?.records) {
    for (const record of result.records) {
      if (normMake && record.make) {
        const rMake = record.make.toLowerCase();
        const eMake = normMake.toLowerCase();
        if (!rMake.includes(eMake) && !eMake.includes(rMake)) continue;
      }
      if (record.primaryPhotoUrl) return record.primaryPhotoUrl;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Fetch up to 50 active rows with no photo
  const { data: rows, error: fetchError } = await supabase
    .from("curated_deals")
    .select("id, make, model, year, trim")
    .eq("is_active", true)
    .is("photo_url", null)
    .limit(50);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: true, updated: 0, failed: 0, message: "No rows need photos" });
  }

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const photoUrl = await fetchPhoto(row);
      if (photoUrl) {
        const { error: updateError } = await supabase
          .from("curated_deals")
          .update({ photo_url: photoUrl })
          .eq("id", row.id)
          .is("photo_url", null);
        if (!updateError) {
          updated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    // Small delay between rows to avoid hammering external APIs
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({ success: true, updated, failed, total: rows.length });
}
