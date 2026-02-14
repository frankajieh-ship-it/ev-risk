/**
 * Routine Fit — Receipt-aware deterministic scoring
 *
 * Evaluates how well a used EV fits a buyer's daily routine.
 * Pure function, no network calls.
 *
 * Weights:
 *   Charging access  40%
 *   Range buffer      30%
 *   Recovery ease     15%
 *   Climate impact    15%
 *
 * Mileage penalty: up to 10 points deducted for >60k mi (battery degradation proxy).
 * Assumes ~200 mi effective range for a typical used EV.
 */

export interface RoutineFitReceiptInput {
  charging_access: "home" | "work" | "public";
  weekly_miles: number;
  climate: "winter" | "mild" | "hot";
  longest_trip: "weekly" | "monthly" | "rarely";
  mileage?: number; // from receipt listing
}

export interface RoutineFitReceiptResult {
  score: number;        // 0–100
  label: string;        // Great Fit | Good Fit | Mixed Fit | High Friction
  mental_load: string;  // low | medium | high
  stress_flags: string[]; // max 2
}

const EFFECTIVE_RANGE = 200; // miles

export function computeRoutineFitReceipt(input: RoutineFitReceiptInput): RoutineFitReceiptResult {
  const stressFlags: string[] = [];

  // --- Charging (40 pts) ---
  let charging: number;
  switch (input.charging_access) {
    case "home":
      charging = 40;
      break;
    case "work":
      charging = 28;
      stressFlags.push("No home charging — recovery depends on workplace access");
      break;
    case "public":
      charging = 12;
      stressFlags.push("Public-only charging adds planning overhead every week");
      break;
  }

  // --- Range buffer (30 pts) ---
  const dailyMiles = input.weekly_miles / 7;
  const bufferRatio = dailyMiles > 0 ? EFFECTIVE_RANGE / dailyMiles : 10;
  let rangeBuffer: number;
  if (bufferRatio >= 4) {
    rangeBuffer = 30;
  } else if (bufferRatio >= 2.5) {
    rangeBuffer = 24;
  } else if (bufferRatio >= 1.5) {
    rangeBuffer = 15;
    if (stressFlags.length < 2) {
      stressFlags.push("Tight daily range margin — charge discipline needed");
    }
  } else {
    rangeBuffer = 6;
    if (stressFlags.length < 2) {
      stressFlags.push("Daily mileage may exceed comfortable range");
    }
  }

  // --- Recovery (15 pts) ---
  let recovery: number;
  switch (input.longest_trip) {
    case "rarely":
      recovery = 15;
      break;
    case "monthly":
      recovery = 10;
      break;
    case "weekly":
      recovery = 5;
      if (stressFlags.length < 2) {
        stressFlags.push("Frequent long drives may require mid-trip charging stops");
      }
      break;
  }

  // --- Climate (15 pts) ---
  let climate: number;
  switch (input.climate) {
    case "mild":
      climate = 15;
      break;
    case "hot":
      climate = 11;
      break;
    case "winter":
      climate = 7;
      if (stressFlags.length < 2) {
        stressFlags.push("Cold winters reduce effective range by 20–30%");
      }
      break;
  }

  // --- Mileage penalty (up to -10) ---
  let mileagePenalty = 0;
  if (input.mileage !== undefined && input.mileage > 60000) {
    const excess = Math.min(input.mileage - 60000, 100000); // cap penalty growth
    mileagePenalty = Math.round((excess / 100000) * 10);
    if (mileagePenalty >= 5 && stressFlags.length < 2) {
      stressFlags.push("High mileage may mean reduced battery capacity");
    }
  }

  const rawScore = charging + rangeBuffer + recovery + climate - mileagePenalty;
  const score = Math.max(0, Math.min(100, rawScore));

  // Label
  let label: string;
  if (score >= 80) label = "Great Fit";
  else if (score >= 60) label = "Good Fit";
  else if (score >= 40) label = "Mixed Fit";
  else label = "High Friction";

  // Mental load
  let mental_load: string;
  if (score >= 75) mental_load = "low";
  else if (score >= 50) mental_load = "medium";
  else mental_load = "high";

  return {
    score,
    label,
    mental_load,
    stress_flags: stressFlags.slice(0, 2),
  };
}
