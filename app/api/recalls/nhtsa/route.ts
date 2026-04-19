/**
 * GET /api/recalls/nhtsa?make=Tesla&model=Model+3&year=2018
 *
 * Live NHTSA recall lookup — no auth required, public data.
 * Fetches from https://api.nhtsa.gov/recalls/recallsByVehicle
 * In-process cache: 1 hour TTL to avoid hammering NHTSA on every page load.
 */

import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const make = (searchParams.get("make") || "").trim();
  const model = (searchParams.get("model") || "").trim();
  const year = (searchParams.get("year") || "").trim();

  if (!make || !model || !year) {
    return NextResponse.json(
      { success: false, error: "make, model, and year are required" },
      { status: 400 }
    );
  }

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
      cache: "no-store", // avoid stale Next.js fetch cache issues
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `NHTSA responded ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
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
