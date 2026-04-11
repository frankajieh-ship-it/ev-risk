/**
 * VinAudit API Client
 *
 * Wraps two VinAudit APIs:
 *   1. Lite Check — theft, salvage, accident, and sale records (NMVTIS-based)
 *   2. Vehicle Images — professional stock images by VIN or YMM
 *
 * Both are used as the PRIMARY source; existing Auto.dev is the fallback.
 *
 * Env vars required:
 *   VINAUDIT_KEY      — API key
 *   VINAUDIT_USER     — username
 *   VINAUDIT_PASS     — password
 *   VINAUDIT_IMG_KEY  — separate key for Vehicle Images API (NV7FE3HD5VW5BUN demo)
 */

const VINAUDIT_BASE = "https://api.vinaudit.com/v2";
const VINAUDIT_IMG_BASE = "https://api.vinaudit.com";

// ---------------------------------------------------------------------------
// Lite Check types
// ---------------------------------------------------------------------------

export interface VinAuditTheftRecord {
  date?: string;
  status?: string;
  make?: string;
  model?: string;
  year?: string;
}

export interface VinAuditSalvageRecord {
  date?: string;
  source?: string;
  disposition?: string;
}

export interface VinAuditAccidentRecord {
  date?: string;
  source?: string;
  severity?: string;
  airbags_deployed?: string;
  damage_description?: string;
}

export interface VinAuditSaleRecord {
  date?: string;
  price?: string;
  odometer?: string;
  seller?: string;
  photo_urls?: string[];
}

export interface VinAuditLiteResult {
  success: true;
  vin: string;
  theft: VinAuditTheftRecord[];
  salvage: VinAuditSalvageRecord[];
  accidents: VinAuditAccidentRecord[];
  sales: VinAuditSaleRecord[];
  /** Derived summary flags for downstream use */
  summary: {
    theft_reported: boolean;
    salvage_reported: boolean;
    accident_count: number;
    sale_count: number;
  };
}

export interface VinAuditLiteError {
  success: false;
  error: string;
  code: "not_configured" | "api_error" | "not_found" | "timeout";
}

// ---------------------------------------------------------------------------
// Vehicle Images types
// ---------------------------------------------------------------------------

export interface VinAuditImagesResult {
  success: true;
  photo_urls: string[];
}

export interface VinAuditImagesError {
  success: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isConfigured(): boolean {
  return !!(
    process.env.VINAUDIT_KEY &&
    process.env.VINAUDIT_USER &&
    process.env.VINAUDIT_PASS
  );
}

function toArray<T>(val: T | T[] | null | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// ---------------------------------------------------------------------------
// Lite Check
// ---------------------------------------------------------------------------

/**
 * Run a VinAudit Lite Check for a given VIN.
 * Returns theft, salvage, accident, and sale history.
 * Returns VinAuditLiteError if not configured or on API failure.
 */
export async function liteCheck(
  vin: string
): Promise<VinAuditLiteResult | VinAuditLiteError> {
  if (!isConfigured()) {
    return {
      success: false,
      error: "VinAudit not configured",
      code: "not_configured",
    };
  }

  const url = new URL(`${VINAUDIT_BASE}/pullreport`);
  url.searchParams.set("format", "json");
  url.searchParams.set("key", process.env.VINAUDIT_KEY!);
  url.searchParams.set("user", process.env.VINAUDIT_USER!);
  url.searchParams.set("pass", process.env.VINAUDIT_PASS!);
  url.searchParams.set("mode", "lite");
  url.searchParams.set("vin", vin.toUpperCase());

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return {
      success: false,
      error: isAbort ? "VinAudit timed out" : "VinAudit unavailable",
      code: "timeout",
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `VinAudit API error: ${response.status}`,
      code: "api_error",
    };
  }

  const data = await response.json();

  // VinAudit returns { success: true/false, ... } at the top level
  if (data.success === false || data.error) {
    return {
      success: false,
      error: data.error || data.message || "VinAudit returned no data",
      code: "not_found",
    };
  }

  // Parse records — VinAudit may return single objects or arrays
  const theft = toArray<VinAuditTheftRecord>(data.theft?.record ?? data.theft);
  const salvage = toArray<VinAuditSalvageRecord>(data.salvage?.record ?? data.salvage);
  const accidents = toArray<VinAuditAccidentRecord>(
    data.accident?.record ?? data.accidents?.record ?? data.accidents
  );

  // Sales may include photo_urls nested under each record
  const rawSales = toArray<VinAuditSaleRecord>(data.sale?.record ?? data.sales?.record ?? data.sales);
  const sales = rawSales.map((s) => {
    const sAny = s as unknown as Record<string, unknown>;
    const photos = sAny.photos as { url?: string | string[] } | undefined;
    return {
      ...s,
      photo_urls: toArray<string>(photos?.url ?? sAny.photo_url),
    };
  });

  return {
    success: true,
    vin: vin.toUpperCase(),
    theft,
    salvage,
    accidents,
    sales,
    summary: {
      theft_reported: theft.length > 0,
      salvage_reported: salvage.length > 0,
      accident_count: accidents.length,
      sale_count: sales.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Vehicle Images
// ---------------------------------------------------------------------------

/**
 * Fetch professional vehicle images from VinAudit by VIN or YMM.
 * Returns up to `limit` photo URLs.
 */
export async function getVehicleImages(params: {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  limit?: number;
}): Promise<VinAuditImagesResult | VinAuditImagesError> {
  const imgKey = process.env.VINAUDIT_IMG_KEY;
  if (!imgKey) {
    return { success: false, error: "VinAudit Images key not configured" };
  }

  const { vin, year, make, model, trim, limit = 6 } = params;

  const url = new URL(`${VINAUDIT_IMG_BASE}/query`);
  url.searchParams.set("format", "json");
  url.searchParams.set("key", imgKey);

  if (vin) {
    url.searchParams.set("vin", vin.toUpperCase());
  } else {
    if (year) url.searchParams.set("year", String(year));
    if (make) url.searchParams.set("make", make);
    if (model) url.searchParams.set("model", model);
    if (trim) url.searchParams.set("trim", trim);
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
  } catch {
    return { success: false, error: "VinAudit Images unavailable" };
  }

  if (!response.ok) {
    return { success: false, error: `VinAudit Images API error: ${response.status}` };
  }

  const data = await response.json();

  if (!data || data.success === false) {
    return { success: false, error: data?.error || "No images found" };
  }

  // Response shape: { images: { image: [{ url }] | { url } } } or similar
  const rawImages = data.images?.image ?? data.images ?? [];
  const imageList = toArray<{ url?: string } | string>(rawImages);

  const photo_urls: string[] = [];
  for (const img of imageList) {
    const photoUrl = typeof img === "string" ? img : img?.url;
    if (photoUrl && photo_urls.length < limit) {
      photo_urls.push(photoUrl);
    }
  }

  return { success: true, photo_urls };
}
