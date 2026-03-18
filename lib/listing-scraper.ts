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
async function extractFromAutoTrader(html: string): Promise<Partial<VehicleData>> {
  // Try structured data first
  let data = extractStructuredData(html);

  // If we didn't get enough data, try AutoTrader-specific patterns
  if (!data.year || !data.make || !data.model) {
    // Extract from title meta tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1];

      // New format: "Used 2024 Chevrolet Equinox EV RS for sale in..."
      let vehicleMatch = title.match(/(?:Used\s+)?(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+?)\s+(?:for\s+sale|RS|LT|EX|SE|LE|Limited|Premium|Sport)/i);

      // Old format: "2022 Tesla Model 3 Long Range for Sale in..."
      if (!vehicleMatch) {
        vehicleMatch = title.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+?)\s+for\s+Sale/i);
      }

      if (vehicleMatch) {
        data.year = data.year || parseInt(vehicleMatch[1]);
        data.make = data.make || vehicleMatch[2];
        data.model = data.model || vehicleMatch[3].trim();
      }
    }
  }

  // Extract price if not found in structured data
  if (!data.price) {
    const priceMatch = html.match(/(?:price|listPrice)["']?\s*:\s*["']?\$?(\d+(?:,\d{3})*)/i);
    if (priceMatch) {
      data.price = parseInt(priceMatch[1].replace(/,/g, ''));
    }
  }

  // Extract mileage if not found in structured data
  if (!data.mileage) {
    const mileageMatch = html.match(/(?:mileage|odometer)["']?\s*:\s*["']?(\d+(?:,\d{3})*)/i);
    if (mileageMatch) {
      const mileageValue = parseInt(mileageMatch[1].replace(/,/g, ''));
      // Sanity check: mileage should be reasonable (100 - 500,000)
      if (mileageValue >= 100 && mileageValue <= 500000) {
        data.mileage = mileageValue;
      }
    }
  }

  // Extract VIN if not found in structured data
  if (!data.vin) {
    const vinMatch = html.match(/VIN["']?\s*:\s*["']?([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch) {
      data.vin = vinMatch[1];
    }
  }

  // Validate and return
  return validateVehicleData(data);
}

/**
 * Extracts vehicle data from CarGurus URL
 */
async function extractFromCarGurus(html: string): Promise<Partial<VehicleData>> {
  // Try structured data first
  let data = extractStructuredData(html);

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
        data.vin = data.vin || listing.vin;
        data.location = data.location || listing.dealer?.cityState;
      }
    } catch (e) {
      console.log('[CarGurus] Failed to parse __NEXT_DATA__:', e);
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
  let data = extractStructuredData(html);

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

  // Validate and return
  return validateVehicleData(data);
}

/**
 * Main extraction function
 * Fetches URL and extracts vehicle data with a hard 10s total budget.
 */
export async function extractVehicleData(url: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const startTime = Date.now();

  // Hard budget: 25s total across all fetch attempts (Netlify maxDuration=30s, function timeout=60s)
  const EXTRACTION_BUDGET_MS = 25000;
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

    if (remainingBudget() > 1000) {
      const proxyStart = Date.now();
      const proxyTimeout = Math.min(20000, remainingBudget() - 500);
      const proxyController = new AbortController();
      const proxyTimeoutId = setTimeout(() => proxyController.abort(), proxyTimeout);

      try {
        // Construct proxy URL
        let proxyUrl: string;
        if (typeof window === 'undefined') {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                          process.env.URL ||
                          process.env.DEPLOY_URL ||
                          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                          'http://localhost:3000';
          proxyUrl = `${baseUrl}/api/proxy-fetch`;
        } else {
          proxyUrl = '/api/proxy-fetch';
        }

        const proxyResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, timeout: Math.min(20000, proxyTimeout - 500) }),
          signal: proxyController.signal,
        });
        clearTimeout(proxyTimeoutId);

        diagnostics.proxyStatusCode = proxyResponse.status;
        diagnostics.proxyDurationMs = Date.now() - proxyStart;

        const contentType = proxyResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Proxy returned non-JSON response');
        }

        const proxyResult = await proxyResponse.json();

        if (proxyResult.success && proxyResult.html) {
          html = proxyResult.html;
          diagnostics.fetchMethod = "proxy";
          diagnostics.htmlLength = html!.length;
        } else if (proxyResult.blocked) {
          diagnostics.failureReason = "blocked_by_bot_protection";
          diagnostics.fetchMethod = "proxy";
          diagnostics.botProtectionDetected = true;
          // Detect protection type from proxy result
          diagnostics.botProtectionType = proxyResult.error?.toLowerCase().includes('akamai') ? 'akamai'
            : proxyResult.error?.toLowerCase().includes('cloudflare') ? 'cloudflare' : 'unknown';
          diagnostics.errorMessage = proxyResult.error;
          finalize();
          return {
            success: false,
            data: null,
            error: 'This site blocked auto-extraction. Paste the listing text instead.',
            warnings: ['The marketplace has enhanced bot detection', 'Paste the listing text or enter details manually'],
            diagnostics,
          };
        } else {
          // Proxy failed, will try direct
          diagnostics.errorMessage = proxyResult.error;
        }
      } catch (proxyError) {
        clearTimeout(proxyTimeoutId);
        diagnostics.proxyDurationMs = Date.now() - proxyStart;
        if (proxyError instanceof Error && proxyError.name === 'AbortError') {
          diagnostics.errorMessage = 'proxy_timeout';
        }
        // Will fall through to direct fetch
      }
    }

    // --- Direct fetch phase (if proxy didn't get HTML) ---
    if (!html && remainingBudget() > 1000) {
      const directStart = Date.now();
      const directTimeout = remainingBudget() - 200;
      const directController = new AbortController();
      const directTimeoutId = setTimeout(() => directController.abort(), directTimeout);

      try {
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

        if (!response.ok) {
          diagnostics.fetchMethod = "direct";
          diagnostics.httpStatus = response.status;

          if (response.status === 403) {
            diagnostics.failureReason = "blocked_by_bot_protection";
            diagnostics.botProtectionDetected = true;
            diagnostics.botProtectionType = dataSource === 'carvana' ? 'cloudflare' : 'unknown';
            finalize();
            return {
              success: false,
              data: null,
              error: 'This site blocked auto-extraction. Paste the listing text instead.',
              warnings: ['Site returned 403 Forbidden', 'Paste the listing text or enter details manually'],
              diagnostics,
            };
          }

          diagnostics.failureReason = "http_error";
          diagnostics.errorMessage = `HTTP ${response.status}`;
          finalize();
          return {
            success: false,
            data: null,
            error: `Unable to access listing (Error ${response.status}). Paste the listing text instead.`,
            warnings: ['Many car listing sites protect against automated access'],
            diagnostics,
          };
        }

        html = await response.text();
        diagnostics.fetchMethod = "direct";
        diagnostics.htmlLength = html.length;
      } catch (directFetchError) {
        clearTimeout(directTimeoutId);
        diagnostics.directDurationMs = Date.now() - directStart;

        if (directFetchError instanceof Error && directFetchError.name === 'AbortError') {
          diagnostics.failureReason = "timeout";
          diagnostics.errorMessage = 'direct_timeout';
        } else {
          diagnostics.failureReason = "network_error";
          diagnostics.errorMessage = directFetchError instanceof Error ? directFetchError.message : 'unknown';
        }
      }
    }

    // --- No HTML obtained from either method ---
    if (!html) {
      if (!diagnostics.failureReason) {
        diagnostics.failureReason = remainingBudget() <= 1000 ? "timeout" : "network_error";
      }
      finalize();
      return {
        success: false,
        data: null,
        error: diagnostics.failureReason === "timeout"
          ? 'Extraction timed out. Paste the listing text instead.'
          : 'Unable to fetch listing. Paste the listing text instead.',
        warnings: ['Both proxy and direct fetch methods failed'],
        diagnostics,
      };
    }

    // --- Bot detection in HTML ---
    const isBlocked = html.includes('captcha') ||
                      html.includes('bot detection') ||
                      html.includes('cg-mobileHome') ||
                      html.includes('Just a moment') ||
                      html.includes('challenge-platform') ||
                      html.includes('akamai-block') ||
                      html.includes('Autotrader - page unavailable') ||
                      html.length < 2000;

    if (isBlocked) {
      diagnostics.botProtectionDetected = true;
      if (html.includes('challenge-platform') || html.includes('Just a moment')) {
        diagnostics.botProtectionType = 'cloudflare';
      } else if (html.includes('akamai-block') || html.includes('Autotrader - page unavailable')) {
        diagnostics.botProtectionType = 'akamai';
      }

      if (dataSource === 'carvana' || dataSource === 'autotrader' || html.length < 5000) {
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
        extractedData = await extractFromAutoTrader(html);
        break;
      case 'cargurus':
        extractedData = await extractFromCarGurus(html);
        break;
      case 'cars.com':
        extractedData = await extractFromCars(html);
        break;
      default:
        warnings.push('Using generic extraction - data may be incomplete');
        extractedData = await extractFromAutoTrader(html);
    }
    diagnostics.parseDurationMs = Date.now() - parseStart;

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

    const vehicleData: VehicleData = {
      ...extractedData,
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
