/**
 * Marketcheck API Client
 *
 * Used to fetch listing photos and vehicle data by VIN.
 * Primary use: reliable photo extraction as an alternative to HTML scraping.
 *
 * Env var required: MARKETCHECK_API_KEY
 * Base URL: https://mc-api.marketcheck.com/v2
 */

const MC_BASE = "https://mc-api.marketcheck.com/v2";
const TIMEOUT_MS = 8000;

export interface MarketCheckListing {
  id: string;
  vin: string;
  heading?: string;
  price?: number;
  miles?: number;
  seller_type?: string;
  inventory_type?: string;
  exterior_color?: string;
  interior_color?: string;
  carfax_clean_title?: boolean;
  carfax_1_owner?: boolean;
  vdp_url?: string;
  source?: string;
  media?: {
    photo_links?: string[];
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    fuel_type?: string;
    transmission?: string;
    drivetrain?: string;
    highway_mpg?: number;
    city_mpg?: number;
    powertrain_type?: string;
  };
  dealer?: {
    name?: string;
    city?: string;
    state?: string;
  };
}

export interface MarketCheckResult {
  success: true;
  listings: MarketCheckListing[];
  photo_links: string[];
  best_listing: MarketCheckListing | null;
}

export interface MarketCheckError {
  success: false;
  error: string;
}

function isConfigured(): boolean {
  return !!process.env.MARKETCHECK_API_KEY;
}

/**
 * Search active listings by VIN. Returns photo_links from the best match.
 * Falls back gracefully — never throws.
 */
