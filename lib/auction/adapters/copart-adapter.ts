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
// Known Copart damage tokens that appear in URL slugs
// e.g. "2023-tesla-model-y-front-end-ca-san-bernardino"
const SLUG_DAMAGE_TOKENS: { tokens: string[]; damage: string }[] = [
  { tokens: ["front", "end"],       damage: "Front End" },
  { tokens: ["rear", "end"],        damage: "Rear End" },
  { tokens: ["all", "over"],        damage: "All Over" },
  { tokens: ["side"],               damage: "Side" },
  { tokens: ["rollover"],           damage: "Rollover" },
  { tokens: ["fire"],               damage: "Fire" },
  { tokens: ["flood"],              damage: "Flood" },
  { tokens: ["hail"],               damage: "Hail" },
  { tokens: ["vandalism"],          damage: "Vandalism" },
  { tokens: ["mechanical"],         damage: "Mechanical" },
  { tokens: ["burn"],               damage: "Burn" },
  { tokens: ["minor", "dents"],     damage: "Minor Dents/Scratches" },
  { tokens: ["undercarriage"],      damage: "Undercarriage" },
  { tokens: ["suspension"],         damage: "Suspension" },
];

function extractDamageFromSlugParts(parts: string[]): string | null {
  const joined = parts.join(" ");
  for (const { tokens, damage } of SLUG_DAMAGE_TOKENS) {
    if (tokens.every((t) => parts.includes(t))) return damage;
    if (tokens.length === 1 && joined.includes(tokens[0])) return damage;
  }
  return null;
}

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

  // State abbreviation: 2-letter token after at least one non-state token
  const afterYear = parts.slice(yearIdx + 1);
  const stateIdx = afterYear.findIndex((p) => /^[a-z]{2}$/.test(p) && afterYear.indexOf(p) > 0);

  let make: string | null = null;
  let model: string | null = null;
  let location: string | null = null;
  let primaryDamage: string | null = null;

  // Known EV/car model token counts to help split make+model from damage tokens
  // make = afterYear[0], then we walk forward until we hit a damage token or state code
  const KNOWN_MAKES: Record<string, number> = {
    tesla: 2, chevrolet: 2, nissan: 1, ford: 2, hyundai: 2,
    kia: 2, rivian: 2, lucid: 2, volkswagen: 2, bmw: 1, audi: 1,
  };

  const makeToken = afterYear[0]?.toLowerCase() ?? "";
  const modelTokenCount = KNOWN_MAKES[makeToken] ?? 1;
  const modelTokens = afterYear.slice(1, 1 + modelTokenCount);
  const remainder = afterYear.slice(1 + modelTokenCount, stateIdx > 0 ? stateIdx : undefined);

  make = afterYear[0]
    ? afterYear[0].charAt(0).toUpperCase() + afterYear[0].slice(1)
    : null;
  model = modelTokens.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || null;

  // Extract damage from remainder tokens (between model and state code)
  if (remainder.length > 0) {
    primaryDamage = extractDamageFromSlugParts(remainder);
    // If no damage match, remainder tokens are extra model words (e.g. trim)
    if (!primaryDamage && stateIdx > 0) {
      model = afterYear.slice(1, stateIdx)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ") || null;
    }
  }

  if (stateIdx > 0) {
    location = afterYear.slice(stateIdx).map((p) => p.toUpperCase()).join(", ") || null;
  }

  console.log(
    `[CopartAdapter] URL slug fallback: lot=${lotNumber} year=${year} make=${make} model=${model} damage=${primaryDamage}`
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
    damage_type: primaryDamage ? inferDamageType(primaryDamage) : null,
    primary_damage: primaryDamage,
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
    condition_notes: primaryDamage,
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

  console.log(`[CopartAdapter][Apify] token=${token ? `present(${token.slice(0, 6)}...)` : "MISSING"} actorId=${actorId ?? "MISSING"}`);

  if (!token || !actorId) {
    console.warn("[CopartAdapter] Apify credentials not configured — skipping fallback");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const runUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}&timeout=8`;
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

    console.log(`[CopartAdapter][Apify] HTTP ${res.status} for lot ${lotNumber}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[CopartAdapter][Apify] Error body: ${body.slice(0, 200)}`);
      return null;
    }

    const items = (await res.json()) as Record<string, unknown>[];
    console.log(`[CopartAdapter][Apify] items.length=${items.length} keys=${items[0] ? Object.keys(items[0]).join(",") : "empty"}`);
    if (!Array.isArray(items) || items.length === 0) return null;

    const normalized = normaliseFromApify(items[0], lotNumber);
    console.log(`[CopartAdapter][Apify] normalized: vin=${normalized.vin} primary_damage=${normalized.primary_damage} title_status=${normalized.title_status} odometer=${normalized.odometer}`);
    return normalized;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[CopartAdapter] Apify fetch failed for lot ${lotNumber}:`, err);
    return null;
  }
}

