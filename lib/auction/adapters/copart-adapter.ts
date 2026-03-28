/**
 * Copart Source Adapter
 *
 * Implements AuctionSourceAdapter for Copart.
 * Migrated from app/api/copart/lot/route.ts — all provider logic lives here.
 *
 * Strategy:
 * 1. Try Copart's internal JSON API (no cookie required)
 * 2. Fall back to Apify actor if blocked/unavailable
 *
 * Returns NormalizedAuctionLot — no raw Copart payload beyond this boundary.
 */

import {
  type AuctionSourceAdapter,
  type NormalizedAuctionLot,
  AuctionLotNotFoundError,
} from "../types";
import { inferDamageType } from "@/lib/copart-arbitrage-engine";

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return isFinite(n) ? n : null;
}

export function extractLotNumberFromUrl(url: string): string | null {
  const match = url.match(/\/lot\/(\d{6,12})/);
  return match ? match[1] : null;
}

/**
 * Parse year/make/model/location from the Copart URL slug.
 * e.g. /lot/99707075/2023-tesla-model-y-ca-san-bernardino
 * Returns partial lot data if slug is present, null otherwise.
 */
function parseFromUrlSlug(
  url: string,
  lotNumber: string
): NormalizedAuctionLot | null {
  // Slug is the path segment after the lot number
  const slugMatch = url.match(/\/lot\/\d+\/([a-z0-9-]+)/i);
  if (!slugMatch) return null;

  const parts = slugMatch[1].split("-");
  if (parts.length < 3) return null;

  // First token is often the year (4-digit number)
  const yearIdx = parts.findIndex((p) => /^\d{4}$/.test(p));
  if (yearIdx === -1) return null;

  const year = parseInt(parts[yearIdx], 10);

  // State abbreviation appears as 2-letter uppercase-equivalent token near the end
  // e.g. "ca" in "2023-tesla-model-y-ca-san-bernardino"
  // make is the token after year, model is the rest before the state code
  const afterYear = parts.slice(yearIdx + 1);
  const stateIdx = afterYear.findIndex((p) => /^[a-z]{2}$/.test(p) && afterYear.indexOf(p) > 0);

  let make: string | null = null;
  let model: string | null = null;
  let location: string | null = null;

  if (stateIdx > 0) {
    make = afterYear[0]
      ? afterYear[0].charAt(0).toUpperCase() + afterYear[0].slice(1)
      : null;
    model = afterYear
      .slice(1, stateIdx)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || null;
    location = afterYear
      .slice(stateIdx)
      .map((p) => p.toUpperCase())
      .join(", ") || null;
  } else {
    // Fallback: make = token[0], model = rest
    make = afterYear[0]
      ? afterYear[0].charAt(0).toUpperCase() + afterYear[0].slice(1)
      : null;
    model = afterYear
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || null;
  }

  console.log(
    `[CopartAdapter] URL slug fallback: lot=${lotNumber} year=${year} make=${make} model=${model}`
  );

  return {
    auction_source: "copart",
    lot_number: lotNumber,
    vin: null,
    year,
    make,
    model,
    trim: null,
    title_status: null,
    damage_type: null,
    primary_damage: null,
    secondary_damage: null,
    current_bid: null,
    buy_now_price: null,
    odometer: null,
    odometer_brand: null,
    run_and_drive_status: null,
    loss_type: null,
    sale_date: null,
    location,
    photos: [],
    condition_notes: null,
    provider_name: "copart_url_slug",
    raw_provider_payload: { url, slug: slugMatch[1] },
  };
}

// ── Copart browser headers ────────────────────────────────────────────────────

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

// ── Normalise raw Copart API response → NormalizedAuctionLot ─────────────────