export async function searchByVin(
  vin: string
): Promise<MarketCheckResult | MarketCheckError> {
  if (!isConfigured()) {
    return { success: false, error: "Marketcheck not configured" };
  }

  const url = new URL(`${MC_BASE}/search/car/active`);
  url.searchParams.set("api_key", process.env.MARKETCHECK_API_KEY!);
  url.searchParams.set("vin", vin.toUpperCase());
  url.searchParams.set("include_extra", "true");
  url.searchParams.set("rows", "5");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[Marketcheck] VIN search failed: ${res.status}`, text.slice(0, 200));
      return { success: false, error: `Marketcheck API error: ${res.status}` };
    }

    const data = await res.json() as { num_found?: number; listings?: MarketCheckListing[] };
    const listings = data.listings ?? [];

    if (!listings.length) {
      return { success: false, error: "No listings found for this VIN" };
    }

    // Prefer used inventory with the most photos
    const sorted = [...listings].sort((a, b) => {
      const aPhotos = a.media?.photo_links?.length ?? 0;
      const bPhotos = b.media?.photo_links?.length ?? 0;
      return bPhotos - aPhotos;
    });

    const best = sorted[0];
    const photo_links = best.media?.photo_links ?? [];

    console.log(`[Marketcheck] VIN ${vin}: found ${listings.length} listing(s), ${photo_links.length} photos`);

    return {
      success: true,
      listings,
      photo_links,
      best_listing: best,
    };
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    const msg = isAbort ? "Marketcheck timed out" : (err instanceof Error ? err.message : "Unknown error");
    console.warn("[Marketcheck] Error:", msg);
    return { success: false, error: msg };
  }
}

// Make aliases — Marketcheck requires exact OEM brand names.
const MC_MAKE_ALIASES: Record<string, string> = {
  "mercedes":        "Mercedes-Benz",
  "mercedes benz":   "Mercedes-Benz",
  "vw":              "Volkswagen",
  "chevy":           "Chevrolet",
  "bmw":             "BMW",
  "gm":              "GMC",
  "land rover":      "Land Rover",
  "alfa romeo":      "Alfa Romeo",
  "aston martin":    "Aston Martin",
};

function normalizeMakeForMarketcheck(make: string): string {
  return MC_MAKE_ALIASES[make.toLowerCase()] ?? make;
}

/**
 * Generate candidate model strings to try against Marketcheck, from most-specific to least.
 * Marketcheck build.model is just the base name (e.g. "bZ4X", "Model X", "EQE") — trim
 * levels, drivetrain suffixes, and performance badges are not part of it.
 *
 * Strategy: strip the make prefix, then yield progressively shorter versions by
 * dropping the last word one at a time. Stop at 1 word minimum.
 * E.g. "bZ4X XLE FWD" → ["bZ4X XLE FWD", "bZ4X XLE", "bZ4X"]
 */
function modelCandidates(make: string, model: string): string[] {
  let m = model.trim();
  // Strip make prefix (e.g. "Toyota bZ4X XLE FWD" → "bZ4X XLE FWD")
  if (m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }
  const candidates: string[] = [];
  const words = m.split(" ").filter(Boolean);
  // Yield from full string down to 1 word
  for (let len = words.length; len >= 1; len--) {
    candidates.push(words.slice(0, len).join(" "));
  }
  // Deduplicate while preserving order
  return [...new Set(candidates)];
}

/**
 * Search active listings by make/model/year — fallback when no VIN is available.
 * Returns photo_links from the listing with the most photos.
 */
export async function searchByMakeModel(params: {
  make: string;
  model: string;
  year?: number;
}): Promise<MarketCheckResult | MarketCheckError> {
  if (!isConfigured()) {
    return { success: false, error: "Marketcheck not configured" };
  }

  const normalizedMake = normalizeMakeForMarketcheck(params.make);
  // Cap at 4 candidates to limit parallel API requests
  const candidates = modelCandidates(params.make, params.model).slice(0, 4);

  // Fire all model candidates in parallel — take the most-specific one with results.
  // Marketcheck model param must be an exact base model name ("bZ4X", not "bZ4X XLE FWD").
  // Parallel avoids the latency of sequential retries.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        const url = new URL(`${MC_BASE}/search/car/active`);
        url.searchParams.set("api_key", process.env.MARKETCHECK_API_KEY!);
        url.searchParams.set("make", normalizedMake);
        url.searchParams.set("model", candidate);
        if (params.year) url.searchParams.set("year", String(params.year));
        url.searchParams.set("inventory_type", "used");
        url.searchParams.set("rows", "10");
        try {
          const res = await fetch(url.toString(), { signal: controller.signal });
          if (!res.ok) return { candidate, listings: [] as MarketCheckListing[] };
          const data = await res.json() as { listings?: MarketCheckListing[] };
          return { candidate, listings: data.listings ?? [] };
        } catch {
          return { candidate, listings: [] as MarketCheckListing[] };
        }
      })
    );
    clearTimeout(timeout);

    // Pick the most-specific candidate (earliest in array) that has results
    const winner = results.find((r) => r.listings.length > 0);
    if (!winner) return { success: false, error: "No listings found for any model candidate" };

    const sorted = [...winner.listings].sort((a, b) =>
      (b.media?.photo_links?.length ?? 0) - (a.media?.photo_links?.length ?? 0)
    );
    const best = sorted[0];
    const photo_links = best.media?.photo_links ?? [];

    console.log(`[Marketcheck] YMM ${params.year} ${normalizedMake} "${winner.candidate}" (raw: "${params.model}"): ${winner.listings.length} listings, ${photo_links.length} photos`);
    return { success: true, listings: winner.listings, photo_links, best_listing: best };
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return { success: false, error: isAbort ? "Marketcheck timed out" : (err instanceof Error ? err.message : "Unknown error") };
  }
}

/**
 * Decode VIN specs — year/make/model/trim/fuel_type/powertrain_type.
 * Useful as a lightweight alternative to NHTSA when Marketcheck is already being called.
 */
export async function decodeVin(
  vin: string
): Promise<{ success: true; specs: Record<string, unknown> } | { success: false; error: string }> {
  if (!isConfigured()) {
    return { success: false, error: "Marketcheck not configured" };
  }

  const url = new URL(`${MC_BASE}/decode/car/${vin.toUpperCase()}/specs`);
  url.searchParams.set("api_key", process.env.MARKETCHECK_API_KEY!);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { success: false, error: `Marketcheck decode error: ${res.status}` };
    const specs = await res.json() as Record<string, unknown>;
    return { success: true, specs };
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return { success: false, error: isAbort ? "Marketcheck timed out" : (err instanceof Error ? err.message : "Unknown error") };
  }
}
