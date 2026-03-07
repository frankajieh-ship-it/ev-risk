/**
 * VIN Decode Service
 *
 * Extracted from app/api/vin/decode/route.ts for reuse across
 * garage vehicle addition, dealer inventory import, and receipt flows.
 *
 * Core logic: NHTSA vPIC decode + VIN validation + mismatch detection.
 * Caching and rate limiting remain in the API route layer.
 */

// VIN validation: 17 alphanumeric chars, no I/O/Q
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

const MAKE_ALIASES: Record<string, string[]> = {
  chevrolet: ["chevy"],
  volkswagen: ["vw"],
  "mercedes-benz": ["mercedes", "mb"],
  "land rover": ["landrover"],
  bmw: ["bayerische motoren werke"],
};

function normalizeMake(make: string): string {
  const lower = make.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(MAKE_ALIASES)) {
    if (lower === canonical || aliases.includes(lower)) {
      return canonical;
    }
  }
  return lower;
}

export interface DecodedVin {
  year: number;
  make: string;
  model: string;
  trim: string;
  engine: string;
  drive_type: string;
  fuel_type: string;
  body_class: string;
  plant_country: string;
}

export interface VinMismatch {
  field: string;
  listing_value: string;
  decoded_value: string;
}

export interface VinDecodeResult {
  success: true;
  decoded: DecodedVin;
  mismatches: VinMismatch[];
  recall_url: string;
}

export interface VinDecodeError {
  success: false;
  error: string;
  code: "invalid_vin" | "nhtsa_timeout" | "nhtsa_error" | "not_found" | "unrecognized";
}

/**
 * Validate and clean a VIN string.
 * Returns cleaned uppercase VIN or null if invalid.
 */
export function validateVin(vin: string): string | null {
  const clean = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, "");
  return VIN_REGEX.test(clean) ? clean : null;
}

/**
 * Decode a VIN via NHTSA vPIC API.
 * Does NOT handle caching or rate limiting — caller is responsible.
 */
export async function decodeVin(
  cleanVin: string,
  listingContext?: { year?: number; make?: string; model?: string }
): Promise<VinDecodeResult | VinDecodeError> {
  const nhtsaUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${cleanVin}?format=json`;

  let nhtsaResponse: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    nhtsaResponse = await fetch(nhtsaUrl, { signal: controller.signal });
    clearTimeout(timeout);
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return {
      success: false,
      error: isAbort
        ? "NHTSA service timed out. Try again in a minute."
        : "NHTSA service unavailable. Try again in a minute.",
      code: "nhtsa_timeout",
    };
  }

  if (!nhtsaResponse.ok) {
    return {
      success: false,
      error: "NHTSA service returned an error. Try again later.",
      code: "nhtsa_error",
    };
  }

  const nhtsaData = await nhtsaResponse.json();
  const result = nhtsaData?.Results?.[0];

  if (!result) {
    return {
      success: false,
      error: "VIN not found in NHTSA database.",
      code: "not_found",
    };
  }

  // Check error codes — "0" = success, "1" = partial (still usable)
  const errorCode = result.ErrorCode?.toString() || "";
  const errorCodes = errorCode.split(",").map((c: string) => c.trim());
  const hasOnlySuccessCodes = errorCodes.every(
    (c: string) => c === "0" || c === "1" || c === ""
  );

  if (!hasOnlySuccessCodes && !result.Make && !result.ModelYear) {
    return {
      success: false,
      error: "VIN not recognized by NHTSA. Please double-check the VIN.",
      code: "unrecognized",
    };
  }

  // Parse decoded fields
  const engineParts = [
    result.DisplacementL ? `${parseFloat(result.DisplacementL).toFixed(1)}L` : null,
    result.EngineCylinders ? `${result.EngineCylinders}-Cylinder` : null,
    result.EngineModel || null,
  ].filter(Boolean);

  const decoded: DecodedVin = {
    year: parseInt(result.ModelYear, 10) || 0,
    make: result.Make || "",
    model: result.Model || "",
    trim: result.Trim || "",
    engine: engineParts.join(" ") || "",
    drive_type: result.DriveType || "",
    fuel_type: result.FuelTypePrimary || "",
    body_class: result.BodyClass || "",
    plant_country: result.PlantCountry || "",
  };

  const mismatches = listingContext
    ? detectMismatches(decoded, listingContext)
    : [];

  return {
    success: true,
    decoded,
    mismatches,
    recall_url: `https://www.nhtsa.gov/recalls?vin=${cleanVin}`,
  };
}

/**
 * Detect mismatches between decoded VIN data and listing data.
 */
export function detectMismatches(
  decoded: DecodedVin,
  listing: { year?: number; make?: string; model?: string }
): VinMismatch[] {
  const mismatches: VinMismatch[] = [];

  if (listing.year && decoded.year && listing.year !== decoded.year) {
    mismatches.push({
      field: "year",
      listing_value: String(listing.year),
      decoded_value: String(decoded.year),
    });
  }

  if (listing.make && decoded.make) {
    const normalizedListing = normalizeMake(listing.make);
    const normalizedDecoded = normalizeMake(decoded.make);
    if (normalizedListing !== normalizedDecoded) {
      mismatches.push({
        field: "make",
        listing_value: listing.make,
        decoded_value: decoded.make,
      });
    }
  }

  if (listing.model && decoded.model) {
    const listingModel = listing.model.toLowerCase().trim();
    const decodedModel = decoded.model.toLowerCase().trim();
    if (
      listingModel !== decodedModel &&
      !listingModel.startsWith(decodedModel) &&
      !decodedModel.startsWith(listingModel)
    ) {
      mismatches.push({
        field: "model",
        listing_value: listing.model,
        decoded_value: decoded.model,
      });
    }
  }

  return mismatches;
}
