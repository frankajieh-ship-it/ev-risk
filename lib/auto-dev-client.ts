/**
 * Auto.dev API Client
 *
 * Free tier endpoints used:
 *   GET /api/vin/:vin        — VIN decode (make/model/trim/engine/mpg/price)
 *   GET /api/listings        — Market listings with photos
 *
 * Paid tier (future, behind Buyer Pass):
 *   Recalls, specs, cost of ownership, plate-to-VIN, taxes & fees
 *
 * Docs: https://auto.dev
 * Auth: Bearer token via AUTODEV_API env var
 */

const BASE_URL = "https://auto.dev/api";
const API_KEY = process.env.AUTODEV_API;

// --- Response types ---

export interface AutoDevVinResult {
  make?: string | { name?: string };
  model?: string | { name?: string };
  trim?: string;
  year?: number;
  modelYear?: string | number;
  engine?: {
    type?: string;
    fuelType?: string;
    horsepower?: number;
    cylinder?: number;
    size?: number;
    configuration?: string;
  };
  transmission?: {
    transmissionType?: string;
    numberOfSpeeds?: string;
  };
  drivenWheels?: string;
  categories?: {
    primaryBodyType?: string;
    vehicleSize?: string;
    vehicleStyle?: string;
    epaClass?: string;
  };
  mpg?: {
    highway?: string;
    city?: string;
  };
  price?: {
    baseMsrp?: number;
    usedTmvRetail?: number;
    usedPrivateParty?: number;
  };
  matchingType?: string;
  years?: Array<{ id?: number; year?: number }>;
}

export interface AutoDevListing {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  priceUnformatted?: number;
  mileageUnformatted?: number;
  condition?: string;
  city?: string;
  state?: string;
  dealerName?: string;
  primaryPhotoUrl?: string | null;
  photoUrls?: string[];
  thumbnailUrl?: string;
  thumbnailUrlLarge?: string;
  recentPriceDrop?: boolean;
  eligibleForFinancing?: boolean;
}

export interface AutoDevListingsResult {
  totalCount?: number;
  records?: AutoDevListing[];
}

export interface AutoDevEnrichment {
  /** VIN decode data — specs from NHTSA / Edmunds */
  vin_data?: AutoDevVinResult;
  /** Photo URLs from market listings (up to 5) */
  photo_urls: string[];
  /** Market comps from Auto.dev listings */
  market_price_range?: {
    low: number;
    high: number;
    count: number;
  };
  /** Source of enrichment */
  source: "vin_decode" | "listings_search" | "both" | "none";
}

// --- Helpers ---

function authHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: authHeaders(), signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// --- Public API ---

/**
 * Decode a VIN using Auto.dev.
 * Returns null on any failure (network, not-found, etc.)
 */
export async function decodeVin(vin: string): Promise<AutoDevVinResult | null> {
  if (!API_KEY) return null;
  if (!vin || vin.length !== 17) return null;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/vin/${encodeURIComponent(vin)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status === "NOT_FOUND" || data?.errorType) return null;
    return data as AutoDevVinResult;
  } catch {
    return null;
  }
}

/**
 * Search market listings by VIN or make/model/year.
 * Returns photos + price range. Returns null on failure.
 */
export async function searchListings(params: {
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  limit?: number;
}): Promise<AutoDevListingsResult | null> {
  if (!API_KEY) return null;

  const qs = new URLSearchParams();
  if (params.vin) qs.set("vin", params.vin);
  if (params.make) qs.set("make", params.make);
  if (params.model) qs.set("model", params.model);
  if (params.year) qs.set("year", String(params.year));
  qs.set("limit", String(params.limit ?? 10));

  if (!params.vin && !params.make) return null;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/listings?${qs.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data as AutoDevListingsResult;
  } catch {
    return null;
  }
}

/**
 * Main enrichment function — given VIN + optional make/model/year,
 * fetches VIN decode + listing photos in parallel.
 *
 * Always resolves (never throws). Falls back gracefully.
 * Designed to run within a 6s budget.
 */
export async function enrichFromAutodev(params: {
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
}): Promise<AutoDevEnrichment> {
  if (!API_KEY) {
    return { photo_urls: [], source: "none" };
  }

  const { vin, make, model, year } = params;

  // Run VIN decode + listings search in parallel
  const [vinResult, listingsResult] = await Promise.all([
    vin ? decodeVin(vin) : Promise.resolve(null),
    searchListings({ vin, make, model, year, limit: 8 }),
  ]);

  // Collect photo URLs from listings — strict make+model+year filtering to prevent
  // wrong-car images from fuzzy Auto.dev search results.
  const photoUrls: string[] = [];
  if (listingsResult?.records) {
    const expectedMake = make?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    const modelWords = model
      ? model.toLowerCase().split(" ").filter((w) => w.length > 1)
      : [];

    for (const record of listingsResult.records) {
      // Exact make match (normalized, no punctuation)
      if (expectedMake && record.make) {
        const recordMake = record.make.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (recordMake !== expectedMake) continue;
      }
      // All significant model words must appear in the record's model string
      if (modelWords.length > 0 && record.model) {
        const recordModel = record.model.toLowerCase();
        if (!modelWords.every((w) => recordModel.includes(w))) continue;
      }
      // Year within ±2 to block completely wrong-era listings
      if (year && record.year && Math.abs(Number(record.year) - year) > 2) continue;

      if (record.primaryPhotoUrl && !photoUrls.includes(record.primaryPhotoUrl)) {
        photoUrls.push(record.primaryPhotoUrl);
      }
      if (record.photoUrls) {
        for (const url of record.photoUrls) {
          if (!photoUrls.includes(url)) photoUrls.push(url);
        }
      }
      if (photoUrls.length >= 6) break;
    }
  }

  // Compute market price range from listings
  let market_price_range: AutoDevEnrichment["market_price_range"] | undefined;
  if (listingsResult?.records && listingsResult.records.length > 0) {
    const prices = listingsResult.records
      .map((r) => r.priceUnformatted)
      .filter((p): p is number => typeof p === "number" && p > 1000);
    if (prices.length > 0) {
      market_price_range = {
        low: Math.min(...prices),
        high: Math.max(...prices),
        count: prices.length,
      };
    }
  }

  const source: AutoDevEnrichment["source"] =
    vinResult && listingsResult ? "both"
    : vinResult ? "vin_decode"
    : listingsResult ? "listings_search"
    : "none";

  return {
    vin_data: vinResult ?? undefined,
    photo_urls: photoUrls,
    market_price_range,
    source,
  };
}
