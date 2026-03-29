/**
 * Damage Signal Parser
 *
 * Extracts structured damage signals from free-text lot descriptions.
 * Handles negation context, severity escalation, and multi-field aggregation.
 *
 * Replaces the raw keyword × fixed-points approach in salvage-risk-scorer.ts.
 * Returns typed signals with confidence rather than a raw hit count.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DamageSeverity = "none" | "possible" | "likely" | "confirmed";

export interface DamageSignal {
  detected: boolean;
  severity: DamageSeverity;
  /** 0.0–1.0 — how confident we are in the detection */
  confidence: number;
  /** Which phrases triggered this signal */
  matched_phrases: string[];
}

export interface DamageSignals {
  battery: DamageSignal;
  structural: DamageSignal;
  flood: DamageSignal;
  fire: DamageSignal;
  electrical: DamageSignal;
  /** True when there is no usable text to analyze */
  no_data: boolean;
  /** Inferred dominant damage category for repair cost lookup */
  primary_category: DamageCategory;
}

export type DamageCategory =
  | "battery"
  | "flood"
  | "fire"
  | "structural"
  | "electrical"
  | "front_end"
  | "rear_end"
  | "side"
  | "rollover"
  | "theft_recovery"
  | "unknown";

// ── Keyword lists ─────────────────────────────────────────────────────────────

// Each entry: [phrase, severity weight 1–3]
// Weight 1 = possible, 2 = likely, 3 = confirmed
const BATTERY_PHRASES: [string, number][] = [
  ["battery fire", 3],
  ["battery damage", 3],
  ["battery pack damage", 3],
  ["pack damage", 3],
  ["hv damage", 3],
  ["high voltage damage", 3],
  ["thermal event", 3],
  ["thermal runaway", 3],
  ["pack replacement", 2],
  ["battery concern", 2],
  ["battery issue", 2],
  ["hv system", 1],
  ["battery", 1],
];

const STRUCTURAL_PHRASES: [string, number][] = [
  ["frame bent", 3],
  ["frame damage", 3],
  ["unibody damage", 3],
  ["structural damage", 3],
  ["rollover", 3],
  ["roof damage", 2],
  ["underbody damage", 2],
  ["airbag deployed", 2],
  ["multiple impacts", 2],
  ["frame", 1],
  ["structural", 1],
  ["front end", 1],
  ["rear end", 1],
  ["side impact", 1],
  ["undercarriage", 1],
  ["suspension", 1],
  ["collision", 1],
];

const FLOOD_PHRASES: [string, number][] = [
  ["submerged", 3],
  ["flood damage", 3],
  ["water damage", 3],
  ["flooded", 3],
  ["hurricane", 3],
  ["water intrusion", 2],
  ["water logged", 2],
  ["hail and flood", 2],
  ["flood", 2],
  ["water", 1],
];

const FIRE_PHRASES: [string, number][] = [
  ["fire damage", 3],
  ["burned", 3],
  ["burn damage", 3],
  ["thermal damage", 3],
  ["charred", 3],
  ["fire", 2],
  ["smoke damage", 2],
  ["heat damage", 2],
];

const ELECTRICAL_PHRASES: [string, number][] = [
  ["electrical fire", 3],
  ["onboard charger damage", 3],
  ["dcdc converter", 3],
  ["charging port damage", 2],
  ["electrical damage", 2],
  ["wiring harness damage", 2],
  ["module failure", 2],
  ["electrical issue", 1],
  ["electrical", 1],
];

// Negation words — if any appear within NEGATION_WINDOW tokens before a keyword
const NEGATION_WORDS = [
  "no", "not", "without", "intact", "undamaged", "clear", "good", "clean",
  "unaffected", "ok", "okay", "none", "free", "zero", "tested",
];
const NEGATION_WINDOW = 7; // tokens to look behind

// ── Core parser ───────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * Check if a match at `matchIndex` (character position) in `text`
 * is preceded by a negation word within NEGATION_WINDOW tokens.
 */
function isNegated(text: string, matchIndex: number): boolean {
  const preceding = text.slice(0, matchIndex);
  const tokens = tokenize(preceding);
  const window = tokens.slice(-NEGATION_WINDOW);
  return window.some((t) => NEGATION_WORDS.includes(t));
}

