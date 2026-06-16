/**
 * Vehicle Listing Scraper
 *
 * Extracts vehicle data from marketplace URLs (AutoTrader, CarGurus, etc.)
 * Handles partial data gracefully and returns structured information
 */

/**
 * Autofill failure reason enum for analytics
 * Used to track why autofill fails to help prioritize improvements
 */
export type AutofillFailureReason =
  | "invalid_url"           // URL doesn't parse as valid URL
  | "unsupported_domain"    // Domain not in supported list
  | "search_page"           // User pasted search results, not individual listing
  | "blocked_by_bot_protection" // Akamai, Cloudflare, etc. blocked us
  | "listing_sold"          // Listing is sold or no longer available
  | "timeout"               // Request took too long
  | "http_error"            // Non-200 response status
  | "parse_failure"         // HTML parsing failed to extract data
  | "empty_response"        // Got HTML but couldn't extract any fields
  | "network_error"         // Connection/DNS/SSL failure
  | "unknown";              // Catch-all for unexpected errors

export interface AutofillDiagnostics {
  failureReason: AutofillFailureReason | null;
  domain: string | null;
  httpStatus?: number;
  extractedFieldCount: number;
  fetchMethod: "proxy" | "direct" | null;
  durationMs: number;
  proxyStatusCode?: number;
  directStatusCode?: number;
  botProtectionDetected?: boolean;
  botProtectionType?: string;
  proxyDurationMs?: number;
  directDurationMs?: number;
  parseDurationMs?: number;
  htmlLength?: number;
  errorMessage?: string;
}

export interface VehicleData {
  // Extracted data
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  price?: number;
  vin?: string;
  location?: string;

  // EV-specific specs
  range_mi?: number;
  battery_kwh?: number;
  dc_fast_kw?: number;
  efficiency_mi_per_kwh?: number;

  // Raw text from the page (first 5000 chars, stripped of HTML tags)
  raw_text?: string;

  // Exterior color
  color?: string;

  // Primary photo URL extracted from listing page
  photo_url?: string;
  // Full photo gallery from listing (up to 50 images)
  photo_urls?: string[];

  // Title and accident status extracted from listing text
  title_status?: "clean" | "salvage" | "rebuilt" | "unknown";
  accidents_reported?: "yes" | "no" | "unknown";
  owners?: number;

  // Data quality tracking
  dataSource: 'autotrader' | 'cargurus' | 'cars.com' | 'carvana' | 'facebook' | 'carfax' | 'truecar' | 'edmunds' | 'kbb' | 'vroom' | 'carmax' | 'autotempest' | 'hemmings' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  extractedFields: string[];
  missingFields: string[];
}

export interface ExtractionResult {
  success: boolean;
  data: VehicleData | null;
  error?: string;
  warnings: string[];
  diagnostics?: AutofillDiagnostics;
}

/**
 * Detects the listing source from URL
 */
export function detectListingSource(url: string): VehicleData['dataSource'] {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('autotrader.com')) return 'autotrader';
  if (urlLower.includes('cargurus.com')) return 'cargurus';
  if (urlLower.includes('cars.com')) return 'cars.com';
  if (urlLower.includes('carvana.com')) return 'carvana';
  if (urlLower.includes('facebook.com/marketplace') || urlLower.includes('fbmarketplace')) return 'facebook';
  if (urlLower.includes('carfax.com')) return 'carfax';
  if (urlLower.includes('truecar.com')) return 'truecar';
  if (urlLower.includes('edmunds.com')) return 'edmunds';
  if (urlLower.includes('kbb.com')) return 'kbb';
  if (urlLower.includes('vroom.com')) return 'vroom';
  if (urlLower.includes('carmax.com')) return 'carmax';
  if (urlLower.includes('autotempest.com')) return 'autotempest';
  if (urlLower.includes('hemmings.com')) return 'hemmings';

  return 'unknown';
}

/**
 * Type definition for data sources
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type DataSource = 'autotrader' | 'cargurus' | 'cars.com' | 'carvana' | 'facebook' | 'carfax' | 'truecar' | 'edmunds' | 'kbb' | 'vroom' | 'carmax' | 'autotempest' | 'hemmings' | 'unknown';

/**
 * Checks if URL is a search/listing page vs individual vehicle page
 */
function isSearchPage(url: string): boolean {
  const urlLower = url.toLowerCase();

  // AutoTrader search pages (exclude individual vehicle pages)
  if (urlLower.includes('autotrader.com')) {
    // Individual vehicle pages have /vehicledetails.xhtml or /vehicle/XXXXXX or listingId=
    const hasVehicleDetails = urlLower.includes('vehicledetails');
    const hasVehicleId = /\/vehicle\/\d+/.test(urlLower);
    const hasListingId = /listingid=/i.test(urlLower);

    if (!hasVehicleDetails && !hasVehicleId && !hasListingId &&
        (urlLower.includes('/cars-for-sale/') || urlLower.includes('searchresults'))) {
      return true;
    }
  }

  // CarGurus search pages
  if (urlLower.includes('cargurus.com')) {
    // Individual pages have /details/ or /listing/
    if (urlLower.includes('/details/') || urlLower.includes('/listing/')) {
      return false;
    }
    // Search pages have /shopping/results or /Cars/
    if (urlLower.includes('/shopping/results') || urlLower.includes('/cars/')) {
      return true;
    }
  }

  // Cars.com search pages
  if (urlLower.includes('cars.com')) {
    if (urlLower.includes('/vehicledetail/')) {
      return false; // Individual listing
    }
    if (urlLower.includes('/for-sale/search') || urlLower.includes('/for-sale/searchresults')) {
      return true; // Search page
    }
  }

  return false;
}

/**
 * Extract structured data from JSON-LD (works across all marketplaces)
 * This is the most reliable extraction method when available
 */
function extractStructuredData(html: string): Partial<VehicleData> {
  const data: Partial<VehicleData> = {};

  // Try to extract JSON-LD data (most reliable)
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      try {
        const jsonMatch = match.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1].trim();
          const jsonData = JSON.parse(jsonStr);

          // Check if it's vehicle data
          if (jsonData['@type'] === 'Vehicle' || jsonData['@type'] === 'Car' ||
              (Array.isArray(jsonData['@type']) && (jsonData['@type'].includes('Vehicle') || jsonData['@type'].includes('Car')))) {

            // Extract vehicle name/model
            if (jsonData.name) {
              const nameMatch = jsonData.name.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+?)(?:\s+([\w\s]+))?$/i);
              if (nameMatch) {
                data.year = data.year || parseInt(nameMatch[1]);
                data.make = data.make || nameMatch[2];
                data.model = data.model || nameMatch[3].trim();
                if (nameMatch[4]) data.trim = nameMatch[4].trim();
              }
            }

            // Extract individual fields
            data.year = data.year || jsonData.productionDate || jsonData.modelDate || jsonData.vehicleModelDate;
            data.make = data.make || jsonData.manufacturer?.name || jsonData.brand?.name;
            data.model = data.model || jsonData.model;
            data.trim = data.trim || jsonData.trim || jsonData.vehicleTrim;

            // Extract mileage
            if (jsonData.mileageFromOdometer) {
              if (typeof jsonData.mileageFromOdometer === 'object') {
                data.mileage = jsonData.mileageFromOdometer.value;
              } else if (typeof jsonData.mileageFromOdometer === 'string') {
                const mileageMatch = jsonData.mileageFromOdometer.match(/(\d+)/);
                if (mileageMatch) data.mileage = parseInt(mileageMatch[1]);
              }
            }

            // Extract price
            if (jsonData.offers) {
              if (Array.isArray(jsonData.offers)) {
                data.price = data.price || jsonData.offers[0]?.price;
              } else {
                data.price = data.price || jsonData.offers.price || jsonData.offers.lowPrice;
              }
            }
            data.price = data.price || jsonData.price;

            // Extract VIN
            data.vin = data.vin || jsonData.vehicleIdentificationNumber;
          }
        }
      } catch (e) {
        // Silently continue to next JSON-LD block
        console.log('[Structured Data] Failed to parse JSON-LD block:', e);
      }
    }
  }

  return data;
}

