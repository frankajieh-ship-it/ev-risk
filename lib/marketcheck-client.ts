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

// Suffixes to strip from model strings before querying Marketcheck.
// Marketcheck model param is an exact match against build.model, which is just the base name.
const MC_TRIM_SUFFIXES = [
  // Powertrain / range
  " long range", " standard range plus", " standard range", " extended range",
  " dual motor", " tri motor", " single motor",
  // Performance
  " performance", " plaid+", " plaid",
  // Drivetrain
  " all-wheel drive", " rear-wheel drive", " front-wheel drive",
  " awd", " rwd", " fwd", " 4wd",
  // Tesla-specific
  " p100d", " p90d", " p85d", " p85+", " p85",
  " 100d", " 90d", " 85d", " 75d", " 70d", " 60d",
  // Mercedes trim words
  " amg 4matic+", " amg 4matic", " amg line", " amg",
  " 4matic+", " 4matic",
  " e-cell plus", " e-cell",
  // BMW / others
  " xdrive50", " xdrive40", " xdrive", " edrive40", " edrive",
  " m50", " m60",
  // Generic trim words
  " premium", " select", " limited", " gt", " plus", " pro", " base",
  // Body styles
  " suv", " sedan", " hatchback", " coupe", " wagon",
  // Electric
  " electric", " ev",
];

function normalizeModelForMarketcheck(make: string, model: string): string {
  let m = model.trim();
  // Strip make prefix (e.g. "Tesla Model X Long Range" → "Model X Long Range")
  if (m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }
  // Strip trim suffixes until no more match
  let changed = true;
  while (changed) {
    changed = false;
    const mLower = m.toLowerCase();
    for (const suffix of MC_TRIM_SUFFIXES) {
      if (mLower.endsWith(suffix)) {
        m = m.slice(0, m.length - suffix.length).trim();
        changed = true;
        break;
      }
    }
  }
  return m;
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
  const normalizedModel = normalizeModelForMarketcheck(params.make, params.model);

  const url = new URL(`${MC_BASE}/search/car/active`);
  url.searchParams.set("api_key", process.env.MARKETCHECK_API_KEY!);
  url.searchParams.set("make", normalizedMake);
  url.searchParams.set("model", normalizedModel);
  if (params.year) url.searchParams.set("year", String(params.year));
  url.searchParams.set("inventory_type", "used");
  url.searchParams.set("rows", "10");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { success: false, error: `Marketcheck API error: ${res.status}` };

    const data = await res.json() as { num_found?: number; listings?: MarketCheckListing[] };
    const listings = data.listings ?? [];
    if (!listings.length) return { success: false, error: "No listings found" };

    const sorted = [...listings].sort((a, b) =>
      (b.media?.photo_links?.length ?? 0) - (a.media?.photo_links?.length ?? 0)
    );
    const best = sorted[0];
    const photo_links = best.media?.photo_links ?? [];

    console.log(`[Marketcheck] YMM ${params.year} ${normalizedMake} ${normalizedModel} (raw: ${params.make} ${params.model}): ${listings.length} listing(s), ${photo_links.length} photos`);
    return { success: true, listings, photo_links, best_listing: best };
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
