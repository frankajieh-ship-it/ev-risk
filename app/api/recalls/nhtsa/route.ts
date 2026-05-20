/**
 * GET /api/recalls/nhtsa?make=Tesla&model=Model+3&year=2018
 *
 * Live NHTSA recall lookup — no auth required, public data.
 * Fetches from https://api.nhtsa.gov/recalls/recallsByVehicle
 * In-process cache: 1 hour TTL to avoid hammering NHTSA on every page load.
 */

import { NextRequest, NextResponse } from "next/server";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const recallsRateLimiter = new RateLimiter(60 * 1000, 30); // 30 req/min per IP

interface NhtsaRecall {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  ReportReceivedDate: string;
}

interface CacheEntry {
  recalls: NhtsaRecall[];
  fetchedAt: number;
}

// In-process memory cache — survives Lambda warm starts but resets on cold start
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Common trim/variant suffixes NHTSA doesn't recognise — strip to get base model
const NHTSA_TRIM_STRIP = /\s+(sl|sv|se|s|sr|sv\+?|sr\+?|plus|premium|limited|base|awd|rwd|fwd|4wd|4x4|4x2|electric|ev|sport|gt|pro|plus|wind|earth|light|air|launch|touring|ex|exl|lx|ex-l|le|xle|xse|xse|platinum|titanium|sel|slt|at4|denali|z51|z06|rs|ss|zl1|st|r-design|t8|t6|t5|polestar|inscription|momentum|r-line|highline|comfortline|trendline|highline|wolfsburg|gti|gli|r|gls|gle|glc|gla|glb|amg|4matic|bluetec|hybrid|phev|fcev|bev)\b.*/i;

/**
 * Normalise a model name for NHTSA: strip trim suffixes that NHTSA doesn't index.
 * NHTSA returns HTTP 400 when the model includes trim-level words.
 */
function normModelForNhtsa(model: string): string {
  return model.replace(NHTSA_TRIM_STRIP, "").trim();
}

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const rateCheck = recallsRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = req.nextUrl;
  const make = (searchParams.get("make") || "").trim();
  const rawModel = (searchParams.get("model") || "").trim();
  const year = (searchParams.get("year") || "").trim();

  if (!make || !rawModel || !year) {
    return NextResponse.json(
      { success: false, error: "make, model, and year are required" },
      { status: 400 }
    );
  }

  // Strip trim suffixes NHTSA doesn't accept (e.g. "LEAF SL" → "LEAF")
  const model = normModelForNhtsa(rawModel);

  const cacheKey = `${make}::${model}::${year}`.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, recalls: cached.recalls, cached: true });
  }

  try {
    const url = new URL("https://api.nhtsa.gov/recalls/recallsByVehicle");
    url.searchParams.set("make", make);
    url.searchParams.set("model", model);
    url.searchParams.set("modelYear", year);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    // NHTSA returns 400 for unrecognised trim names but still returns valid JSON
    // with Count:0 — treat that as "no recalls" rather than an error
    const data = await res.json().catch(() => null);
    if (!res.ok && !data?.results) {
      return NextResponse.json(
        { success: false, error: `NHTSA responded ${res.status}` },
        { status: 502 }
      );
    }

    const recalls: NhtsaRecall[] = Array.isArray(data?.results) ? data.results : [];

    cache.set(cacheKey, { recalls, fetchedAt: Date.now() });

    return NextResponse.json({ success: true, recalls, cached: false });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "NHTSA fetch failed" },
      { status: 502 }
    );
  }
}
