/**
 * Fallback ARV Estimation
 *
 * When Auto.dev cannot find salvage comps (ARV = null), estimate clean
 * market value from depreciation curves applied to known original MSRP data.
 *
 * Covers both EV and common ICE vehicles that appear frequently in salvage auctions.
 * Confidence is always "estimated" to distinguish from real comp-based ARV.
 */

// ── Common ICE vehicles at salvage auctions (USD, approximate base/mid MSRP) ──
// Note: For old ICE (10+ years), the MSRP-based curve is less relevant.
// We store the ORIGINAL MSRP and let the depreciation curve do the work.
const ICE_MSRP_TABLE: Record<string, Record<string, number>> = {
  // Full-size trucks/SUVs (most common at salvage)
  Chevrolet: {
    Tahoe: 56600,
    Suburban: 62400,
    Silverado: 38700,
    "Silverado 1500": 38700,
    "Silverado 2500": 43900,
    "Silverado 3500": 46600,
    Colorado: 30400,
    Equinox: 31400,
    Traverse: 38200,
    Malibu: 24200,
    Impala: 28000,
    Camaro: 29000,
    Corvette: 67895,
    Blazer: 33600,
    Trax: 21300,
  },
  GMC: {
    Yukon: 56000,
    "Yukon XL": 62000,
    Sierra: 40000,
    "Sierra 1500": 40000,
    "Sierra 2500": 44600,
    "Sierra 3500": 47900,
    Canyon: 31400,
    Terrain: 31200,
    Acadia: 37500,
  },
  Ford: {
    "F-150": 33695,
    "F-250": 40000,
    "F-350": 43500,
    Explorer: 37000,
    Expedition: 55000,
    Escape: 28000,
    Edge: 34000,
    Ranger: 31000,
    Bronco: 33695,
    "Bronco Sport": 29395,
    Mustang: 29995,
    Fusion: 24000,
    Focus: 19000,
    Transit: 41000,
  },
  Dodge: {
    Ram: 37690,
    "Ram 1500": 37690,
    "Ram 2500": 43445,
    "Ram 3500": 48595,
    Durango: 37995,
    Challenger: 30995,
    Charger: 31495,
    Journey: 24000,
  },
  Ram: {
    "1500": 37690,
    "2500": 43445,
    "3500": 48595,
    ProMaster: 33195,
  },
  Jeep: {
    "Grand Cherokee": 37995,
    Wrangler: 30995,
    Cherokee: 27995,
    Compass: 25995,
    Renegade: 22995,
    Gladiator: 38995,
  },
  Chrysler: {
    Pacifica: 37950,
    "300": 33000,
  },
  Toyota: {
    Camry: 26420,
    Corolla: 21550,
    "RAV4": 29975,
    Tacoma: 29150,
    Tundra: 38310,
    "4Runner": 39120,
    Highlander: 38785,
    Sienna: 38460,
    Prius: 27600,
    Sequoia: 60895,
    "Land Cruiser": 89995,
    Avalon: 36825,
    Venza: 33975,
  },
  Honda: {
    Accord: 27995,
    Civic: 24950,
    "CR-V": 30950,
    Pilot: 38950,
    Odyssey: 36370,
    Ridgeline: 40475,
    "HR-V": 24850,
    Passport: 42075,
  },
  Nissan: {
    Altima: 24550,
    Rogue: 29300,
    Pathfinder: 35000,
    Murano: 36450,
    Frontier: 31490,
    Titan: 42500,
    Sentra: 20050,
    Maxima: 37550,
    Armada: 58845,
  },
  Hyundai: {
    Sonata: 26100,
    Elantra: 21900,
    Tucson: 28550,
    "Santa Fe": 30250,
    Palisade: 37045,
    Kona: 23250,
    Veloster: 19700,
  },
  Kia: {
    Optima: 24500,
    Sorento: 30235,
    Telluride: 35690,
    Sportage: 26090,
    Forte: 18890,
    "K5": 24990,
    Carnival: 33200,
  },
  Subaru: {
    Outback: 28795,
    Forester: 26895,
    Impreza: 20745,
    Crosstrek: 24595,
    Legacy: 24095,
    Ascent: 34995,
    WRX: 30605,
  },
  Volkswagen: {
    Jetta: 20895,
    Passat: 25895,
    Tiguan: 27995,
    Atlas: 33415,
    Golf: 25995,
    "Golf GTI": 31395,
  },
  BMW: {
    "3 Series": 43700,
    "5 Series": 56900,
    "7 Series": 97900,
    X3: 45400,
    X5: 62900,
    X7: 77900,
    "2 Series": 38600,
    M3: 74900,
  },
  Mercedes: {
    "C-Class": 44400,
    "E-Class": 55250,
    "S-Class": 116400,
    GLE: 58700,
    GLC: 47550,
    GLS: 82050,
    "A-Class": 36500,
  },
  Audi: {
    A4: 40300,
    A6: 56700,
    Q5: 44900,
    Q7: 57500,
    Q8: 72900,
  },
  Lexus: {
    RX: 47500,
    ES: 41600,
    GX: 59000,
    LX: 93000,
    NX: 39000,
    UX: 34400,
  },
  Acura: {
    MDX: 49200,
    RDX: 39700,
    TLX: 38700,
  },
  Infiniti: {
    QX60: 47900,
    QX80: 70400,
    Q50: 38850,
  },
  Cadillac: {
    Escalade: 79995,
    "Escalade ESV": 84995,
    XT5: 47695,
    XT6: 52195,
    CT5: 38890,
  },
  Lincoln: {
    Navigator: 79995,
    Aviator: 52235,
    Corsair: 37945,
    Nautilus: 44380,
  },
  Buick: {
    Enclave: 44500,
    Encore: 25400,
    Envision: 33400,
  },
  Jaguar: {
    "F-PACE": 56900,
    "E-PACE": 43900,
    "XE": 35900,
    "XF": 46900,
    "F-TYPE": 69900,
    "I-PACE": 69900,
    "XJ": 74900,
  },
  "Land Rover": {
    "Range Rover": 102900,
    "Range Rover Sport": 80900,
    "Range Rover Velar": 60900,
    "Range Rover Evoque": 46900,
    "Discovery": 57900,
    "Discovery Sport": 42900,
    "Defender": 56900,
  },
  Volvo: {
    XC90: 56300,
    XC60: 44400,
    XC40: 37500,
    S60: 42300,
    S90: 61200,
    V60: 44000,
    V90: 56700,
  },
  Maserati: {
    Ghibli: 75900,
    Levante: 80900,
    Quattroporte: 110900,
    Grecale: 63900,
  },
  Genesis: {
    GV80: 54400,
    GV70: 44500,
    G80: 50000,
    G70: 36900,
  },
  Alfa: {
    Stelvio: 47900,
    Giulia: 45900,
  },
  "Alfa Romeo": {
    Stelvio: 47900,
    Giulia: 45900,
  },
  Porsche: {
    Cayenne: 72200,
    Macan: 58400,
    Panamera: 92900,
    "911": 114400,
    Boxster: 65400,
    Cayman: 63400,
  },
  Tesla: {
    "Model 3": 42990,
    "Model Y": 47990,
    "Model S": 89990,
    "Model X": 99990,
    Cybertruck: 60990,
  },
  Mazda: {
    "CX-5": 28200,
    "CX-9": 38900,
    "CX-50": 30500,
    "Mazda3": 23400,
    "Mazda6": 28900,
    "MX-5": 29050,
  },
  Mitsubishi: {
    Outlander: 29095,
    Eclipse: 26900,
    "Outlander Sport": 23595,
  },
}

