/**
 * ZIP/Postcode to Climate Zone Mapping
 *
 * Simple prefix-based inference for climate seasonality.
 * Used to auto-fill climate question with user override option.
 */

import type { ClimateSeasonality } from "@/types";

/**
 * US ZIP code prefixes by climate zone
 * Based on general climate patterns, not precise meteorological data
 */
const US_COLD_PREFIXES = [
  // Upper Midwest
  "540", "541", "542", "543", "544", "545", "546", "547", "548", "549", // WI
  "550", "551", "553", "554", "555", "556", "557", "558", "559", "560", "561", "562", "563", "564", "565", "566", "567", // MN
  "570", "571", "572", "573", "574", "575", "576", "577", // SD
  "580", "581", "582", "583", "584", "585", "586", "587", "588", // ND
  "590", "591", "592", "593", "594", "595", "596", "597", "598", "599", // MT
  // Northeast
  "010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027", // MA
  "028", "029", // RI
  "030", "031", "032", "033", "034", "035", "036", "037", "038", "039", // NH
  "040", "041", "042", "043", "044", "045", "046", "047", "048", "049", // ME
  "050", "051", "052", "053", "054", "056", "057", "058", "059", // VT
  // Upstate NY
  "120", "121", "122", "123", "124", "125", "126", "127", "128", "129",
  "130", "131", "132", "133", "134", "135", "136", "137", "138", "139",
  "140", "141", "142", "143", "144", "145", "146", "147", "148", "149",
  // Michigan
  "480", "481", "482", "483", "484", "485", "486", "487", "488", "489",
  "490", "491", "492", "493", "494", "495", "496", "497", "498", "499",
  // Alaska
  "995", "996", "997", "998", "999",
  // Mountain cold
  "820", "821", "822", "823", "824", "825", "826", "827", "828", "829", "830", "831", // WY
];

const US_HOT_PREFIXES = [
  // Arizona
  "850", "851", "852", "853", "855", "856", "857", "859", "860", "863", "864", "865",
  // Southern California
  "900", "901", "902", "903", "904", "905", "906", "907", "908", "910", "911", "912", "913", "914", "915", "916", "917", "918",
  "920", "921", "922", "923", "924", "925", "926", "927", "928",
  // Nevada (Las Vegas area)
  "889", "890", "891",
  // Texas (South)
  "780", "781", "782", "783", "784", "785", "786", "787", "788", "789",
  "798", "799",
  // Florida
  "320", "321", "322", "323", "324", "325", "326", "327", "328", "329",
  "330", "331", "332", "333", "334", "335", "336", "337", "338", "339",
  "340", "341", "342", "344", "346", "347", "349",
  // Louisiana
  "700", "701", "703", "704", "705", "706", "707", "708", "710", "711", "712", "713", "714",
  // Hawaii
  "967", "968",
];

/**
 * UK postcode prefixes for cold regions (Scotland, Northern England)
 */
const UK_COLD_PREFIXES = [
  // Scotland
  "AB", // Aberdeen
  "DD", // Dundee
  "DG", // Dumfries
  "EH", // Edinburgh
  "FK", // Falkirk/Stirling
  "G",  // Glasgow
  "IV", // Inverness
  "KA", // Kilmarnock
  "KW", // Kirkwall (Orkney)
  "KY", // Kirkcaldy
  "ML", // Motherwell
  "PA", // Paisley
  "PH", // Perth
  "TD", // Galashiels
  "ZE", // Shetland
  // Northern England
  "CA", // Carlisle
  "DL", // Darlington (partial)
  "NE", // Newcastle
];

/**
 * Infer climate seasonality from ZIP/Postcode
 *
 * @param zipCode - US ZIP code (5 digits) or UK postcode
 * @param region - "US" or "UK"
 * @returns Inferred climate seasonality
 */
export function inferClimateFromZip(
  zipCode: string,
  region: "US" | "UK"
): ClimateSeasonality {
  if (!zipCode || zipCode.trim() === "") {
    return "UNKNOWN";
  }

  const normalized = zipCode.trim().toUpperCase();

  if (region === "UK") {
    // UK: Check postcode prefix (1-2 letters)
    const prefix = normalized.match(/^[A-Z]{1,2}/)?.[0] || "";

    if (UK_COLD_PREFIXES.includes(prefix)) {
      return "COLD_WINTER";
    }

    // Most of UK is MIXED (temperate maritime)
    return "MIXED";
  }

  // US: Check 3-digit ZIP prefix
  const prefix3 = normalized.substring(0, 3);

  if (US_COLD_PREFIXES.includes(prefix3)) {
    return "COLD_WINTER";
  }

  if (US_HOT_PREFIXES.includes(prefix3)) {
    return "HOT_SUMMER";
  }

  // Default to MIXED for moderate climates
  return "MIXED";
}

/**
 * Get human-readable climate label
 */
export function getClimateLabel(climate: ClimateSeasonality): string {
  const labels: Record<ClimateSeasonality, string> = {
    MILD: "Mild year-round",
    COLD_WINTER: "Cold winters",
    HOT_SUMMER: "Hot summers",
    MIXED: "Mixed seasons",
    UNKNOWN: "Not sure",
  };
  return labels[climate];
}

/**
 * Get climate description for UI
 */
export function getClimateDescription(climate: ClimateSeasonality): string {
  const descriptions: Record<ClimateSeasonality, string> = {
    MILD: "Temperatures rarely drop below freezing or exceed 90°F (32°C)",
    COLD_WINTER: "Regular snow, ice, or extended periods below freezing",
    HOT_SUMMER: "Extended periods above 95°F (35°C) that affect battery performance",
    MIXED: "Distinct seasons with both cold winters and warm summers",
    UNKNOWN: "We'll use conservative assumptions",
  };
  return descriptions[climate];
}
