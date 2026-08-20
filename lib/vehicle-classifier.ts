/**
 * Vehicle Category Classifier
 *
 * Deterministic EV/PHEV/ICE classification from make + model + optional trim/text.
 * No AI call — uses known model lists and keyword fallback.
 */

export type VehicleCategory = "EV" | "PHEV" | "ICE";
export type VehicleSubCategory = "truck" | "suv" | "sedan" | "hatchback" | "van" | "other";

export type DcfcSupport = "yes" | "no" | "unknown";

export interface VehicleClassification {
  category: VehicleCategory;
  subCategory: VehicleSubCategory;
  confidence: "high" | "medium" | "low";
  dcfcSupport: DcfcSupport;
}

// --- Known EV makes (all models are EV) ---
const ALL_EV_MAKES = new Set([
  "tesla", "rivian", "lucid", "polestar", "fisker",
]);

// --- Known EV models (make → model patterns) ---
const EV_MODELS: Record<string, string[]> = {
  chevrolet: ["bolt", "bolt ev", "bolt euv", "equinox ev", "blazer ev", "silverado ev"],
  chevy: ["bolt", "bolt ev", "bolt euv", "equinox ev", "blazer ev", "silverado ev"],
  ford: ["mustang mach-e", "mach-e", "f-150 lightning", "lightning", "focus electric"],
  hyundai: ["ioniq 5", "ioniq 6", "ioniq5", "ioniq6"],
  kia: ["ev6", "ev9", "niro ev"],
  bmw: ["ix", "i4", "i5", "i7", "ix1", "ix3"],
  mercedes: ["eqs", "eqe", "eqb", "eqa", "eqc", "eqv"],
  "mercedes-benz": ["eqs", "eqe", "eqb", "eqa", "eqc", "eqv"],
  volkswagen: ["id.4", "id.buzz", "id4", "id buzz"],
  vw: ["id.4", "id.buzz", "id4", "id buzz"],
  nissan: ["leaf", "ariya"],
  cadillac: ["lyriq"],
  volvo: ["ex30", "ex90", "ec40", "c40 recharge", "xc40 recharge pure electric"],
  toyota: ["bz4x"],
  subaru: ["solterra"],
  honda: ["prologue"],
  acura: ["zdx"],
  genesis: ["gv60", "electrified g80", "electrified gv70"],
  mini: ["cooper se", "electric"],
  fiat: ["500e"],
  mazda: ["mx-30"],
  smart: ["eq fortwo", "eq forfour", "#1", "#3"],
  porsche: ["taycan"],
  audi: ["e-tron", "etron", "e-tron gt", "q4 e-tron", "q8 e-tron"],
  jaguar: ["i-pace"],
  hummer: ["ev"],
  gmc: ["hummer ev"],
};

// --- DCFC-capable makes (all models support DCFC) ---
const DCFC_CAPABLE_MAKES = new Set([
  "tesla", "rivian", "lucid", "polestar",
]);

// --- EVs known to LACK DCFC (or have very limited/optional DCFC) ---
// NOTE: Only list models where DCFC is absent on ALL or nearly all trims/years.
// The 2022+ Chevrolet Bolt EV/EUV added standard CCS DCFC — do NOT list Bolt here.
const NO_DCFC_MODELS: Record<string, string[]> = {
  nissan: ["leaf"],        // Base Leaf trims lack CHAdeMO; later trims optional — treat as unknown
  fiat: ["500e"],          // Pre-2024 500e has no DCFC
  mazda: ["mx-30"],        // No DCFC port
  smart: ["eq fortwo", "eq forfour"],  // No DCFC
  ford: ["focus electric"],  // No DCFC (J1772 AC only)
  mini: ["cooper se", "electric"],  // No DCFC on early models
};