// Base MSRP table for common salvage EVs (USD, approximate mid-trim)
const MSRP_TABLE: Record<string, Record<string, number>> = {
  Tesla: {
    "Model 3": 42990,
    "Model Y": 47990,
    "Model S": 89990,
    "Model X": 99990,
    "Model 2": 25000,
    Cybertruck: 60990,
  },
  Chevrolet: {
    Bolt: 26500,
    "Bolt EUV": 28195,
  },
  Nissan: {
    LEAF: 28040,
    "Leaf": 28040,
  },
  Ford: {
    "Mustang Mach-E": 42995,
    "F-150 Lightning": 55974,
  },
  Hyundai: {
    "IONIQ 5": 43450,
    "Ioniq 5": 43450,
    "IONIQ 6": 38615,
    "Ioniq 6": 38615,
    "Kona Electric": 33550,
  },
  Kia: {
    EV6: 42600,
    "EV9": 54900,
    "Niro EV": 39600,
  },
  Rivian: {
    R1T: 69900,
    R1S: 75900,
  },
  BMW: {
    i4: 56395,
    iX: 87100,
    i3: 44450,
  },
  Volkswagen: {
    "ID.4": 38995,
  },
  Audi: {
    "e-tron": 65900,
    "Q4 e-tron": 48400,
  },
  Porsche: {
    Taycan: 89390,
  },
  Mercedes: {
    EQS: 104400,
    EQB: 54500,
  },
  GMC: {
    Hummer: 79995,
    "Hummer EV": 79995,
  },
  Cadillac: {
    Lyriq: 58590,
    LYRIQ: 58590,
  },
}

