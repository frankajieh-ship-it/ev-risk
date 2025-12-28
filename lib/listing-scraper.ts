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
  dataSource: 'autotrader' | 'cargurus' | 'cars.com' | 'unknown';
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

  return 'unknown';
}

/**
 * Extracts vehicle data from AutoTrader URL
 *
 * AutoTrader URL patterns:
 * - https://www.autotrader.com/cars-for-sale/vehicledetails.xhtml?listingId=XXX
 * - Contains structured data in HTML meta tags
 */
async function extractFromAutoTrader(html: string): Promise<Partial<VehicleData>> {
  const data: Partial<VehicleData> = {};

  // Extract from title meta tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1];
    // Example: "2022 Tesla Model 3 Long Range for Sale in..."
    const vehicleMatch = title.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+?)\s+for\s+Sale/i);
    if (vehicleMatch) {
      data.year = parseInt(vehicleMatch[1]);
      data.make = vehicleMatch[2];
      data.model = vehicleMatch[3].trim();
    }
  }

  // Extract price
  const priceMatch = html.match(/(?:price|listPrice)["']?\s*:\s*["']?\$?(\d+(?:,\d{3})*)/i);
  if (priceMatch) {
    data.price = parseInt(priceMatch[1].replace(/,/g, ''));
  }

  // Extract mileage
  const mileageMatch = html.match(/(?:mileage|odometer)["']?\s*:\s*["']?(\d+(?:,\d{3})*)/i);
  if (mileageMatch) {
    data.mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
  }

  // Extract VIN
  const vinMatch = html.match(/VIN["']?\s*:\s*["']?([A-HJ-NPR-Z0-9]{17})/i);
  if (vinMatch) {
    data.vin = vinMatch[1];
  }

  return data;
}

/**
 * Extracts vehicle data from CarGurus URL
 */
async function extractFromCarGurus(html: string): Promise<Partial<VehicleData>> {
  const data: Partial<VehicleData> = {};

  // Extract from title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1];
    // Example: "Used 2021 Tesla Model Y Long Range AWD for Sale..."
    const vehicleMatch = title.match(/(?:Used\s+)?(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+?)\s+(?:for\s+Sale|AWD|RWD)/i);
    if (vehicleMatch) {
      data.year = parseInt(vehicleMatch[1]);
      data.make = vehicleMatch[2];
      data.model = vehicleMatch[3].trim();
    }
  }

  // Extract price
  const priceMatch = html.match(/\$(\d+(?:,\d{3})*)/);
  if (priceMatch) {
    data.price = parseInt(priceMatch[1].replace(/,/g, ''));
  }

  // Extract mileage
  const mileageMatch = html.match(/(\d+(?:,\d{3})*)\s*(?:mi|miles)/i);
  if (mileageMatch) {
    data.mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
  }

  return data;
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

    // Detect source
    const dataSource = detectListingSource(url);
    if (dataSource === 'unknown') {
      warnings.push('Unrecognized listing source - extraction may be incomplete');
    }

    // Fetch HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `Failed to fetch listing (${response.status})`,
        warnings,
      };
    }

    const html = await response.text();

    // Extract based on source
    let extractedData: Partial<VehicleData> = {};

    switch (dataSource) {
      case 'autotrader':
        extractedData = await extractFromAutoTrader(html);
        break;
      case 'cargurus':
        extractedData = await extractFromCarGurus(html);
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

    return {
      success: true,
      data: vehicleData,
      warnings,
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      warnings,
    };
  }
}
