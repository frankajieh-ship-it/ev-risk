/**
 * CarGurus URL Builder
 *
 * Generates Google search URLs that return CarGurus listings as top results.
 * This approach works around CarGurus' complex internal URL structure (entityId, makeModelTrimPaths)
 * which requires internal IDs we don't have access to.
 */

/**
 * Build a Google search URL that returns CarGurus results for a given vehicle.
 * Google will show relevant CarGurus listings as the top result.
 *
 * @param make - Vehicle make (e.g., "Tesla")
 * @param modelShort - Short model name (e.g., "Model 3")
 * @param options - Optional parameters to enhance search
 * @param options.year - Vehicle year for filtering
 * @param options.zip - User's ZIP code for location-based search
 * @param options.range_mi - Real-world range (not used in search)
 * @param options.battery_kwh - Battery size (not used in search)
 * @returns Google search URL that returns CarGurus listings
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
  // Build Google search query that returns CarGurus results
  const searchTerms = [
    options?.year,
    make,
    modelShort,
    "CarGurus",
    options?.zip ? `near ${options.zip}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(searchTerms)}`;
}