/**
 * EV depreciation curve: fraction of MSRP remaining by age in years.
 * EVs depreciate faster than ICE in years 1–4 due to battery concerns & rapid model refresh.
 */
const EV_DEPRECIATION_CURVE: number[] = [
  1.00, // 0 years (new)
  0.82, // 1 year
  0.70, // 2 years
  0.61, // 3 years
  0.53, // 4 years
  0.46, // 5 years
  0.41, // 6 years
  0.36, // 7 years
  0.32, // 8 years
  0.28, // 9 years
  0.25, // 10+ years
]

/**
 * ICE depreciation curve: slower initial drop, flatter tail.
 * Trucks/SUVs hold value better; sedans depreciate slightly faster.
 * This is a blended average; good enough for ARV estimation.
 */
const ICE_DEPRECIATION_CURVE: number[] = [
  1.00, // 0 years (new)
  0.80, // 1 year
  0.69, // 2 years
  0.60, // 3 years
  0.53, // 4 years
  0.47, // 5 years
  0.42, // 6 years
  0.38, // 7 years
  0.34, // 8 years
  0.31, // 9 years
  0.28, // 10 years
  0.25, // 11 years
  0.22, // 12 years
  0.19, // 13 years
  0.17, // 14 years
  0.15, // 15 years
  0.13, // 16 years
  0.12, // 17 years
  0.11, // 18 years
  0.10, // 19 years
  0.09, // 20+ years
]

function normalize(str: string): string {
  return str.toLowerCase().replace(/[-_\s]+/g, " ").trim()
}

function lookupInTable(
  make: string,
  model: string,
  table: Record<string, Record<string, number>>
): number | null {
  const makeNorm = normalize(make)
  for (const [tableMake, models] of Object.entries(table)) {
    if (normalize(tableMake) !== makeNorm) continue
    for (const [tableModel, msrp] of Object.entries(models)) {
      if (normalize(tableModel) === normalize(model)) return msrp
      if (normalize(model).includes(normalize(tableModel)) || normalize(tableModel).includes(normalize(model))) {
        return msrp
      }
    }
  }
  return null
}

/** Returns { msrp, isIce } or null if not found in either table */
function lookupMsrp(make: string, model: string): { msrp: number; isIce: boolean } | null {
  const evMsrp = lookupInTable(make, model, MSRP_TABLE)
  if (evMsrp !== null) return { msrp: evMsrp, isIce: false }
  const iceMsrp = lookupInTable(make, model, ICE_MSRP_TABLE)
  if (iceMsrp !== null) return { msrp: iceMsrp, isIce: true }
  return null
}

export interface FallbackArvResult {
  arv: number
  confidence: "estimated"
  source: "depreciation_curve"
  msrp_used: number
  age_years: number
  depreciation_factor: number
}

/**
 * Estimate clean market ARV from MSRP + depreciation curve.
 * Returns null if make/model not in the MSRP table.
 *
 * @param make  - Vehicle make (e.g. "Tesla")
 * @param model - Vehicle model (e.g. "Model 3")
 * @param year  - Model year (e.g. 2021)
 */
export function estimateFallbackArv(
  make: string | null,
  model: string | null,
  year: number | null
): FallbackArvResult | null {
  if (!make || !model || !year) return null

  const lookup = lookupMsrp(make, model)
  if (!lookup) return null

  const { msrp, isIce } = lookup
  const curve = isIce ? ICE_DEPRECIATION_CURVE : EV_DEPRECIATION_CURVE
  const currentYear = new Date().getFullYear()
  const age = Math.max(0, currentYear - year)
  const curveIndex = Math.min(age, curve.length - 1)
  const factor = curve[curveIndex]
  const arv = Math.round(msrp * factor / 100) * 100 // round to nearest $100

  return {
    arv,
    confidence: "estimated",
    source: "depreciation_curve",
    msrp_used: msrp,
    age_years: age,
    depreciation_factor: factor,
  }
}