function normaliseFromCopartApi(
  raw: Record<string, unknown>,
  lotNumber: string
): NormalizedAuctionLot {
  const d =
    ((raw?.data as Record<string, unknown>)?.lotDetails as Record<string, unknown>) ?? raw;

  const imagesList = (raw?.data as Record<string, unknown>)
    ?.imagesList as Record<string, unknown>;
  const imageContent = Array.isArray(imagesList?.content)
    ? (imagesList.content as Record<string, unknown>[])
    : [];
  const photos = imageContent
    .map((img) => str(img.url) ?? str(img.fullUrl))
    .filter((u): u is string => !!u)
    .slice(0, 10);

  const primaryDamage = str(d.dd) ?? str(d.damageDescription) ?? str(d.primaryDamage);
  const secondaryDamage =
    str(d.sdd) ?? str(d.secondaryDamageDescription) ?? str(d.secondaryDamage);
  const highlights = str(d.lcd) ?? str(d.highlights) ?? str(d.lotDescription);
  const conditionParts = [primaryDamage, secondaryDamage, highlights].filter(Boolean);

  return {
    auction_source: "copart",
    lot_number: lotNumber,
    vin: str(d.vin) ?? str(d.vehicleVin),
    year: num(d.lcy) ?? num(d.year),
    make: str(d.mkn) ?? str(d.make),
    model: str(d.mdn) ?? str(d.model),
    trim: str(d.ftd) ?? str(d.trim),
    title_status: str(d.ttle) ?? str(d.titleType) ?? str(d.td),
    damage_type: inferDamageType(conditionParts.join(" ")),
    primary_damage: primaryDamage,
    secondary_damage: secondaryDamage,
    current_bid: num(d.cb) ?? num(d.currentBid),
    buy_now_price: num(d.bnp) ?? num(d.buyNowPrice),
    odometer: num(d.orr) ?? num(d.odometer),
    odometer_brand: str(d.obtd) ?? str(d.odometerBrand),
    run_and_drive_status: str(d.rad) ?? str(d.runAndDrive),
    loss_type: str(d.lt) ?? str(d.lossType),
    sale_date: str(d.ad) ?? str(d.auctionDate) ?? str(d.saleDate),
    location: str(d.yn) ?? str(d.yardName) ?? str(d.location),
    photos,
    condition_notes: conditionParts.join(". ") || null,
    provider_name: "copart_api",
    raw_provider_payload: raw,
  };
}

// ── Normalise Apify response → NormalizedAuctionLot ──────────────────────────

function normaliseFromApify(
  item: Record<string, unknown>,
  lotNumber: string
): NormalizedAuctionLot {
  const primaryDamage = str(item.primaryDamage) ?? str(item.damageDescription);
  const secondaryDamage = str(item.secondaryDamage);
  const highlights = str(item.highlights) ?? str(item.description);
  const conditionParts = [primaryDamage, secondaryDamage, highlights].filter(Boolean);

  return {
    auction_source: "copart",
    lot_number: lotNumber,
    vin: str(item.vin) ?? str(item.VIN),
    year: num(item.year) ?? num(item.modelYear),
    make: str(item.make) ?? str(item.manufacturer),
    model: str(item.model),
    trim: str(item.trim),
    title_status: str(item.titleType) ?? str(item.title),
    damage_type: inferDamageType(conditionParts.join(" ")),
    primary_damage: primaryDamage,
    secondary_damage: secondaryDamage,
    current_bid: num(item.currentBid) ?? num(item.bid),
    buy_now_price: num(item.buyNowPrice),
    odometer: num(item.odometer) ?? num(item.mileage),
    odometer_brand: str(item.odometerBrand),
    run_and_drive_status: str(item.runAndDrive),
    loss_type: str(item.lossType),
    sale_date: str(item.saleDate) ?? str(item.auctionDate),
    location: str(item.location) ?? str(item.yardLocation),
    photos: Array.isArray(item.images)
      ? (item.images as unknown[]).map((u) => String(u)).filter(Boolean).slice(0, 10)
      : [],
    condition_notes: conditionParts.join(". ") || null,
    provider_name: "apify",
    raw_provider_payload: item,
  };
}

// ── Provider fetch functions ──────────────────────────────────────────────────

