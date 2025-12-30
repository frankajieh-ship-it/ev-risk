/**
 * Vehicle Listing Scraper
 *
 * Extracts vehicle data from marketplace URLs (AutoTrader, CarGurus, etc.)
 * Handles partial data gracefully and returns structured information
 */

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
  dataSource: 'autotrader' | 'cargurus' | 'cars.com' | 'carvana' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  extractedFields: string[];
  missingFields: string[];
}

export interface ExtractionResult {
  success: boolean;
  data: VehicleData | null;
  error?: string;
  warnings: string[];
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

  return 'unknown';
}

/**
 * Type definition for data sources
 */
type DataSource = 'autotrader' | 'cargurus' | 'cars.com' | 'carvana' | 'unknown';

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
 * Fetches URL and extracts vehicle data
 */
export async function extractVehicleData(url: string): Promise<ExtractionResult> {
  const warnings: string[] = [];

  try {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        success: false,
        data: null,
        error: 'Invalid URL format',
        warnings,
      };
    }

    // Check if this is a search page (multiple listings) vs individual listing
    if (isSearchPage(url)) {
      return {
        success: false,
        data: null,
        error: 'This appears to be a search results page with multiple vehicles. Please paste the URL of a specific vehicle listing instead.',
        warnings: ['Click on a specific car from the search results to get its individual listing URL'],
      };
    }

    // Detect source
    const dataSource = detectListingSource(url);
    if (dataSource === 'unknown') {
      warnings.push('Unrecognized listing source - extraction may be incomplete');
    }

    // Log extraction attempt for debugging
    console.log('[Listing Scraper] Attempting extraction:', {
      url,
      dataSource,
      timestamp: new Date().toISOString(),
    });

    // Use proxy fetch for better success rate (server-side fetch with rotating user agents)
    let html: string;
    let fetchMethod = 'proxy';

    try {
      // Try proxy fetch first with aggressive timeout (10 seconds max)
      const proxyController = new AbortController();
      const proxyTimeoutId = setTimeout(() => {
        console.log('[Listing Scraper] Proxy fetch timeout after 10s, falling back');
        proxyController.abort();
      }, 10000);

      try {
        // Construct full URL for proxy API (works both locally and on production)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                        process.env.NETLIFY_URL ? process.env.NETLIFY_URL :
                        'http://localhost:3000';

        const proxyUrl = `${baseUrl}/api/proxy-fetch`;
        console.log('[Listing Scraper] Using proxy URL:', proxyUrl);

        const proxyResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, timeout: 8000 }), // Shorter timeout for proxy
          signal: proxyController.signal,
        });

        clearTimeout(proxyTimeoutId);

        // Check if response is JSON before parsing
        const contentType = proxyResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log('[Listing Scraper] Proxy returned non-JSON response, falling back to direct fetch');
          throw new Error('Proxy returned non-JSON response');
        }

        const proxyResult = await proxyResponse.json();

        if (proxyResult.success && proxyResult.html) {
          html = proxyResult.html;
          console.log('[Listing Scraper] Proxy fetch successful, HTML length:', html.length);
        } else {
          // Proxy failed, fall back to direct fetch
          fetchMethod = 'direct';
          console.log('[Listing Scraper] Proxy fetch failed, falling back to direct fetch:', proxyResult.error);
          throw new Error('Proxy fetch failed');
        }
      } catch (proxyFetchError) {
        clearTimeout(proxyTimeoutId);
        throw proxyFetchError;
      }
    } catch (proxyError) {
      // Fallback to direct fetch if proxy fails
      fetchMethod = 'direct';
      console.log('[Listing Scraper] Using direct fetch as fallback');

      // Add timeout to direct fetch (10 seconds max)
      const directController = new AbortController();
      const directTimeoutId = setTimeout(() => {
        console.log('[Listing Scraper] Direct fetch timeout after 10s');
        directController.abort();
      }, 10000);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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

      // Log response status for debugging
      console.log('[Listing Scraper] Direct fetch response status:', response.status, response.statusText);

      if (!response.ok) {
        // Special handling for Carvana 403 (Cloudflare blocking)
        if (dataSource === 'carvana' && response.status === 403) {
          console.log('[Listing Scraper] Carvana blocked request (403)');
          return {
            success: false,
            data: null,
            error: 'Carvana actively blocks automated data extraction. Please enter vehicle details manually.',
            warnings: ['Carvana uses Cloudflare protection to prevent automated access', 'Manual entry provides better accuracy anyway'],
          };
        }

        console.log('[Listing Scraper] HTTP error:', response.status);
        return {
          success: false,
          data: null,
          error: `Unable to access listing (Error ${response.status}). The site may be blocking automated requests. Please try entering the details manually.`,
          warnings: ['Many car listing sites protect against automated access', 'Manual entry is often more reliable'],
        };
      }

        html = await response.text();
        console.log('[Listing Scraper] Direct fetch HTML received, length:', html.length);
      } catch (directFetchError) {
        clearTimeout(directTimeoutId);
        // If direct fetch also fails, return error with helpful message
        console.error('[Listing Scraper] Direct fetch failed:', directFetchError);
        return {
          success: false,
          data: null,
          error: 'Unable to fetch listing. The site may be blocking automated requests or the connection timed out.',
          warnings: [
            'Both proxy and direct fetch methods failed',
            'The site may have strict bot protection',
            'Try copying the vehicle details manually from the listing page'
          ],
        };
      }
    }

    console.log('[Listing Scraper] Fetch method used:', fetchMethod);

    // Check if we got a blocked/captcha page
    const isBlocked = html.includes('captcha') ||
                      html.includes('bot detection') ||
                      html.includes('cg-mobileHome') || // CarGurus homepage
                      html.includes('Just a moment') || // Cloudflare challenge
                      html.includes('challenge-platform') || // Cloudflare
                      html.length < 10000; // Suspiciously short response

    // Special handling for known blocking sites
    if (dataSource === 'carvana' && isBlocked) {
      return {
        success: false,
        data: null,
        error: 'Carvana actively blocks automated data extraction. Please enter vehicle details manually.',
        warnings: ['Carvana uses Cloudflare protection to prevent automated access', 'Manual entry provides better accuracy anyway'],
      };
    }

    if (isBlocked) {
      warnings.push('This marketplace may be blocking automated data extraction');
      warnings.push('Please try entering the vehicle details manually for best results');
    }

    // Extract based on source
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
        // Generic extraction
        warnings.push('Using generic extraction - data may be incomplete');
        extractedData = await extractFromAutoTrader(html); // Try AutoTrader patterns
    }

    // Determine what fields we found
    const extractedFields: string[] = [];
    const missingFields: string[] = [];

    const requiredFields = ['year', 'make', 'model', 'mileage'];
    const optionalFields = ['trim', 'price', 'vin', 'location'];

    requiredFields.forEach(field => {
      if (extractedData[field as keyof typeof extractedData]) {
        extractedFields.push(field);
      } else {
        missingFields.push(field);
      }
    });

    optionalFields.forEach(field => {
      if (extractedData[field as keyof typeof extractedData]) {
        extractedFields.push(field);
      }
    });

    // Determine confidence
    let confidence: VehicleData['confidence'] = 'low';
    if (extractedFields.length >= 4) {
      confidence = 'high';
    } else if (extractedFields.length >= 2) {
      confidence = 'medium';
    }

    const vehicleData: VehicleData = {
      ...extractedData,
      dataSource,
      confidence,
      extractedFields,
      missingFields,
    };

    // Add informative message for missing critical fields (not an error - this is normal!)
    if (missingFields.includes('year') || missingFields.includes('make') || missingFields.includes('model')) {
      warnings.push('Some details require manual confirmation - this helps improve accuracy');
    }

    // Log extraction result for debugging
    console.log('[Listing Scraper] Extraction complete:', {
      success: true,
      dataSource,
      confidence,
      extractedFields,
      missingFields,
      hasData: extractedFields.length > 0,
    });

    // If we didn't extract ANY data, this might indicate a problem
    if (extractedFields.length === 0) {
      console.warn('[Listing Scraper] No data extracted - possible blocking or parsing failure');
      warnings.push('Unable to extract vehicle data automatically. This listing may require manual entry.');
      warnings.push('Tip: Copy the year, make, model, and mileage from the listing page');
    }

    return {
      success: true,
      data: vehicleData,
      warnings,
    };

  } catch (error) {
    console.error('[Listing Scraper] Extraction error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      warnings,
    };
  }
}
