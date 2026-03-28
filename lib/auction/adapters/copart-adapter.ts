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
    throw new AuctionLotNotFoundError(lotNumber);
  }

  return lot;
}

async function fetchByUrl(url: string): Promise<NormalizedAuctionLot> {
  const lotNumber = extractLotNumberFromUrl(url);
  if (!lotNumber) {
    throw new Error(`Could not extract lot number from URL: ${url}`);
  }
  return fetchByLot(lotNumber);
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