/**
 * Validate extracted data for reasonableness
 */
function validateVehicleData(data: Partial<VehicleData>): Partial<VehicleData> {
  const validated = { ...data };

  // Year validation
  if (validated.year) {
    const currentYear = new Date().getFullYear();
    if (validated.year < 1900 || validated.year > currentYear + 1) {
      console.warn('[Validation] Invalid year:', validated.year);
      delete validated.year;
    }
  }

  // Mileage validation
  if (validated.mileage) {
    if (validated.mileage < 0 || validated.mileage > 500000) {
      console.warn('[Validation] Suspicious mileage:', validated.mileage);
      // Don't delete, but flag it
    }
  }

  // Price validation
  if (validated.price) {
    if (validated.price < 100 || validated.price > 5000000) {
      console.warn('[Validation] Suspicious price:', validated.price);
      // Don't delete, but flag it
    }
  }

  // VIN validation
  if (validated.vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(validated.vin)) {
    console.warn('[Validation] Invalid VIN format:', validated.vin);
    delete validated.vin;
  }

  return validated;
}

/**
 * Extracts vehicle data from AutoTrader URL
 *
 * AutoTrader URL patterns:
 * - https://www.autotrader.com/cars-for-sale/vehicledetails.xhtml?listingId=XXX
 * - https://www.autotrader.com/cars-for-sale/vehicle/XXXXXXXX
 * - Contains structured data in HTML meta tags
 */
