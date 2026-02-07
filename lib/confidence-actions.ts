/**
 * Confidence Action Builder
 *
 * Builds the "Get to 95% confidence" action plan from what data is missing.
 * Pure function, client-safe, no side effects.
 *
 * Confidence math:
 *   Base: 70 (routine is complete via MVR)
 *   VIN provided: +10
 *   SOH provided: +12
 *   Fast-charge history provided: +6
 *   Max: 98 (never 100 — real-world uncertainty always exists)
 */

import type { ConfidenceAction, ConfidencePlan } from "@/types/v2";

interface ConfidencePlanInput {
  vehicle?: { make: string; model: string; year: number };
  vin?: string;
  soh_pct?: number;
  fast_charge_history?: string;
}

const BASE_CONFIDENCE = 70;
const MAX_CONFIDENCE = 98;

const GAINS = {
  vin: 10,
  soh: 12,
  fast_charge: 6,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function vehicleLabel(vehicle?: { make: string; model: string; year: number }): string {
  if (!vehicle) return "this vehicle";
  return `the ${vehicle.year} ${vehicle.model}`;
}

function actionGetVIN(vehicle?: ConfidencePlanInput["vehicle"]): ConfidenceAction {
  const label = vehicleLabel(vehicle);
  return {
    id: "get_vin",
    title: "Ask seller for the VIN",
    why_it_matters:
      "The VIN unlocks recall status, warranty coverage, and platform-specific risk data. Without it, those modules show as \"unknown.\"",
    how_to_get: [
      "Ask the seller to send the 17-character VIN directly",
      "Request a photo of the windshield VIN plate",
      "Check the listing — some sellers include it in the description",
    ],
    message_templates: {
      seller: `Hi, I'm interested in ${label}. Could you share the VIN? I'd like to check recall status and warranty coverage before scheduling a visit. Thanks!`,
      dealer: `Hi, I'm considering ${label} you have listed. Could you send me the VIN so I can verify recall and warranty status? Thank you.`,
    },
    expected_confidence_gain_pct: GAINS.vin,
    required_for_modules: ["recall", "warranty", "platform"],
  };
}

function actionGetSOH(vehicle?: ConfidencePlanInput["vehicle"]): ConfidenceAction {
  const label = vehicleLabel(vehicle);
  return {
    id: "get_soh",
    title: "Get a battery State of Health estimate",
    why_it_matters:
      "Battery health is the single biggest cost risk on a used EV. A State of Health (SOH) reading tells you how much capacity remains and whether degradation is normal for the age and mileage.",
    how_to_get: [
      "Ask the seller if they have a recent SOH reading from a dealer or diagnostic tool",
      "Request a pre-purchase battery health check from a certified EV technician",
      "Some OBD-II apps (like LeafSpy for Nissan, or Scan My Tesla) can read SOH directly",
    ],
    message_templates: {
      seller: `Hi, I'm interested in ${label}. Do you have a recent battery State of Health (SOH) reading, or would you be open to having one done before I visit? This helps me understand the battery condition. Thanks!`,
      dealer: `Hi, I'm considering ${label}. Could you provide the battery State of Health percentage? If you don't have it on file, would you be able to run a diagnostic? Thank you.`,
    },
    expected_confidence_gain_pct: GAINS.soh,
    required_for_modules: ["battery"],
  };
}

function actionFastChargeHistory(vehicle?: ConfidencePlanInput["vehicle"]): ConfidenceAction {
  const label = vehicleLabel(vehicle);
  return {
    id: "get_fast_charge_history",
    title: "Confirm frequent fast charging",
    why_it_matters:
      "Frequent DC fast charging accelerates battery degradation on some chemistries. Knowing whether the previous owner relied heavily on fast charging helps predict future battery health.",
    how_to_get: [
      "Ask the seller about their typical charging habits (home vs. fast charger)",
      "Check if the vehicle's infotainment system shows charging history or DC fast charge count",
      "For Tesla, the vehicle's charging stats may be visible in the app",
    ],
    message_templates: {
      seller: `Hi, one more question about ${label} — do you know roughly how often DC fast charging was used? I'm just trying to understand the charging history. Thanks!`,
    },
    expected_confidence_gain_pct: GAINS.fast_charge,
    required_for_modules: ["battery"],
  };
}

export function buildConfidencePlan(input: ConfidencePlanInput): ConfidencePlan {
  const actions: ConfidenceAction[] = [];
  let fulfilledGains = 0;

  // Check what's already provided
  if (input.vin) {
    fulfilledGains += GAINS.vin;
  } else {
    actions.push(actionGetVIN(input.vehicle));
  }

  if (input.soh_pct != null) {
    fulfilledGains += GAINS.soh;
  } else {
    actions.push(actionGetSOH(input.vehicle));
  }

  if (input.fast_charge_history) {
    fulfilledGains += GAINS.fast_charge;
  } else {
    actions.push(actionFastChargeHistory(input.vehicle));
  }

  const totalPossibleGains = GAINS.vin + GAINS.soh + GAINS.fast_charge;
  const current_pct = clamp(BASE_CONFIDENCE + fulfilledGains, 0, MAX_CONFIDENCE);
  const potential_pct = clamp(BASE_CONFIDENCE + totalPossibleGains, 0, MAX_CONFIDENCE);

  return {
    current_pct,
    potential_pct,
    actions,
  };
}
