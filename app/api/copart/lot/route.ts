/**
 * Copart Lot Detail API
 *
 * GET /api/copart/lot?lotNumber=443134431
 *
 * Strategy:
 * 1. Try Copart's own internal JSON API (no cookie required)
 * 2. Fall back to Apify actor if Copart API is blocked/unavailable
 *
 * Returns normalised lot data: VIN, damage fields, title type, odometer,
 * current bid, loss type, highlights — enough to run computeSalvageRisk()
 * with real data instead of empty/generic inputs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";

export const maxDuration = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LotData {
  lotNumber: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  primaryDamage: string | null;
  secondaryDamage: string | null;
  titleType: string | null;
  odometer: number | null;
  odometerBrand: string | null;
  currentBid: number | null;
  buyNowPrice: number | null;
  lossType: string | null;
  highlights: string | null;
  saleDate: string | null;
  location: string | null;
  images: string[];
  source: "copart_api" | "apify" | "unknown";
}

// ── Cache (10-min TTL, survives Lambda warm starts) ───────────────────────────

interface CacheEntry {
  data: LotData;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(lotNumber: string): LotData | null {
  const entry = cache.get(lotNumber);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(lotNumber);
    return null;
  }
  return entry.data;
}

function setCached(lotNumber: string, data: LotData): void {
  cache.set(lotNumber, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter(60 * 1000, 20); // 20/min per IP

// ── Copart internal API ───────────────────────────────────────────────────────

const COPART_BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.copart.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return isFinite(n) ? n : null;
}

function normaliseLotFromCopartApi(raw: Record<string, unknown>, lotNumber: string): LotData {
  // Copart API nests under data.lotDetails
  const d = (raw?.data as Record<string, unknown>)?.lotDetails as Record<string, unknown> ?? raw;

  // Image list: data.imagesList.content[] each has url
  const imagesList = (raw?.data as Record<string, unknown>)?.imagesList as Record<string, unknown>;
  const imageContent = Array.isArray(imagesList?.content) ? imagesList.content as Record<string, unknown>[] : [];
  const images = imageContent
    .map((img) => str(img.url) ?? str(img.fullUrl))
    .filter((u): u is string => !!u)
    .slice(0, 10);

  return {
    lotNumber,
    vin: str(d.vin) ?? str(d.vehicleVin),
    year: num(d.lcy) ?? num(d.year),
    make: str(d.mkn) ?? str(d.make),
    model: str(d.mdn) ?? str(d.model),
    trim: str(d.ftd) ?? str(d.trim),
    primaryDamage: str(d.dd) ?? str(d.damageDescription) ?? str(d.primaryDamage),
    secondaryDamage: str(d.sdd) ?? str(d.secondaryDamageDescription) ?? str(d.secondaryDamage),
    titleType: str(d.ttle) ?? str(d.titleType) ?? str(d.td),
    odometer: num(d.orr) ?? num(d.odometer),
    odometerBrand: str(d.obtd) ?? str(d.odometerBrand),
    currentBid: num(d.cb) ?? num(d.currentBid),
    buyNowPrice: num(d.bnp) ?? num(d.buyNowPrice),
    lossType: str(d.lt) ?? str(d.lossType),
    highlights: str(d.lcd) ?? str(d.highlights) ?? str(d.lotDescription),
    saleDate: str(d.ad) ?? str(d.auctionDate) ?? str(d.saleDate),
    location: str(d.yn) ?? str(d.yardName) ?? str(d.location),
    images,
    source: "copart_api",
  };
}

async function fetchFromCopartApi(lotNumber: string): Promise<LotData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://www.copart.com/public/data/lotdetails/solr/lotDetails/${lotNumber}/USA`,
      { headers: COPART_BROWSER_HEADERS, signal: controller.signal }
    );
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[CopartLot] API returned ${res.status} for lot ${lotNumber}`);
      return null;
    }

    const json = await res.json() as Record<string, unknown>;

    // Sanity check: should have returnCode = 1
    if (json.returnCode !== 1 && json.returnCode !== "1") {
      console.warn(`[CopartLot] API returnCode=${json.returnCode} for lot ${lotNumber}`);
      return null;
    }

    const lot = normaliseLotFromCopartApi(json, lotNumber);
    console.log(`[CopartLot] API success for lot ${lotNumber}, VIN=${lot.vin}, damage=${lot.primaryDamage}`);
    return lot;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[CopartLot] API fetch failed for lot ${lotNumber}:`, err);
    return null;
  }
}

// ── Apify fallback ────────────────────────────────────────────────────────────

async function fetchFromApify(lotNumber: string): Promise<LotData | null> {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_COPART_ACTOR_ID;

  if (!token || !actorId) {
    console.warn("[CopartLot] Apify credentials not configured — skipping fallback");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000); // Apify runs can take ~15-20s

  try {
    const runUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}&timeout=20`;
    const res = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrl: `https://www.copart.com/lot/${lotNumber}`,
        maxItems: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[CopartLot] Apify returned ${res.status} for lot ${lotNumber}`);
      return null;
    }

    const items = await res.json() as Record<string, unknown>[];
    if (!Array.isArray(items) || items.length === 0) return null;

    const item = items[0];
    // Map common Apify actor output field names → our LotData shape
    return {
      lotNumber,
      vin: str(item.vin) ?? str(item.VIN),
      year: num(item.year) ?? num(item.modelYear),
      make: str(item.make) ?? str(item.manufacturer),
      model: str(item.model),
      trim: str(item.trim),
      primaryDamage: str(item.primaryDamage) ?? str(item.damageDescription),
      secondaryDamage: str(item.secondaryDamage),
      titleType: str(item.titleType) ?? str(item.title),
      odometer: num(item.odometer) ?? num(item.mileage),
      odometerBrand: str(item.odometerBrand),
      currentBid: num(item.currentBid) ?? num(item.bid),
      buyNowPrice: num(item.buyNowPrice),
      lossType: str(item.lossType),
      highlights: str(item.highlights) ?? str(item.description),
      saleDate: str(item.saleDate) ?? str(item.auctionDate),
      location: str(item.location) ?? str(item.yardLocation),
      images: Array.isArray(item.images)
        ? (item.images as unknown[]).map((u) => String(u)).filter(Boolean).slice(0, 10)
        : [],
      source: "apify",
    };
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[CopartLot] Apify fetch failed for lot ${lotNumber}:`, err);
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const lotNumber = searchParams.get("lotNumber")?.trim() ?? "";

  if (!lotNumber || !/^\d{6,12}$/.test(lotNumber)) {
    return NextResponse.json(
      { success: false, error: "Invalid lotNumber — must be 6–12 digits" },
      { status: 400 }
    );
  }

  // Cache hit
  const cached = getCached(lotNumber);
  if (cached) {
    return NextResponse.json({ success: true, lot: cached, cached: true });
  }

  // Try Copart API first
  let lot = await fetchFromCopartApi(lotNumber);

  // Fall back to Apify if Copart API failed
  if (!lot) {
    console.log(`[CopartLot] Trying Apify fallback for lot ${lotNumber}`);
    lot = await fetchFromApify(lotNumber);
  }

  if (!lot) {
    return NextResponse.json(
      { success: false, error: "Could not retrieve lot data from Copart or Apify" },
      { status: 502 }
    );
  }

  setCached(lotNumber, lot);
  return NextResponse.json({ success: true, lot, cached: false });
}