// --- Known PHEV models ---
const PHEV_MODELS: Record<string, string[]> = {
  toyota: ["rav4 prime", "prius prime"],
  jeep: ["wrangler 4xe", "grand cherokee 4xe"],
  bmw: ["x5 xdrive45e", "330e", "530e", "x3 xdrive30e", "745e"],
  volvo: ["xc60 recharge", "xc90 recharge", "s60 recharge", "s90 recharge", "xc60 t8", "xc90 t8"],
  ford: ["escape phev", "escape plug-in"],
  hyundai: ["tucson phev", "tucson plug-in", "santa fe phev", "santa fe plug-in"],
  kia: ["sportage phev", "sportage plug-in", "sorento phev", "sorento plug-in", "niro phev", "niro plug-in"],
  chrysler: ["pacifica hybrid", "pacifica plug-in"],
  mitsubishi: ["outlander phev", "outlander plug-in"],
  lincoln: ["corsair grand touring", "aviator grand touring"],
  audi: ["a7 tfsi e", "q5 tfsi e"],
  porsche: ["cayenne e-hybrid", "panamera e-hybrid"],
  mercedes: ["gle 350e", "glc 350e", "s 580e"],
  "mercedes-benz": ["gle 350e", "glc 350e", "s 580e"],
  lexus: ["nx 450h+", "rx 450h+"],
  mazda: ["cx-90 phev"],
  range: ["rover p440e", "rover sport p460e"], // Range Rover
};

// --- Truck model patterns ---
const TRUCK_PATTERNS = [
  "f-150", "f150", "f-250", "f250", "f-350", "f350",
  "silverado", "sierra",
  "tundra", "tacoma",
  "ranger", "colorado", "canyon",
  "ram 1500", "ram 2500", "ram 3500", "ram",
  "frontier", "titan",
  "gladiator", "ridgeline",
  "cybertruck", "maverick",
  "r1t", "hummer ev pickup",
  "lightning", "f-150 lightning",
  "silverado ev",
];

// --- SUV patterns ---
const SUV_PATTERNS = [
  "suv", "crossover",
  "rav4", "cr-v", "crv", "cx-5", "cx5", "tucson", "sportage", "rogue", "equinox",
  "4runner", "highlander", "pilot", "pathfinder", "telluride", "palisade",
  "wrangler", "grand cherokee", "explorer", "bronco", "tahoe", "suburban",
  "model x", "model y", "r1s",
  "ioniq 5", "ioniq5", "ev6", "ev9", "id.4", "id4",
  "mach-e", "mustang mach-e", "ariya", "solterra", "bz4x",
  "ix", "ix1", "ix3", "eqs suv", "eqb", "eqc",
  "lyriq", "prologue", "zdx",
  "ex30", "ex90",
];

// --- Hatchback patterns ---
const HATCHBACK_PATTERNS = [
  "hatchback", "hatch",
  "bolt", "bolt ev", "bolt euv",
  "leaf", "500e",
  "golf", "civic hatchback", "corolla hatchback",
  "focus electric", "focus",
  "mini", "cooper",
];

// --- Van patterns ---
const VAN_PATTERNS = [
  "van", "minivan",
  "pacifica", "sienna", "odyssey", "carnival",
  "id.buzz", "id buzz",
  "transit", "sprinter", "promaster",
];

function normalize(s: string): string {
  return (s || "").toLowerCase().trim();
}

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = normalize(text);
  return patterns.some((p) => lower.includes(p));
}

function getDcfcSupport(makeLower: string, modelLower: string): DcfcSupport {
  // Known DCFC-capable makes (all models)
  if (DCFC_CAPABLE_MAKES.has(makeLower)) return "yes";

  // Known no-DCFC models
  const noDcfc = NO_DCFC_MODELS[makeLower];
  if (noDcfc) {
    for (const pattern of noDcfc) {
      if (modelLower.includes(pattern)) return "no";
    }
  }

  // Known DCFC-capable EV models (CCS standard on modern EVs)
  const knownDcfcModels: Record<string, string[]> = {
    hyundai: ["ioniq 5", "ioniq 6", "ioniq5", "ioniq6"],
    kia: ["ev6", "ev9"],
    bmw: ["ix", "i4", "i5", "i7"],
    mercedes: ["eqs", "eqe", "eqb", "eqa"],
    "mercedes-benz": ["eqs", "eqe", "eqb", "eqa"],
    volkswagen: ["id.4", "id.buzz", "id4"],
    vw: ["id.4", "id.buzz", "id4"],
    ford: ["mustang mach-e", "mach-e", "f-150 lightning", "lightning"],
    nissan: ["ariya"],
    cadillac: ["lyriq"],
    volvo: ["ex30", "ex90", "ec40"],
    porsche: ["taycan"],
    audi: ["e-tron", "etron", "e-tron gt", "q4 e-tron", "q8 e-tron"],
    jaguar: ["i-pace"],
    gmc: ["hummer ev"],
    genesis: ["gv60", "electrified g80", "electrified gv70"],
    toyota: ["bz4x"],
    subaru: ["solterra"],
    honda: ["prologue"],
    acura: ["zdx"],
    // 2022+ Bolt EV/EUV has standard CCS DC fast charging (up to 55 kW)
    chevrolet: ["bolt", "bolt ev", "bolt euv"],
    chevy: ["bolt", "bolt ev", "bolt euv"],
  };

  const dcfcModels = knownDcfcModels[makeLower];
  if (dcfcModels) {
    for (const pattern of dcfcModels) {
      if (modelLower.includes(pattern)) return "yes";
    }
  }

  return "unknown";
}

