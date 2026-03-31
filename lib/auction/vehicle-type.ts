/**
 * Vehicle type detection for auction lots.
 *
 * Determines whether a lot is an EV, PHEV, or ICE vehicle based on
 * make/model lookup + damage/condition keyword signals.
 */

export type VehicleType = "ev" | "phev" | "ice" | "unknown"

// Known EV makes and model keywords (lowercase)
const EV_MODELS: Record<string, string[]> = {
  tesla: ["model 3", "model y", "model s", "model x", "cybertruck", "model 2", "roadster"],
  chevrolet: ["bolt", "silverado ev"],
  chevy: ["bolt"],
  nissan: ["leaf"],
  ford: ["mustang mach-e", "f-150 lightning", "f150 lightning"],
  hyundai: ["ioniq 5", "ioniq 6", "ioniq5", "ioniq6"],
  kia: ["ev6", "ev9", "niro ev"],
  rivian: ["r1t", "r1s"],
  bmw: ["i4", "ix", "i3"],
  volkswagen: ["id.4", "id4"],
  audi: ["e-tron", "q4 e-tron"],
  porsche: ["taycan"],
  mercedes: ["eqs", "eqb", "eqe", "eqs suv"],
  gmc: ["hummer ev", "sierra ev"],
  cadillac: ["lyriq"],
  honda: ["prologue"],
  toyota: ["bz4x"],
  subaru: ["solterra"],
  volvo: ["xc40 recharge", "c40 recharge", "ex90"],
  polestar: ["2", "3", "4"],
  lucid: ["air"],
  fisker: ["ocean"],
  canoo: [],
  lordstown: [],
  lightyear: [],
  arrival: [],
}

// Known PHEV makes and model keywords (lowercase)
const PHEV_MODELS: Record<string, string[]> = {
  toyota: ["prius prime", "rav4 prime"],
  honda: ["clarity phev"],
  ford: ["escape phev", "fusion energi", "f-150 phev"],
  jeep: ["wrangler 4xe", "grand cherokee 4xe"],
  chrysler: ["pacifica hybrid"],
  hyundai: ["tucson phev", "santa fe phev"],
  kia: ["sorento phev", "sportage phev"],
  mitsubishi: ["outlander phev"],
  bmw: ["330e", "530e", "x5 xdrive45e"],
  mercedes: ["c350e", "gle 350de"],
  volvo: ["xc60 recharge", "xc90 recharge"],
  audi: ["q5 tfsi e"],
  porsche: ["panamera phev", "cayenne phev"],
}

// EV/HV damage keywords — if any appear in damage text, likely an EV
const EV_DAMAGE_KEYWORDS = [
  "battery pack", "hv battery", "high voltage", "ev battery", "hv damage",
  "hv system", "thermal runaway", "battery fire", "bms", "ocb", "onboard charger",
  "charging port", "dc fast charge", "chademo", "ccs", "level 2 charge",
  "electric motor", "drive unit", "inverter", "hv cable", "hv wiring",
]

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").trim()
}

function matchesMakeModel(
  make: string | null,
  model: string | null,
  table: Record<string, string[]>
): boolean {
  if (!make) return false
  const makeNorm = normalize(make)
  const modelNorm = model ? normalize(model) : ""

  for (const [tableMake, models] of Object.entries(table)) {
    if (normalize(tableMake) !== makeNorm) continue
    // Make match — if no model entries, it's always this type
    if (models.length === 0) return true
    if (!modelNorm) return false
    return models.some(
      (m) => modelNorm.includes(normalize(m)) || normalize(m).includes(modelNorm)
    )
  }
  return false
}

function hasDamageEvSignal(text: string | null): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return EV_DAMAGE_KEYWORDS.some((kw) => lower.includes(kw))
}

/**
 * Detect vehicle type from lot data.
 *
 * Priority:
 * 1. Make/model lookup against known EV/PHEV tables
 * 2. EV-specific damage/condition keyword signals
 * 3. "unknown" when no signal is available
 */
export function detectVehicleType(params: {
  make: string | null
  model: string | null
  year?: number | null
  primaryDamage?: string | null
  conditionNotes?: string | null
}): VehicleType {
  const { make, model, primaryDamage, conditionNotes } = params

  if (matchesMakeModel(make, model, EV_MODELS)) return "ev"
  if (matchesMakeModel(make, model, PHEV_MODELS)) return "phev"

  // Fallback: EV damage signals in listing
  const damageText = [primaryDamage, conditionNotes].filter(Boolean).join(" ")
  if (hasDamageEvSignal(damageText)) return "ev"

  // If make is known but not in EV table, it's ICE
  if (make) return "ice"

  return "unknown"
}

export function isElectric(type: VehicleType): boolean {
  return type === "ev" || type === "phev"
}