async function extractFromAutoTrader(html: string, url?: string): Promise<Partial<VehicleData>> {
  const data: Partial<VehicleData> = {};

  // --- Primary: __eggsState.inventory[listingId] (AutoTrader's Next.js state) ---
  const ndMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (ndMatch) {
    try {
      const nd = JSON.parse(ndMatch[1]) as Record<string, unknown>;
      const pageProps = (nd?.props as Record<string, unknown>)?.pageProps as Record<string, unknown> | undefined;
      const eggsState = pageProps?.__eggsState as Record<string, unknown> | undefined;
      const inventory = eggsState?.inventory as Record<string, Record<string, unknown>> | undefined;

      // Determine listing ID: prefer URL param, fall back to first key in inventory
      let listingId: string | undefined;
      if (url) {
        const m = url.match(/[?&]listingId=(\d+)/) || url.match(/\/vehicle\/(\d+)/);
        if (m) listingId = m[1];
      }
      if (!listingId && inventory) listingId = Object.keys(inventory)[0];

      const inv = listingId && inventory ? inventory[listingId] : null;
      if (inv) {
        // year
        data.year = typeof inv.year === 'number' ? inv.year : undefined;

        // make / model / trim — objects with { code, name }
        const makeObj = inv.make as { name?: string } | string | undefined;
        data.make = typeof makeObj === 'object' ? makeObj?.name : (makeObj as string | undefined);
        const modelObj = inv.model as { name?: string } | string | undefined;
        data.model = typeof modelObj === 'object' ? modelObj?.name : (modelObj as string | undefined);
        const trimObj = (inv.trim || inv.atTrim) as { name?: string } | string | undefined;
        data.trim = typeof trimObj === 'object' ? trimObj?.name : (trimObj as string | undefined);

        // mileage — { label: "Mileage", value: "12,345" }
        const mileObj = inv.mileage as { value?: string } | number | undefined;
        if (typeof mileObj === 'object' && mileObj?.value) {
          const mv = parseInt(String(mileObj.value).replace(/,/g, ''), 10);
          if (mv >= 0 && mv <= 500_000) data.mileage = mv;
        } else if (typeof mileObj === 'number') {
          data.mileage = mileObj;
        }

        // price — pricingDetail.salePrice or incentive
        const pricing = inv.pricingDetail as Record<string, unknown> | undefined;
        const salePrice = pricing?.salePrice ?? pricing?.incentive;
        if (typeof salePrice === 'number' && salePrice > 0) data.price = salePrice;

        // VIN
        if (typeof inv.vin === 'string' && /^[A-HJ-NPR-Z0-9]{17}$/i.test(inv.vin)) {
          data.vin = inv.vin;
        }

        // vhrPreview: ["NO_SALVAGE_TITLE","NO_ACCIDENTS_REPORTED","ONE_OWNER"] etc.
        const vhr = Array.isArray(inv.vhrPreview) ? inv.vhrPreview as string[] : [];
        if (vhr.includes('NO_SALVAGE_TITLE')) data.title_status = 'clean';
        else if (vhr.includes('SALVAGE_TITLE')) data.title_status = 'salvage';
        if (vhr.includes('NO_ACCIDENTS_REPORTED')) data.accidents_reported = 'no';
        else if (vhr.some((v: string) => v.includes('ACCIDENT'))) data.accidents_reported = 'yes';
        if (vhr.includes('ONE_OWNER')) data.owners = 1;

        // location from owner city/state
        const owner = inv.owner as Record<string, unknown> | undefined;
        const city = owner?.city as string | undefined;
        const state = owner?.state as string | undefined;
        if (city || state) data.location = [city, state].filter(Boolean).join(', ');
      }
    } catch { /* fall through to regex */ }
  }

  // --- Fallback: structured data + regex patterns ---
  if (!data.year || !data.make || !data.model) {
    const structured = extractStructuredData(html);
    if (!data.year) data.year = structured.year;
    if (!data.make) data.make = structured.make;
    if (!data.model) data.model = structured.model;
    if (!data.trim) data.trim = structured.trim;
    if (!data.vin) data.vin = structured.vin;
    if (!data.price) data.price = structured.price;
    if (!data.mileage) data.mileage = structured.mileage;
  }

  // Title fallback from window title: "Used 2024 Bentley Continental GT Speed for sale in..."
  if (!data.year || !data.make || !data.model) {
    const titleMatch = html.match(/"windowTitle"\s*:\s*"([^"]+)"/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].replace(/\\u[\dA-F]{4}/gi, '').replace(/\\n/g, ' ');
      const vm = title.match(/(?:Used\s+)?(\d{4})\s+([A-Za-z][A-Za-z\-]+)\s+([A-Za-z0-9][A-Za-z0-9\s\-]+?)\s+for\s+sale/i);
      if (vm) {
        if (!data.year) data.year = parseInt(vm[1]);
        if (!data.make) data.make = vm[2];
        if (!data.model) data.model = vm[3].trim();
      }
    }
  }

  // Price fallback regex
  if (!data.price) {
    const pm = html.match(/"salePrice"\s*:\s*(\d+)|"incentive"\s*:\s*(\d+)/);
    if (pm) data.price = parseInt(pm[1] || pm[2]);
  }

  // Mileage fallback
  if (!data.mileage) {
    const mm = html.match(/"mileage"\s*:\s*\{"[^"]+"\s*,\s*"value"\s*:\s*"([\d,]+)"/);
    if (mm) data.mileage = parseInt(mm[1].replace(/,/g, ''), 10);
  }

  // VIN fallback
  if (!data.vin) {
    const vm = html.match(/VIN["']?\s*:\s*["']?([A-HJ-NPR-Z0-9]{17})/i);
    if (vm) data.vin = vm[1];
  }

  // Title/accident fallback from visible text
  if (!data.title_status) {
    if (/clean\s+title/i.test(html)) data.title_status = 'clean';
    else if (/salvage\s+title/i.test(html)) data.title_status = 'salvage';
    else if (/rebuilt\s+title/i.test(html)) data.title_status = 'rebuilt';
  }
  if (!data.accidents_reported) {
    if (/no\s+accidents?\s+reported|0\s+accidents?\s+reported/i.test(html)) data.accidents_reported = 'no';
    else if (/(\d+)\s+accident[s]?\s+reported/i.test(html)) data.accidents_reported = 'yes';
  }
  if (!data.owners) {
    const om = html.match(/(\d+)\s+previous\s+owner/i);
    if (om) { const n = parseInt(om[1]); if (n > 0) data.owners = n; }
  }

  return validateVehicleData(data);
}

/**
 * Extracts vehicle data from CarGurus URL
 */
async function extractFromCarGurus(html: string): Promise<Partial<VehicleData>> {
  // Try structured data first
  const data = extractStructuredData(html);

  // CarGurus VDP (2024+): data is in Open Graph meta tags
  // og:title = "CarGurus - 2024 Dodge Charger Daytona Scat Pack AWD - $39,995"
  // og:description = "White with 1,647 miles. Automatic. ..."
  if (!data.year || !data.make || !data.model) {
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ||
                    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)?.[1];
    if (ogTitle) {
      // Strip "CarGurus - " prefix if present
      const cleaned = ogTitle.replace(/^CarGurus\s*[-–]\s*/i, '').trim();
      // "2024 Dodge Charger Daytona Scat Pack AWD - $39,995"
      const vehicleMatch = cleaned.match(/^(\d{4})\s+([A-Za-z\-]+)\s+(.+?)\s*(?:-\s*\$[\d,]+)?$/);
      if (vehicleMatch) {
        data.year = data.year || parseInt(vehicleMatch[1]);
        data.make = data.make || vehicleMatch[2];
        // model is everything between make and the price suffix
        const modelTrim = vehicleMatch[3].trim();
        if (!data.model) {
          // Known multi-word models indexed by make (lowercase)
          const MULTI_WORD_MODELS: Record<string, string[]> = {
            tesla: ['model s', 'model 3', 'model x', 'model y', 'roadster'],
            land: ['land rover', 'range rover'],
            alfa: ['alfa romeo'],
            aston: ['aston martin'],
            rolls: ['rolls royce'],
          };
          const makeLower = (data.make || vehicleMatch[2]).toLowerCase();
          const knownModels = MULTI_WORD_MODELS[makeLower] || [];
          const modelTrimLower = modelTrim.toLowerCase();
          const multiWordMatch = knownModels.find(m => modelTrimLower.startsWith(m));

          if (multiWordMatch) {
            data.model = modelTrim.slice(0, multiWordMatch.length);
            const rest = modelTrim.slice(multiWordMatch.length).trim();
            if (rest && !data.trim) data.trim = rest;
          } else {
            const modelParts = modelTrim.split(/\s+/);
            data.model = modelParts[0];
            if (modelParts.length > 1 && !data.trim) data.trim = modelParts.slice(1).join(' ');
          }
        }
      }
      // Extract price from og:title
      if (!data.price) {
        const priceMatch = cleaned.match(/\$\s*([\d,]+)/);
        if (priceMatch) data.price = parseInt(priceMatch[1].replace(/,/g, ''));
      }
    }
  }

  // og:description = "White with 1,647 miles. Automatic. ..."
  if (!data.mileage) {
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ||
                   html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)?.[1];
    if (ogDesc) {
      const milesMatch = ogDesc.match(/([\d,]+)\s+miles?/i);
      if (milesMatch) data.mileage = parseInt(milesMatch[1].replace(/,/g, ''));
    }
  }

  // CarGurus-specific: Try __NEXT_DATA__ extraction
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Navigate through the nested structure to find listing data
      const listing = nextData.props?.pageProps?.listing ||
                     nextData.props?.initialProps?.pageProps?.listing ||
                     nextData.props?.pageProps?.listingDetails;

      if (listing) {
        data.year = data.year || listing.year;
        data.make = data.make || listing.make;
        data.model = data.model || listing.model;
        data.trim = data.trim || listing.trim;
        data.price = data.price || listing.price || listing.listPrice;
        data.mileage = data.mileage || listing.mileage;
        data.vin = data.vin || listing.vin || listing.vehicleIdentificationNumber
          || listing.vehicle?.vin || listing.listingDetails?.vin;
        data.location = data.location || listing.dealer?.cityState || listing.dealerInfo?.cityState;

        // CarGurus nests history data under vehicleHistory / history / carHistory sub-object
        const hist = listing.vehicleHistory ?? listing.history ?? listing.carHistory ?? listing.vehicleReport ?? {};

        // Title status
        if (!data.title_status) {
          const rawTitle = (
            listing.titleStatus ?? listing.title_status ?? listing.titleHistory?.status ??
            hist.titleStatus ?? hist.title ?? hist.titleHistory?.status ?? ""
          ).toString().toLowerCase();
          if (rawTitle.includes("clean")) data.title_status = "clean";
          else if (rawTitle.includes("salvage")) data.title_status = "salvage";
          else if (rawTitle.includes("rebuilt") || rawTitle.includes("reconstructed")) data.title_status = "rebuilt";
        }

        // Accident history — top-level or inside vehicleHistory
        if (!data.accidents_reported) {
          const accCount =
            listing.accidentCount ?? listing.numberOfAccidents ?? listing.accidentsReported ??
            hist.accidentCount ?? hist.numberOfAccidents ?? hist.accidents;
          const hasAcc =
            listing.hasAccidents ?? listing.accidentHistory ??
            hist.hasAccidents ?? hist.accidentHistory;
          if (typeof accCount === "number") data.accidents_reported = accCount > 0 ? "yes" : "no";
          else if (typeof accCount === "string" && /^\d+$/.test(accCount)) data.accidents_reported = parseInt(accCount) > 0 ? "yes" : "no";
          else if (hasAcc === false || hasAcc === "NO_ACCIDENTS" || hasAcc === "NONE") data.accidents_reported = "no";
          else if (hasAcc === true || hasAcc === "HAS_ACCIDENTS") data.accidents_reported = "yes";
        }

        // Owner count — top-level or inside vehicleHistory
        if (!data.owners) {
          const ownerCount =
            listing.ownerCount ?? listing.numberOfOwners ?? listing.owners ??
            hist.ownerCount ?? hist.numberOfOwners ?? hist.owners;
          if (typeof ownerCount === "number" && ownerCount > 0) data.owners = ownerCount;
          else if (typeof ownerCount === "string" && /^\d+$/.test(ownerCount)) {
            const n = parseInt(ownerCount);
            if (n > 0) data.owners = n;
          }
        }

        // EV specs — CarGurus nests these under various keys
        const specs = listing.specs || listing.vehicleSpecs || listing.attributes || {};
        const fuelEcon = listing.fuelEconomy || listing.mpg || {};
        const evRange = listing.electricRange ?? listing.epaRange ?? listing.rangeElectric
          ?? specs.electricRange ?? specs.rangeElectric ?? specs.range;
        const battKwh = listing.batteryCapacityKwh ?? listing.batteryKwh ?? listing.usableBatteryKwh
          ?? specs.batteryCapacityKwh ?? specs.batteryKwh;
        const dcKw = listing.dcFastChargeKw ?? listing.maxDcChargingKw ?? listing.fastChargeKw
          ?? specs.dcFastChargeKw ?? specs.maxDcChargingKw;
        const mpge = listing.mpge ?? listing.mpgElectric ?? fuelEcon.mpge ?? fuelEcon.city;

        if (evRange && !data.range_mi) data.range_mi = Number(evRange);
        if (battKwh && !data.battery_kwh) data.battery_kwh = Number(battKwh);
        if (dcKw && !data.dc_fast_kw) data.dc_fast_kw = Number(dcKw);
        // Convert MPGe → mi/kWh (33.7 kWh per gallon equivalent)
        if (mpge && !data.efficiency_mi_per_kwh) {
          const eff = Math.round((Number(mpge) / 33.7) * 10) / 10;
          if (eff >= 1 && eff <= 10) data.efficiency_mi_per_kwh = eff;
        }

        // Extract full photo gallery from listing
        if (!data.photo_urls?.length) {
          // Accept vehicle photos from CarGurus CDN (static.cargurus.com/images/forsale/)
          const isCarGurusPhoto = (u: unknown): u is string =>
            typeof u === "string" && u.startsWith("https://") &&
            (u.includes("static.cargurus.com/images/forsale") || u.includes("cimg.cargurus.com") ||
             u.includes("dealer.com") || u.includes("homenet")) &&
            !u.includes("logo") && !u.includes("icon") && !u.includes("badge") && !u.includes("/site/");

          const extractUrl = (item: unknown): string | null => {
            if (typeof item === "string") return item;
            const o = item as Record<string, unknown>;
            return (o?.largeUrl ?? o?.fullSizeUrl ?? o?.large ?? o?.url ?? o?.src ?? o?.href ?? o?.mediumUrl ?? o?.medium ?? o?.thumbnailUrl ?? o?.small ?? null) as string | null;
          };

          const photoArr = listing.pictures ?? listing.pictureList ?? listing.allPhotos ?? listing.mediaList ?? listing.vehicleImages ?? listing.photos ?? listing.images ?? listing.vehiclePhotos ?? listing.photoUrls ?? [];
          const gallery: string[] = [];
          const seenPhotos = new Set<string>();
          if (Array.isArray(photoArr)) {
            for (const item of photoArr) {
              const raw = extractUrl(item);
              if (isCarGurusPhoto(raw)) {
                const norm = raw.split("?")[0];
                if (!seenPhotos.has(norm)) {
                  seenPhotos.add(norm);
                  gallery.push(raw);
                  if (gallery.length >= 50) break;
                }
              }
            }
          }
          // Single-photo fallbacks
          if (!gallery.length) {
            const single = extractUrl(listing.primaryPhoto ?? listing.mainPhoto
              ?? listing.primaryPhotoUrl ?? listing.heroPhoto ?? listing.coverPhoto);
            if (isCarGurusPhoto(single)) gallery.push(single);
          }
          if (gallery.length) {
            data.photo_urls = gallery;
            data.photo_url = gallery[0];
          }
        }
      }
    } catch (e) {
      console.log('[CarGurus] Failed to parse __NEXT_DATA__:', e);
    }

    // If VIN still missing, scan the raw __NEXT_DATA__ blob for any 17-char VIN value
    if (!data.vin) {
      const vinInJson = nextDataMatch[1].match(/"vin"\s*:\s*"([A-HJ-NPR-Z0-9]{17})"/i);
      if (vinInJson) data.vin = vinInJson[1].toUpperCase();
    }
  }

  // CarGurus migrated to Remix — try window.__remixContext for listing data / VIN + history fields
  {
    // Extract the full __remixContext JSON using a balanced-brace parser.
    // A non-greedy regex like /(\{[\s\S]*?\})/ stops at the first closing brace,
    // producing a truncated invalid JSON fragment that always throws on parse.
    let remixJson: string | null = null;
    const remixMarker = html.indexOf('window.__remixContext');
    if (remixMarker !== -1) {
      const braceStart = html.indexOf('{', remixMarker);
      if (braceStart !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;
        let end = braceStart;
        for (let i = braceStart; i < html.length; i++) {
          const ch = html[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (depth === 0) remixJson = html.slice(braceStart, end);
      }
    }
    if (remixJson) {
      try {
        const ctx = JSON.parse(remixJson);
        const loaderValues = Object.values(
          (ctx?.state?.loaderData ?? {}) as Record<string, unknown>
        );
        for (const loader of loaderValues) {
          const l = loader as Record<string, unknown>;
          // CarGurus Remix: listing is nested under .data.listing (not at root)
          const listing = (l?.data as Record<string, unknown>)?.listing ?? l?.listing ?? l?.listingData ?? l?.vehicleListing ?? l?.vehicle;
          if (listing && typeof listing === 'object') {
            const ls = listing as Record<string, unknown>;
            // CarGurus Remix: most fields are objects, not primitives
            const rawVin = ls.vin as (string | Record<string, unknown>) | undefined;
            const vinStr = typeof rawVin === "string" ? rawVin : (rawVin as Record<string, unknown>)?.value as string | undefined;
            data.vin = data.vin || vinStr || (ls.vehicleIdentificationNumber as string);
            // year/make/model/trim live under ontology in newer CarGurus Remix pages
            const onto = (ls.ontology ?? {}) as Record<string, unknown>;
            data.year = data.year || (onto.carYear as number) || (ls.year as number) || (ls.modelYear as number);
            data.make = data.make || (onto.makeName as string) || (ls.make as string);
            data.model = data.model || (onto.modelName as string) || (ls.model as string);
            data.trim = data.trim || (onto.trimName as string) || (ls.trim as string);
            // price and mileage are objects: { current, value }
            const rawPrice = ls.price as (number | Record<string, unknown>) | undefined;
            data.price = data.price || (typeof rawPrice === "number" ? rawPrice : (rawPrice as Record<string, unknown>)?.current as number) || (ls.listPrice as number);
            const rawMileage = ls.mileage as (number | Record<string, unknown>) | undefined;
            data.mileage = data.mileage || (typeof rawMileage === "number" ? rawMileage : (rawMileage as Record<string, unknown>)?.value as number) || (ls.odometer as number);
            // color is { exterior, interior }
            const rawColor = ls.color as (string | Record<string, unknown>) | undefined;
            if (!data.color) data.color = typeof rawColor === "string" ? rawColor : (rawColor as Record<string, unknown>)?.exterior as string | undefined;
            data.location = data.location || (ls.city && ls.state ? `${ls.city}, ${ls.state}` : undefined);

            // Title / accident / owner history — check vehicleHistory sub-object first
            const lsHist = (ls.vehicleHistory ?? ls.history ?? ls.carHistory ?? {}) as Record<string, unknown>;
            if (!data.title_status) {
              const rawTitle = ((ls.titleStatus ?? ls.title_status ?? lsHist.titleStatus ?? lsHist.title ?? "") as string).toLowerCase();
              if (rawTitle.includes("clean")) data.title_status = "clean";
              else if (rawTitle.includes("salvage")) data.title_status = "salvage";
              else if (rawTitle.includes("rebuilt") || rawTitle.includes("reconstructed")) data.title_status = "rebuilt";
            }
            if (!data.accidents_reported) {
              const accCount = ls.accidentCount ?? ls.numberOfAccidents ?? lsHist.accidentCount ?? lsHist.numberOfAccidents ?? lsHist.accidents;
              const hasAcc = ls.hasAccidents ?? lsHist.hasAccidents ?? lsHist.accidentHistory;
              if (typeof accCount === "number") data.accidents_reported = accCount > 0 ? "yes" : "no";
              else if (typeof accCount === "string" && /^\d+$/.test(accCount)) data.accidents_reported = parseInt(accCount) > 0 ? "yes" : "no";
              else if (hasAcc === false || hasAcc === "NO_ACCIDENTS" || hasAcc === "NONE") data.accidents_reported = "no";
              else if (hasAcc === true || hasAcc === "HAS_ACCIDENTS") data.accidents_reported = "yes";
            }
            if (!data.owners) {
              const ownerCount = ls.ownerCount ?? ls.numberOfOwners ?? ls.owners ?? lsHist.ownerCount ?? lsHist.numberOfOwners;
              if (typeof ownerCount === "number" && ownerCount > 0) data.owners = ownerCount;
              else if (typeof ownerCount === "string" && /^\d+$/.test(ownerCount)) {
                const n = parseInt(ownerCount); if (n > 0) data.owners = n;
              }
            }

            // Extract photo gallery from Remix context.
            // Always run and replace if this loader has more photos than what we've seen so far —
            // some loaders (e.g. root) return a 4-photo preview; the listing-specific loader has all of them.
            {
              const isCarGurusPhoto = (u: unknown): u is string =>
                typeof u === "string" && u.startsWith("https://") &&
                (u.includes("static.cargurus.com") || u.includes("cimg.cargurus.com") ||
                 u.includes("dealer.com") || u.includes("homenet") || u.includes("flximg.dealer.com") ||
                 u.includes("media.dealerire.com") || u.includes("img.vast.com") || u.includes("photos.ziftsolutions.com")) &&
                !u.includes("logo") && !u.includes("icon") && !u.includes("badge") && !u.includes("/site/");
              const photoKeys = Object.keys(ls).filter(k => Array.isArray(ls[k]) && (ls[k] as unknown[]).length > 0);
              console.log('[CarGurus Remix] Available array keys:', photoKeys.join(', '));
              const photoArr = (ls.pictures ?? ls.pictureList ?? ls.allPhotos ?? ls.mediaList ?? ls.vehicleImages ?? ls.photos ?? ls.images ?? ls.vehiclePhotos ?? ls.photoUrls ?? ls.imageList ?? ls.galleryPhotos ?? ls.carPhotos ?? []) as unknown[];
              console.log('[CarGurus Remix] photoArr length:', (photoArr as unknown[]).length, 'from key:', Object.keys(ls).find(k => ls[k] === photoArr) ?? 'unknown');
              const gallery: string[] = [];
              const seen = new Set<string>();
              if (Array.isArray(photoArr)) {
                for (const item of photoArr) {
                  const o = item as Record<string, unknown>;
                  const raw = typeof item === "string" ? item
                    : (o?.largeUrl ?? o?.fullSizeUrl ?? o?.large ?? o?.url ?? o?.src ?? o?.href ?? o?.mediumUrl ?? null);
                  if (isCarGurusPhoto(raw)) {
                    const norm = (raw as string).split("?")[0];
                    if (!seen.has(norm)) {
                      seen.add(norm);
                      gallery.push(raw as string);
                      if (gallery.length >= 50) break;
                    }
                  }
                }
              }
              console.log('[CarGurus Remix] Gallery extracted:', gallery.length, 'photos');
              // Replace stored photos only if this loader has more
              if (gallery.length > (data.photo_urls?.length ?? 0)) {
                data.photo_urls = gallery;
                data.photo_url = gallery[0];
              }
            }
          }
        }
      } catch { /* silent — Remix context parsing is best-effort */ }
    }
  }

  // HTML raw-scan for CarGurus — finds the 1024x768 variant of every pic in __remixContext.
  // CarGurus only embeds a preview set (4-6 pics) in __remixContext server-side, but all size
  // variants for ALL listing photos are present in the page HTML (in scaledPictures objects).
  // We collect ALL pic IDs already known from remixContext, then scan for more in the raw HTML —
  // but ONLY accept pic IDs that appear near the listing section, not recommendation widgets.
  // Strategy: collect pic IDs from current photo_urls (already extracted via remixContext), then
  // scan the HTML for large-size variants of those same IDs to get the 1024x768 URLs.
  // For pic IDs not yet seen, only accept them if they appear inside a "pictures" JSON key context.
  if (data.dataSource === 'cargurus' && html) {
    // Collect pic IDs we already have from remixContext
    const knownPicIds = new Set<string>();
    for (const u of (data.photo_urls ?? [])) {
      const m = u.match(/pic-(\d+)/);
      if (m) knownPicIds.add(m[1]);
    }

    // Scan the raw HTML for large-size variants, constrained to listing photos only.
    // "Listing photos" = pic IDs inside a "pictures":[...] JSON key, OR pic IDs we already know.
    // Build a set of pic IDs that appear inside a pictures array context.
    const listingPicIds = new Set<string>(knownPicIds);
    const picturesContextPattern = /"pictures"\s*:\s*\[[\s\S]*?\]/g;
    let pc: RegExpExecArray | null;
    while ((pc = picturesContextPattern.exec(html)) !== null) {
      const chunk = pc[0];
      let pm: RegExpExecArray | null;
      const pidPattern = /pic-(\d+)/g;
      while ((pm = pidPattern.exec(chunk)) !== null) {
        listingPicIds.add(pm[1]);
      }
    }

    const seen = new Set<string>();
    const gallery: string[] = [];
    const staticPattern = /https:\/\/static\.cargurus\.com\/images\/forsale\/[^"' \]\\>\s]*/g;
    let m: RegExpExecArray | null;
    while ((m = staticPattern.exec(html)) !== null) {
      const raw = m[0].replace(/\\u002F/gi, '/').replace(/\\u0026.*$/, '').replace(/&amp;.*$/, '');
      const norm = raw.split("?")[0];
      if (norm.includes("logo") || norm.includes("icon") || norm.includes("/site/")) continue;
      const picIdMatch = norm.match(/pic-(\d+)/);
      if (!picIdMatch) continue;
      const picId = picIdMatch[1];
      // Only accept pic IDs that belong to this listing
      if (!listingPicIds.has(picId)) continue;
      if (seen.has(picId)) continue;
      // Skip thumbnails — only keep large sizes (width >= 600px)
      const sizeMatch = norm.match(/-(\d+)x(\d+)\.jpe?g$/i);
      if (!sizeMatch || parseInt(sizeMatch[1]) < 600) continue;
      seen.add(picId);
      gallery.push(norm);
      if (gallery.length >= 50) break;
    }
    console.log(`[CarGurus HTML scan] Found ${gallery.length} listing photos (${listingPicIds.size} known pic IDs)`);
    if (gallery.length > (data.photo_urls?.length ?? 0)) {
      data.photo_urls = gallery;
      data.photo_url = gallery[0];
    }
  }

  // Raw HTML regex fallback — catches CarGurus rendered text like "Clean title", "2 accidents reported"
  if (!data.title_status) {
    if (/clean\s+title/i.test(html)) data.title_status = "clean";
    else if (/salvage\s+title/i.test(html)) data.title_status = "salvage";
    else if (/rebuilt\s+title/i.test(html)) data.title_status = "rebuilt";
  }
  if (!data.accidents_reported) {
    const accMatch = html.match(/(\d+)\s+accident[s]?\s+reported/i);
    if (accMatch) data.accidents_reported = parseInt(accMatch[1]) > 0 ? "yes" : "no";
    else if (/no\s+accidents?\s+reported|0\s+accidents?\s+reported/i.test(html)) data.accidents_reported = "no";
  }
  if (!data.owners) {
    const ownMatch = html.match(/(\d+)\s+previous\s+owner/i);
    if (ownMatch) { const n = parseInt(ownMatch[1]); if (n > 0) data.owners = n; }
  }

  // Context-aware VIN scan across all inline script blocks — skips carousel/recommendation VINs
  if (!data.vin) {
    const scriptBlocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const block of scriptBlocks) {
      const vinMatch = block[1].match(/"vin"\s*:\s*"([A-HJ-NPR-Z0-9]{17})"/i);
      if (!vinMatch) continue;
      const idx = block[1].indexOf(vinMatch[0]);
      const context = block[1].substring(Math.max(0, idx - 300), idx + 400);
      // Skip if surrounding context looks like a recommendations/similar-cars list
      if (/similar|recommend|related|other listing|you may also/i.test(context)) continue;
      data.vin = vinMatch[1].toUpperCase();
      break;
    }
  }

  // Fallback: regex scan the raw HTML for EV spec patterns before scripts are stripped
  if (!data.range_mi) {
    const m = html.match(/(?:electric\s+range|battery\s+range|est(?:imated)?\s*\.?\s*range)[^0-9]*(\d{2,3})\s*mi/i);
    if (m) { const v = parseInt(m[1]); if (v >= 50 && v <= 600) data.range_mi = v; }
  }
  if (!data.battery_kwh) {
    const m = html.match(/(?:battery\s+(?:capacity|size|pack))[^0-9]*(\d+(?:\.\d+)?)\s*kWh/i)
      || html.match(/"batteryCapacity[^"]*"\s*:\s*"?(\d+(?:\.\d+)?)(?:\s*kWh)?/i);
    if (m) { const v = parseFloat(m[1]); if (v >= 20 && v <= 250) data.battery_kwh = v; }
  }
  if (!data.dc_fast_kw) {
    const m = html.match(/(?:dc\s+fast|max\s+dc\s+charg\w+)[^0-9]*(\d+)\s*kW/i)
      || html.match(/\b(\d+)\s*kW\s+dc\b/i)
      || html.match(/dc\s+(?:charge|charging)\s*[:\-]\s*(\d+)\s*kW/i)
      || html.match(/fast\s+charg\w*\s*(?:rate\s*)?[:\-]\s*(\d+)\s*kW/i)
      || html.match(/charg\w*\s+rate\s*[:\-]\s*(\d+)\s*kW/i)
      || html.match(/"(?:dcFastCharge|maxDcCharging|fastCharge)[^"]*"\s*:\s*"?(\d+)/i);
    if (m) { const v = parseInt(m[1]); if (v >= 20 && v <= 400) data.dc_fast_kw = v; }
  }
  if (!data.efficiency_mi_per_kwh && !data.range_mi) {
    // Try MPGe from HTML
    const m = html.match(/(?:mpge|mpg-e|miles\s+per\s+gallon\s+equivalent)[^0-9]*(\d+)/i);
    if (m) {
      const eff = Math.round((parseInt(m[1]) / 33.7) * 10) / 10;
      if (eff >= 1 && eff <= 10) data.efficiency_mi_per_kwh = eff;
    }
  }

  // Try to extract from embedded JSON data (fallback pattern)
  if (!data.year || !data.make || !data.model) {
    const jsonDataMatch = html.match(/"year":(\d{4}).*?"make":"([^"]+)".*?"model":"([^"]+)".*?"mileage":(\d+)/i);
    if (jsonDataMatch) {
      data.year = data.year || parseInt(jsonDataMatch[1]);
      data.make = data.make || jsonDataMatch[2];
      data.model = data.model || jsonDataMatch[3];
      data.mileage = data.mileage || parseInt(jsonDataMatch[4]);
    }
  }

  // Extract from title if still missing data
  if (!data.year || !data.make || !data.model) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1];
      // Example: "2013 Ford Focus Electric Hatchback - $4,999 - CarGurus"
      const vehicleMatch = title.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+?)\s+(?:Hatchback|Sedan|SUV|Coupe|Wagon|Convertible|Minivan|Truck|-)/i);
      if (vehicleMatch) {
        data.year = data.year || parseInt(vehicleMatch[1]);
        data.make = data.make || vehicleMatch[2];
        data.model = data.model || vehicleMatch[3].trim();
      }
    }
  }

  // Extract VIN if not found in __NEXT_DATA__ — CarGurus embeds it several ways
  if (!data.vin) {
    const vinPatterns = [
      /["']vin["']\s*:\s*["']([A-HJ-NPR-Z0-9]{17})["']/i,
      /VIN["']?\s*[:\-]\s*["']?([A-HJ-NPR-Z0-9]{17})/i,
      /vehicleIdentificationNumber["']?\s*:\s*["']?([A-HJ-NPR-Z0-9]{17})/i,
      /\b([A-HJ-NPR-Z0-9]{17})\b/,  // bare 17-char VIN anywhere in page
    ];
    for (const pattern of vinPatterns) {
      const m = html.match(pattern);
      if (m) { data.vin = m[1].toUpperCase(); break; }
    }
  }

  // Extract price if not found
  if (!data.price) {
    const priceMatch = html.match(/\$(\d+(?:,\d{3})*)/);
    if (priceMatch) {
      data.price = parseInt(priceMatch[1].replace(/,/g, ''));
    }
  }

  // Extract mileage if not found
  if (!data.mileage) {
    const metaMileageMatch = html.match(/with\s+(\d+(?:,\d{3})*)\s+miles/i);
    if (metaMileageMatch) {
      data.mileage = parseInt(metaMileageMatch[1].replace(/,/g, ''));
    } else {
      // Fallback: Look for "Mileage:</span><span>49,385 mi</span>" pattern
      const mileageStructured = html.match(/Mileage[^>]*>[\s\S]{0,100}?(\d+(?:,\d{3})*)\s*mi/i);
      if (mileageStructured) {
        data.mileage = parseInt(mileageStructured[1].replace(/,/g, ''));
      }
    }
  }

  // Validate and return
  return validateVehicleData(data);
}

async function extractFromCars(html: string): Promise<Partial<VehicleData>> {
  // Try structured data first (uses the common extractStructuredData function)
  const data = extractStructuredData(html);

  // Extract from title tag if needed
  if (!data.year || !data.make || !data.model) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1];
      // Example: "Used 2020 Nissan Leaf SV Plus for Sale - $18,999 | Cars.com"
      const vehicleMatch = title.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+?)(?:\s+for\s+Sale|-|\|)/i);
      if (vehicleMatch) {
        data.year = data.year || parseInt(vehicleMatch[1]);
        data.make = data.make || vehicleMatch[2];
        data.model = data.model || vehicleMatch[3].trim();
      }
    }
  }

  // Extract price from title or page
  if (!data.price) {
    const priceMatch = html.match(/\$(\d+(?:,\d{3})*)/);
    if (priceMatch) {
      data.price = parseInt(priceMatch[1].replace(/,/g, ''));
    }
  }

  // Extract mileage from page content
  if (!data.mileage) {
    // Look for mileage in structured format
    const mileageMatch = html.match(/mileage["\s:]+(\d+(?:,\d{3})*)/i) ||
                        html.match(/(\d+(?:,\d{3})*)\s+miles/i);
    if (mileageMatch) {
      data.mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
    }
  }

  // Extract VIN if available
  if (!data.vin) {
    const vinMatch = html.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch) {
      data.vin = vinMatch[1];
    }
  }

  // Title status — Cars.com renders history as visible text
  if (!data.title_status) {
    if (/clean\s+title/i.test(html)) data.title_status = "clean";
    else if (/salvage\s+title/i.test(html)) data.title_status = "salvage";
    else if (/rebuilt\s+title|reconstructed\s+title/i.test(html)) data.title_status = "rebuilt";
  }

  // Accident history
  if (!data.accidents_reported) {
    const accMatch = html.match(/(\d+)\s+accident[s]?\s+reported/i);
    if (accMatch) data.accidents_reported = parseInt(accMatch[1]) > 0 ? "yes" : "no";
    else if (/no\s+accidents?\s+reported|0\s+accidents?\s+reported/i.test(html)) data.accidents_reported = "no";
    else if (/accident[s]?\s+reported/i.test(html)) data.accidents_reported = "yes";
  }

  // Owner count
  if (!data.owners) {
    const ownMatch = html.match(/(\d+)\s+previous\s+owner/i);
    if (ownMatch) { const n = parseInt(ownMatch[1]); if (n > 0) data.owners = n; }
  }

  // Validate and return
  return validateVehicleData(data);
}