async function fetchFromCopartApi(lotNumber: string): Promise<NormalizedAuctionLot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://www.copart.com/public/data/lotdetails/solr/lotDetails/${lotNumber}/USA`,
      { headers: COPART_BROWSER_HEADERS, signal: controller.signal }
    );
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[CopartAdapter] API returned ${res.status} for lot ${lotNumber}`);
      return null;
    }

    const json = (await res.json()) as Record<string, unknown>;

    if (json.returnCode !== 1 && json.returnCode !== "1") {
      console.warn(`[CopartAdapter] returnCode=${json.returnCode} for lot ${lotNumber}`);
      return null;
    }

    const lot = normaliseFromCopartApi(json, lotNumber);
    console.log(
      `[CopartAdapter] API success for lot ${lotNumber}, VIN=${lot.vin}, damage=${lot.primary_damage}`
    );
    return lot;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[CopartAdapter] API fetch failed for lot ${lotNumber}:`, err);
    return null;
  }
}

async function fetchFromApify(lotNumber: string): Promise<NormalizedAuctionLot | null> {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_COPART_ACTOR_ID;

  if (!token || !actorId) {
    console.warn("[CopartAdapter] Apify credentials not configured — skipping fallback");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

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
      console.warn(`[CopartAdapter] Apify returned ${res.status} for lot ${lotNumber}`);
      return null;
    }

    const items = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(items) || items.length === 0) return null;

    return normaliseFromApify(items[0], lotNumber);
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[CopartAdapter] Apify fetch failed for lot ${lotNumber}:`, err);
    return null;
  }
}

// ── Adapter implementation ────────────────────────────────────────────────────

async function fetchByLot(lotNumber: string): Promise<NormalizedAuctionLot> {
  let lot = await fetchFromCopartApi(lotNumber);

  if (!lot) {
    console.log(`[CopartAdapter] Trying Apify fallback for lot ${lotNumber}`);
    lot = await fetchFromApify(lotNumber);
  }

  if (!lot) {
    // No URL slug available for bare lot number — return minimal shell so
    // the evaluation service can still run Auto.dev enrichment by lot number
    console.warn(`[CopartAdapter] All providers failed for lot ${lotNumber} — returning minimal shell`);
    lot = {
      auction_source: "copart",
      lot_number: lotNumber,
      vin: null,
      year: null,
      make: null,
      model: null,
      trim: null,
      title_status: null,
      damage_type: null,
      primary_damage: null,
      secondary_damage: null,
      current_bid: null,
      buy_now_price: null,
      odometer: null,
      odometer_brand: null,
      run_and_drive_status: null,
      loss_type: null,
      sale_date: null,
      location: null,
      photos: [],
      condition_notes: null,
      provider_name: "copart_unavailable",
      raw_provider_payload: null,
    };
  }

  return lot;
}

async function fetchByUrl(url: string): Promise<NormalizedAuctionLot> {
  const lotNumber = extractLotNumberFromUrl(url);
  if (!lotNumber) {
    throw new Error(`Could not extract lot number from URL: ${url}`);
  }

  // Try standard fetch path first
  let lot = await fetchFromCopartApi(lotNumber);

  if (!lot) {
    console.log(`[CopartAdapter] Trying Apify fallback for lot ${lotNumber}`);
    lot = await fetchFromApify(lotNumber);
  }

  // If both API sources fail but we have a URL with a slug, extract partial data from it
  if (!lot) {
    lot = parseFromUrlSlug(url, lotNumber);
    if (lot) {
      console.log(`[CopartAdapter] Using URL slug partial data for lot ${lotNumber}`);
    }
  }

  if (!lot) {
    throw new AuctionLotNotFoundError(lotNumber);
  }

  return lot;
}

async function fetchByVin(_vin: string): Promise<NormalizedAuctionLot> {
  throw new Error(
    "CopartAdapter.fetchByVin is not supported — use fetchByUrl or fetchByLot"
  );
}

export const copartAdapter: AuctionSourceAdapter = {
  fetchByUrl,
  fetchByLot,
  fetchByVin,
};