function extractSignal(
  text: string,
  phrases: [string, number][]
): DamageSignal {
  if (!text.trim()) {
    return { detected: false, severity: "none", confidence: 0, matched_phrases: [] };
  }

  const lower = text.toLowerCase();
  let maxWeight = 0;
  const matched: string[] = [];

  for (const [phrase, weight] of phrases) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      if (!isNegated(lower, idx)) {
        if (weight > maxWeight) maxWeight = weight;
        if (!matched.includes(phrase)) matched.push(phrase);
      }
      idx = lower.indexOf(phrase, idx + 1);
    }
  }

  if (matched.length === 0) {
    return { detected: false, severity: "none", confidence: 0, matched_phrases: [] };
  }

  const severity: DamageSeverity =
    maxWeight >= 3 ? "confirmed" : maxWeight === 2 ? "likely" : "possible";

  // Confidence: more distinct phrase matches = higher confidence, capped at 0.95
  const confidence = Math.min(0.95, 0.4 + matched.length * 0.18);

  return { detected: true, severity, confidence, matched_phrases: matched };
}

// ── Category-level detection for repair cost routing ─────────────────────────

const FRONT_END_PHRASES = ["front end", "front impact", "front collision", "hood damage", "bumper damage"];
const REAR_END_PHRASES = ["rear end", "rear impact", "rear collision", "trunk damage"];
const SIDE_PHRASES = ["side impact", "side damage", "door damage", "quarter panel"];
const ROLLOVER_PHRASES = ["rollover", "roll over", "rolled over", "roof crush"];
const THEFT_PHRASES = ["theft recovery", "stolen", "theft", "stripped"];

function inferPrimaryCategory(
  text: string,
  signals: Omit<DamageSignals, "primary_category" | "no_data">
): DamageCategory {
  const lower = text.toLowerCase();

  // High-severity categories take priority
  if (signals.fire.severity === "confirmed" || signals.fire.severity === "likely") return "fire";
  if (signals.flood.severity === "confirmed" || signals.flood.severity === "likely") return "flood";
  if (signals.battery.severity === "confirmed") return "battery";
  if (signals.structural.severity === "confirmed") return "structural";
  if (signals.battery.severity === "likely") return "battery";

  // Location-specific damage
  if (ROLLOVER_PHRASES.some((p) => lower.includes(p))) return "rollover";
  if (THEFT_PHRASES.some((p) => lower.includes(p))) return "theft_recovery";
  if (FRONT_END_PHRASES.some((p) => lower.includes(p))) return "front_end";
  if (REAR_END_PHRASES.some((p) => lower.includes(p))) return "rear_end";
  if (SIDE_PHRASES.some((p) => lower.includes(p))) return "side";

  if (signals.electrical.detected) return "electrical";
  if (signals.structural.detected) return "structural";
  if (signals.flood.detected) return "flood";
  if (signals.fire.detected) return "fire";
  if (signals.battery.detected) return "battery";

  return "unknown";
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse damage signals from one or more text fields.
 * Pass all available text — the parser merges them.
 */
export function parseDamageSignals(
  ...textFields: (string | null | undefined)[]
): DamageSignals {
  const combined = textFields.filter(Boolean).join(" ").trim();

  if (!combined || combined.length < 4) {
    const empty: DamageSignal = { detected: false, severity: "none", confidence: 0, matched_phrases: [] };
    return {
      battery: empty,
      structural: empty,
      flood: empty,
      fire: empty,
      electrical: empty,
      no_data: true,
      primary_category: "unknown",
    };
  }

  const battery = extractSignal(combined, BATTERY_PHRASES);
  const structural = extractSignal(combined, STRUCTURAL_PHRASES);
  const flood = extractSignal(combined, FLOOD_PHRASES);
  const fire = extractSignal(combined, FIRE_PHRASES);
  const electrical = extractSignal(combined, ELECTRICAL_PHRASES);

  const primary_category = inferPrimaryCategory(combined, {
    battery, structural, flood, fire, electrical,
  });

  return {
    battery,
    structural,
    flood,
    fire,
    electrical,
    no_data: false,
    primary_category,
  };
}

// ── Severity → numeric risk helpers (used by salvage scorer) ─────────────────

export function severityToRisk(signal: DamageSignal): number {
  if (!signal.detected) return 0;
  const base =
    signal.severity === "confirmed" ? 80 :
    signal.severity === "likely"    ? 55 :
                                      30; // possible
  return Math.round(base * signal.confidence);
}