/**
 * Main extraction function
 * Fetches URL and extracts vehicle data with a hard 10s total budget.
 */
export async function extractVehicleData(url: string, opts?: { adminKey?: string }): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const startTime = Date.now();

  // Hard budget: 38s total — allows for cold-start serverless latency + Nimbleway JS render (~28s).
  // The /api/receipt/fetch route has maxDuration=45 so this fits comfortably.
  const EXTRACTION_BUDGET_MS = 38000;
  const remainingBudget = () => Math.max(0, EXTRACTION_BUDGET_MS - (Date.now() - startTime));

  // Initialize diagnostics
  const diagnostics: AutofillDiagnostics = {
    failureReason: null,
    domain: null,
    extractedFieldCount: 0,
    fetchMethod: null,
    durationMs: 0,
  };

  const finalize = () => {
    diagnostics.durationMs = Date.now() - startTime;
    console.log('[Autofill Diagnostics]', JSON.stringify(diagnostics));
  };

  try {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      diagnostics.domain = parsedUrl.hostname;
    } catch {
      diagnostics.failureReason = "invalid_url";
      finalize();
      return { success: false, data: null, error: 'Invalid URL format', warnings, diagnostics };
    }

    // Check if this is a search page
    if (isSearchPage(url)) {
      diagnostics.failureReason = "search_page";
      finalize();
      return {
        success: false,
        data: null,
        error: 'This appears to be a search results page. Please paste the URL of a specific vehicle listing.',
        warnings: ['Click on a specific car from the search results to get its individual listing URL'],
        diagnostics,
      };
    }

    // Detect source
    const dataSource = detectListingSource(url);
    if (dataSource === 'unknown') {
      warnings.push('Unrecognized listing source - extraction may be incomplete');
      diagnostics.failureReason = "unsupported_domain";
    }

    console.log('[Listing Scraper] Starting extraction:', { url: url.substring(0, 80), dataSource });

    // --- Proxy fetch phase ---
    let html: string | null = null;

    // CarGurus uses Nimbleway JS rendering. AutoTrader and Cars.com use direct fetch.
    const jsRenderSources: VehicleData['dataSource'][] = ['cargurus'];
    const sourceProxyCap = jsRenderSources.includes(dataSource) ? 32000 : 15000;

    if (remainingBudget() > 1000) {
      const proxyStart = Date.now();
      const proxyTimeout = Math.min(sourceProxyCap, remainingBudget() - 500);
      const proxyController = new AbortController();
      const proxyTimeoutId = setTimeout(() => proxyController.abort(), proxyTimeout);

      try {
        // Internal proxy route — avoids CORS and rotates user-agents
        // BASE_URL (server-only) takes priority over the public variant so dev port
        // is always correct without exposing it in the browser bundle.
        // process.env.PORT is set by Next.js at runtime as an additional fallback.
        const devPort = process.env.PORT ?? "3000";
        const baseUrl = process.env.BASE_URL ||
                        process.env.NEXT_PUBLIC_BASE_URL ||
                        process.env.URL ||
                        process.env.DEPLOY_URL ||
                        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                        `http://localhost:${devPort}`;
        const proxyUrl = typeof window === 'undefined'
          ? `${baseUrl}/api/proxy-fetch`
          : '/api/proxy-fetch';

        console.log('[Listing Scraper] Proxy fetch:', { url: url.substring(0, 80), dataSource });
        const proxyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (opts?.adminKey) proxyHeaders['x-admin-key'] = opts.adminKey;
        const proxyResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: proxyHeaders,
          body: JSON.stringify({ url, timeout: Math.min(sourceProxyCap, proxyTimeout - 500) }),
          signal: proxyController.signal,
        });
        clearTimeout(proxyTimeoutId);

        diagnostics.proxyStatusCode = proxyResponse.status;
        diagnostics.proxyDurationMs = Date.now() - proxyStart;

        const contentType = proxyResponse.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const proxyResult = await proxyResponse.json();
          if (proxyResult.success && proxyResult.html) {
            html = proxyResult.html;
            diagnostics.fetchMethod = 'proxy';
            diagnostics.htmlLength = html!.length;
            console.log('[Listing Scraper] Proxy fetch succeeded, length:', html!.length);
          } else if (proxyResult.blocked) {
            diagnostics.failureReason = 'blocked_by_bot_protection';
            diagnostics.botProtectionDetected = true;
            diagnostics.botProtectionType = proxyResult.error?.toLowerCase().includes('akamai') ? 'akamai'
              : proxyResult.error?.toLowerCase().includes('cloudflare') ? 'cloudflare' : 'unknown';
            diagnostics.errorMessage = proxyResult.error;
            finalize();
            return {
              success: false,
              data: null,
              error: 'This site blocked auto-extraction. Paste the listing text instead.',
              warnings: ['The marketplace has bot detection enabled', 'Paste the listing text or enter details manually'],
              diagnostics,
            };
          } else {
            diagnostics.errorMessage = proxyResult.error;
            console.warn('[Listing Scraper] Proxy fetch failed:', proxyResult.error);
          }
        }
      } catch (proxyError) {
        clearTimeout(proxyTimeoutId);
        diagnostics.proxyDurationMs = Date.now() - proxyStart;
        const msg = proxyError instanceof Error ? proxyError.message : String(proxyError);
        if (proxyError instanceof Error && proxyError.name === 'AbortError') {
          diagnostics.errorMessage = 'proxy_timeout';
          console.warn('[Listing Scraper] Proxy fetch timed out');
        } else {
          diagnostics.errorMessage = msg;
          console.warn('[Listing Scraper] Proxy fetch threw:', msg);
        }
        // Fall through to direct fetch
      }
    }

    // --- Direct fetch fallback ---
    if (!html && remainingBudget() > 1000) {
      const directStart = Date.now();
      const directTimeout = remainingBudget() - 200;
      const directController = new AbortController();
      const directTimeoutId = setTimeout(() => directController.abort(), directTimeout);

      try {
        console.log('[Listing Scraper] Falling back to direct fetch:', url.substring(0, 80));
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.google.com/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
          },
          redirect: 'follow',
          signal: directController.signal,
        });
        clearTimeout(directTimeoutId);

        diagnostics.directStatusCode = response.status;
        diagnostics.directDurationMs = Date.now() - directStart;

        if (response.ok) {
          html = await response.text();
          diagnostics.fetchMethod = 'direct';
          diagnostics.htmlLength = html.length;
          console.log('[Listing Scraper] Direct fetch succeeded, length:', html.length);
        } else {
          diagnostics.errorMessage = `direct_${response.status}`;
          console.warn('[Listing Scraper] Direct fetch HTTP', response.status);
        }
      } catch (directErr) {
        clearTimeout(directTimeoutId);
        diagnostics.directDurationMs = Date.now() - directStart;
        const msg = directErr instanceof Error ? directErr.message : String(directErr);
        console.warn('[Listing Scraper] Direct fetch threw:', msg);
        if (directErr instanceof Error && directErr.name === 'AbortError') {
          diagnostics.failureReason = 'timeout';
          diagnostics.errorMessage = 'direct_timeout';
        } else {
          diagnostics.failureReason = 'network_error';
          diagnostics.errorMessage = msg;
        }
      }
    }

    // --- No HTML obtained ---
    if (!html) {
      if (!diagnostics.failureReason) {
        diagnostics.failureReason = remainingBudget() <= 1000 ? "timeout" : "network_error";
      }
      // JS-rendered sites (CarGurus, AutoTrader, Cars.com) require ScrapingBee.
      // If fetch fails for any reason on these domains, treat as bot protection so
      // the frontend auto-switches to text mode with the right error message.
      const jsRenderDomains = ["cargurus", "autotrader", "cars.com"];
      if (jsRenderDomains.includes(dataSource) &&
          (diagnostics.failureReason === "timeout" || diagnostics.failureReason === "network_error" || !diagnostics.failureReason)) {
        diagnostics.failureReason = "blocked_by_bot_protection";
        diagnostics.botProtectionDetected = true;
        diagnostics.botProtectionType = diagnostics.botProtectionType ?? "silent_hang";
      }
      finalize();
      return {
        success: false,
        data: null,
        error: diagnostics.botProtectionDetected
          ? 'This site blocked auto-extraction. Paste the listing text instead.'
          : diagnostics.failureReason === "timeout"
          ? 'Extraction timed out. Paste the listing text instead.'
          : 'Unable to fetch listing. Paste the listing text instead.',
        warnings: ['ScrapingBee extraction failed'],
        diagnostics,
      };
    }

    // --- Sold / unavailable listing detection ---
    // Check before heavy parsing — if the page says the listing is gone, fail fast.
    // IMPORTANT: CarGurus embeds i18n strings like "Looks like that one got away" in its
    // JS bundle on EVERY page (active and sold). Strip <script> tags before checking
    // CarGurus-specific phrases to avoid false positives on active listings.
    const lowerHtmlSold = html.toLowerCase();
    const htmlNoScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const lowerNoScripts = htmlNoScripts.toLowerCase();
    const isSold =
      // Generic visible-text phrases — safe to check full HTML
      lowerHtmlSold.includes('this listing is no longer available') ||
      lowerHtmlSold.includes('listing is no longer available') ||
      lowerHtmlSold.includes('this vehicle has been sold') ||
      lowerHtmlSold.includes('vehicle has been sold') ||
      lowerHtmlSold.includes('this car has been sold') ||
      lowerHtmlSold.includes('sorry, this listing is') ||
      lowerHtmlSold.includes('listing has expired') ||
      lowerHtmlSold.includes('listing is unavailable') ||
      lowerHtmlSold.includes('vehicle is no longer available') ||
      lowerHtmlSold.includes('this vehicle is no longer listed') ||
      lowerHtmlSold.includes('listing is no longer active') ||
      // CarGurus-specific — MUST check script-stripped HTML only (phrases exist in JS bundle on all pages)
      /looks?\s+like\s+(?:that\s+)?one\s+got\s+away/i.test(htmlNoScripts);

    if (isSold) {
      diagnostics.failureReason = "listing_sold";
      finalize();
      return {
        success: false,
        data: null,
        error: 'This listing has been sold or is no longer available.',
        warnings: ['Listing appears to be sold or removed'],
        diagnostics,
      };
    }

    // --- Bot detection in HTML ---
    const lowerHtml = html.toLowerCase();
    const isBlocked = lowerHtml.includes('id="captcha"') ||
                      lowerHtml.includes('class="captcha') ||
                      lowerHtml.includes('bot detection') ||
                      lowerHtml.includes('just a moment') ||
                      lowerHtml.includes('challenge-platform') ||
                      lowerHtml.includes('akamai-block') ||
                      html.includes('Autotrader - page unavailable') ||
                      html.length < 2000;

    if (isBlocked) {
      diagnostics.botProtectionDetected = true;
      if (lowerHtml.includes('challenge-platform') || lowerHtml.includes('just a moment')) {
        diagnostics.botProtectionType = 'cloudflare';
      } else if (lowerHtml.includes('akamai-block') || html.includes('Autotrader - page unavailable')) {
        diagnostics.botProtectionType = 'akamai';
      }

      if (dataSource === 'carvana' || html.length < 5000) {
        diagnostics.failureReason = "blocked_by_bot_protection";
        finalize();
        return {
          success: false,
          data: null,
          error: 'This site blocked auto-extraction. Paste the listing text instead.',
          warnings: ['Bot protection detected in response'],
          diagnostics,
        };
      }
      warnings.push('This marketplace may be blocking automated data extraction');
    }

    // --- Parse HTML ---
    const parseStart = Date.now();
    let extractedData: Partial<VehicleData> = {};

    switch (dataSource) {
      case 'autotrader':
        extractedData = await extractFromAutoTrader(html, url);
        break;
      case 'cargurus': {
        extractedData = await extractFromCarGurus(html);
        // Nimbleway sometimes returns a cached page for a different listing.
        // Cross-check: if URL contains a numeric listing ID, verify the HTML
        // actually contains that same ID. If not, photos belong to a different
        // car — discard them to avoid showing wrong-car images.
        const cgListingIdMatch = url.match(/\/details\/(\d{7,12})/);
        if (cgListingIdMatch && extractedData.photo_urls?.length) {
          const expectedId = cgListingIdMatch[1];
          if (!html.includes(expectedId)) {
            console.warn(`[CarGurus] Listing ID ${expectedId} not found in HTML — discarding photos (stale Nimbleway cache)`);
            extractedData.photo_urls = undefined;
            extractedData.photo_url = undefined;
          }
        }
        break;
      }
      case 'cars.com':
        extractedData = await extractFromCars(html);
        break;
      default:
        warnings.push('Using generic extraction - data may be incomplete');
        extractedData = await extractFromAutoTrader(html);
    }
    diagnostics.parseDurationMs = Date.now() - parseStart;
    console.log('[Listing Scraper] Parse result:', { dataSource, year: extractedData.year, make: extractedData.make, model: extractedData.model, mileage: extractedData.mileage, title_status: extractedData.title_status, accidents_reported: extractedData.accidents_reported, owners: extractedData.owners, hasNextData: html.includes('__NEXT_DATA__'), hasRemixContext: html.includes('__remixContext'), htmlLength: html.length });

    // --- Build result ---
    const extractedFields: string[] = [];
    const missingFields: string[] = [];

    for (const field of ['year', 'make', 'model', 'mileage']) {
      if (extractedData[field as keyof typeof extractedData]) {
        extractedFields.push(field);
      } else {
        missingFields.push(field);
      }
    }
    for (const field of ['trim', 'price', 'vin', 'location']) {
      if (extractedData[field as keyof typeof extractedData]) {
        extractedFields.push(field);
      }
    }

    let confidence: VehicleData['confidence'] = 'low';
    if (extractedFields.length >= 4) confidence = 'high';
    else if (extractedFields.length >= 2) confidence = 'medium';

    // Strip HTML tags and collapse whitespace to get plain text for AI
    const rawText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .substring(0, 5000);

    const vehicleData: VehicleData = {
      ...extractedData,
      raw_text: rawText || undefined,
      dataSource,
      confidence,
      extractedFields,
      missingFields,
    };

    if (missingFields.includes('year') || missingFields.includes('make') || missingFields.includes('model')) {
      warnings.push('Some details require manual confirmation');
    }

    diagnostics.extractedFieldCount = extractedFields.length;

    if (extractedFields.length === 0) {
      diagnostics.failureReason = "empty_response";
      warnings.push('Unable to extract vehicle data automatically. Try pasting the listing text.');
    } else if (diagnostics.failureReason === "unsupported_domain") {
      diagnostics.failureReason = null; // Succeeded despite unknown domain
    }

    finalize();

    return { success: true, data: vehicleData, warnings, diagnostics };

  } catch (error) {
    diagnostics.errorMessage = error instanceof Error ? error.message : 'unknown';
    if (!diagnostics.failureReason) diagnostics.failureReason = "unknown";
    finalize();
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      warnings,
      diagnostics,
    };
  }
}

// Test-only exports — not part of the public API.
export const _testExports = {
  extractFromCarGurus,
};
