/**
 * CarGurus URL Builder
 *
 * Generates CarGurus shopping search URLs with location and vehicle filtering.
 * URL format: https://www.cargurus.com/shopping/results/?searchterms={make}+{model}+{year}&zip={zip}&distance={distance}
 */

/**
 * Build a CarGurus search URL for a given vehicle.
 * Links to filtered search results showing available inventory.
 *
 * @param make - Vehicle make (e.g., "Tesla")
 * @param modelShort - Short model name (e.g., "Model 3")
 * @param options - Optional parameters to enhance search
 * @param options.year - Vehicle year for filtering
 * @param options.zip - User's ZIP code for location-based search
 * @param options.range_mi - Real-world range (not used in URL, reserved for future)
 * @param options.battery_kwh - Battery size (not used in URL, reserved for future)
 * @returns CarGurus shopping search URL with location and vehicle filtering
 */
export function getCarGurusUrl(
  make: string,
  modelShort: string,
  options?: {
    year?: number;
    zip?: string;
    range_mi?: number;
    battery_kwh?: number;
  }
): string {
  // Build search terms: "Make Model Year" (e.g., "Tesla Model 3 2023")
  const searchTerms = [make, modelShort, options?.year]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, "+"); // Replace spaces with + for URL encoding

  // Base URL: CarGurus shopping results page
  const baseUrl = "https://www.cargurus.com/shopping/results/";

  // Build query parameters
  const params = new URLSearchParams();
  params.append("searchterms", searchTerms);

  // Add location filtering if ZIP provided
  if (options?.zip) {
    params.append("zip", options.zip);
    params.append("distance", "50"); // 50 mile radius
  }

  // Note: range_mi and battery_kwh are not standard CarGurus params
  // Reserved for future use if CarGurus adds support or we implement custom search

  return `${baseUrl}?${params.toString()}`;
}
