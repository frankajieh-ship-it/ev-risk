/**
 * CarGurus URL Builder
 *
 * Maps our vehicle catalog to CarGurus search pages.
 * URL format: https://www.cargurus.com/Cars/l-Used-{Make}-{Model-Slug}
 */

/** Static map: base model name → CarGurus URL slug */
const CARGURUS_SLUGS: Record<string, string> = {
  "Tesla Model 3": "Tesla-Model-3",
  "Tesla Model Y": "Tesla-Model-Y",
  "Tesla Model S": "Tesla-Model-S",
  "Tesla Model X": "Tesla-Model-X",
  "Chevrolet Bolt EV": "Chevrolet-Bolt-EV",
  "Chevrolet Bolt EUV": "Chevrolet-Bolt-EUV",
  "Ford Mustang Mach-E": "Ford-Mustang-Mach-E",
  "Ford F-150 Lightning": "Ford-F-150-Lightning",
  "Hyundai Ioniq 5": "Hyundai-Ioniq-5",
  "Kia EV6": "Kia-EV6",
  "Volkswagen ID.4": "Volkswagen-ID.4",
  "Nissan Leaf": "Nissan-Leaf",
  "Nissan Ariya": "Nissan-Ariya",
  "Rivian R1T": "Rivian-R1T",
  "Rivian R1S": "Rivian-R1S",
  "BMW iX": "BMW-iX",
  "Mercedes EQS": "Mercedes-Benz-EQS",
  "Lucid Air": "Lucid-Air",
  "Polestar 2": "Polestar-2",
};

/**
 * Build a CarGurus search URL for a given vehicle.
 * Matches against base model names (ignores trim like "Long Range", "Performance").
 *
 * @param make - Vehicle make (e.g., "Tesla")
 * @param modelShort - Short model name (e.g., "Model 3")
 * @param options - Optional parameters to enhance search
 * @param options.year - Vehicle year for filtering
 * @param options.zip - User's ZIP code for location-based search
 * @param options.range_mi - Real-world range (not used in URL, reserved for future)
 * @param options.battery_kwh - Battery size (not used in URL, reserved for future)
 * @returns CarGurus search URL with optional query parameters
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
  const fullName = `${make} ${modelShort}`;
  let baseUrl = "";

  // Find matching slug from static map
  for (const [baseModel, slug] of Object.entries(CARGURUS_SLUGS)) {
    if (fullName.startsWith(baseModel)) {
      baseUrl = `https://www.cargurus.com/Cars/l-Used-${slug}`;
      break;
    }
  }

  // Fallback: construct slug from make + model words
  if (!baseUrl) {
    const slug = fullName.replace(/\s+/g, "-");
    baseUrl = `https://www.cargurus.com/Cars/l-Used-${slug}`;
  }

  // Add query parameters if options provided
  if (!options) {
    return baseUrl;
  }

  const params = new URLSearchParams();

  if (options.year) {
    params.append("year", String(options.year));
  }

  if (options.zip) {
    params.append("zip", options.zip);
    params.append("distance", "50"); // 50 mile radius
  }

  // Note: range_mi and battery_kwh are not standard CarGurus params
  // Reserved for future use if CarGurus adds support or we implement custom search

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}