// ── Adapter implementation ────────────────────────────────────────────────────

/**
 * Fetch the Copart lot page HTML and extract the canonical URL (which contains
 * the full slug, e.g. /lot/46234086/salvage-2018-hyundai-elantra-sel-ga-savannah).
 * Used as a third fallback when both the Copart JSON API and Apify are unavailable.
 */
async function fetchSlugFromCopartHtml(lotNumber: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://www.copart.com/lot/${lotNumber}`, {
      headers: {
        ...COPART_BROWSER_HEADERS,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[CopartAdapter][HTML] ${res.status} for lot ${lotNumber}`);
      return null;
    }
    const html = await res.text();
    // Primary: <link rel="canonical" href="..."> — most reliable, always present
    const canonicalMatch =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    if (canonicalMatch?.[1]) {
      console.log(`[CopartAdapter][HTML] canonical for lot ${lotNumber}: ${canonicalMatch[1]}`);
      return canonicalMatch[1];
    }
    // Fallback: og:url meta tag
    const ogMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch?.[1]) {
      console.log(`[CopartAdapter][HTML] og:url for lot ${lotNumber}: ${ogMatch[1]}`);
      return ogMatch[1];
    }
    console.warn(`[CopartAdapter][HTML] no canonical/og:url found for lot ${lotNumber}`);
    return null;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[CopartAdapter][HTML] fetch failed for lot ${lotNumber}:`, err);
    return null;
  }
}

async function fetchByLot(lotNumber: string): Promise<NormalizedAuctionLot> {
  // Race Copart API and Apify in parallel — use first non-null result.
  // Copart API is faster when available (~2s); Apify is the reliable fallback (~8s).
  // Both are fired simultaneously so the total wait is max(api, apify) not api+apify.
  const [apiResult, apifyResult] = await Promise.all([
    fetchFromCopartApi(lotNumber),
    fetchFromApify(lotNumber),
  ]);
  let lot = apiResult ?? apifyResult;
  console.log(`[CopartAdapter] parallel fetch: api=${apiResult ? "ok" : "null"} apify=${apifyResult ? "ok" : "null"}`);

  if (!lot) {
    // Both fast providers failed. Fetch the Copart HTML page to extract the canonical
    // URL slug (e.g. /salvage-2018-hyundai-elantra-sel-ga-savannah), then reuse the
    // existing slug parser to recover year/make/model/damage as a graceful degradation.
    console.warn(`[CopartAdapter] Both providers failed for lot ${lotNumber} — trying HTML slug fallback`);
    const canonicalUrl = await fetchSlugFromCopartHtml(lotNumber);
    if (canonicalUrl) {
      lot = parseFromUrlSlug(canonicalUrl, lotNumber);
      if (lot) {
        console.log(`[CopartAdapter] HTML slug fallback succeeded for lot ${lotNumber}: ${lot.make} ${lot.model}`);
      }
    }
  }

  if (!lot) {
    // All three paths exhausted — the lot genuinely doesn't exist or Copart is
    // blocking all access. A clean 404 is far better than a null-data shell that
    // produces a garbled analysis and confuses users.
    throw new AuctionLotNotFoundError(lotNumber);
  }

  return lot;
}

async function fetchByUrl(url: string): Promise<NormalizedAuctionLot> {
  const lotNumber = extractLotNumberFromUrl(url);
  if (!lotNumber) {
    throw new Error(`Could not extract lot number from URL: ${url}`);
  }

  // Race Copart API and Apify in parallel — same strategy as fetchByLot
  const [apiResult, apifyResult] = await Promise.all([
    fetchFromCopartApi(lotNumber),
    fetchFromApify(lotNumber),
  ]);
  let lot = apiResult ?? apifyResult;
  console.log(`[CopartAdapter] parallel fetch (url): api=${apiResult ? "ok" : "null"} apify=${apifyResult ? "ok" : "null"}`);

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