function classifySubCategory(model: string): VehicleSubCategory {
  const m = normalize(model);
  if (matchesAny(m, TRUCK_PATTERNS)) return "truck";
  if (matchesAny(m, VAN_PATTERNS)) return "van";
  if (matchesAny(m, SUV_PATTERNS)) return "suv";
  if (matchesAny(m, HATCHBACK_PATTERNS)) return "hatchback";
  return "other";
}

export function classifyVehicle(
  make: string,
  model: string,
  trim?: string | null,
  listingText?: string | null
): VehicleClassification {
  const makeLower = normalize(make);
  const modelLower = normalize(model);
  const trimLower = normalize(trim || "");
  const combined = `${modelLower} ${trimLower}`;

  // 1. All-EV makes
  if (ALL_EV_MAKES.has(makeLower)) {
    return {
      category: "EV",
      subCategory: classifySubCategory(model),
      confidence: "high",
      dcfcSupport: getDcfcSupport(makeLower, modelLower),
    };
  }

  // 2. Known EV models
  const evModels = EV_MODELS[makeLower];
  if (evModels) {
    for (const pattern of evModels) {
      if (combined.includes(pattern)) {
        return {
          category: "EV",
          subCategory: classifySubCategory(model),
          confidence: "high",
          dcfcSupport: getDcfcSupport(makeLower, modelLower),
        };
      }
    }
  }

  // 3. Known PHEV models
  const phevModels = PHEV_MODELS[makeLower];
  if (phevModels) {
    for (const pattern of phevModels) {
      if (combined.includes(pattern)) {
        return {
          category: "PHEV",
          subCategory: classifySubCategory(model),
          confidence: "high",
          dcfcSupport: "unknown",
        };
      }
    }
  }

  // 4. Trim-based detection (e.g., "4xe", "Prime", "PHEV")
  if (/\b4xe\b/i.test(trimLower) || /\bprime\b/i.test(trimLower) || /\bphev\b/i.test(trimLower)) {
    return {
      category: "PHEV",
      subCategory: classifySubCategory(model),
      confidence: "high",
      dcfcSupport: "unknown",
    };
  }
  if (/\belectric\b/i.test(trimLower) || /\bev\b/i.test(trimLower)) {
    return {
      category: "EV",
      subCategory: classifySubCategory(model),
      confidence: "high",
      dcfcSupport: getDcfcSupport(makeLower, modelLower),
    };
  }

  // 5. Keyword fallback from listing text
  if (listingText) {
    const text = listingText.toLowerCase();

    // Strong EV indicators
    if (
      /\b(fully electric|all[- ]electric|battery electric|bev)\b/.test(text) ||
      (/\bkwh\b/.test(text) && /\b(range|battery)\b/.test(text) && !/\bhybrid\b/.test(text))
    ) {
      return {
        category: "EV",
        subCategory: classifySubCategory(model),
        confidence: "medium",
        dcfcSupport: getDcfcSupport(makeLower, modelLower),
      };
    }

    // PHEV indicators
    if (/\b(plug[- ]?in hybrid|phev)\b/.test(text)) {
      return {
        category: "PHEV",
        subCategory: classifySubCategory(model),
        confidence: "medium",
        dcfcSupport: "unknown",
      };
    }
  }

  // 6. Default: ICE
  return {
    category: "ICE",
    subCategory: classifySubCategory(model),
    confidence: "low",
    dcfcSupport: "unknown",
  };
}
