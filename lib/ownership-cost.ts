/**
 * computeOwnershipCost
 *
 * Estimates 5-year total cost of EV ownership using transparent, hard-coded
 * national averages. All assumptions are labelled so users can evaluate them.
 *
 * Methodology:
 *  - Purchase price: MSRP from range_delta data (or 0 if unavailable)
 *  - Charging cost: (annual miles / efficiency) × electricity rate × 5 years
 *  - Maintenance: flat EV average (no oil changes, fewer brake jobs)
 *  - Insurance: US average for mid-range EV
 *  - Depreciation: conservative 45% of purchase price over 5 years
 */

import type { MinimumViableRoutine } from "@/types/v2";

// ── Assumptions ──────────────────────────────────────────────────────────────
const ELECTRICITY_RATE_PER_KWH = 0.16;   // USD/kWh — US average 2024 (EIA)
const MAINTENANCE_PER_YEAR     = 600;    // USD/yr  — EV average (Consumer Reports)
const INSURANCE_PER_YEAR       = 1_800;  // USD/yr  — US average mid-range EV
const DEPRECIATION_RATE_5Y     = 0.45;   // 45% of purchase price over 5 years
const DEFAULT_ANNUAL_MILES     = 12_000; // miles/yr fallback

export interface OwnershipCost5Y {
  total:            number;
  purchase_price:   number;
  charging_5y:      number;
  maintenance_5y:   number;
  insurance_5y:     number;
  depreciation_5y:  number;
}

export function computeOwnershipCost(
  vehicle: {
    msrp_usd?: number;
    battery_kwh: number;
    real_world_range_mi: number;
  },
  routine: Pick<MinimumViableRoutine, "weekly_miles" | "commute_miles_roundtrip">
): OwnershipCost5Y {
  const purchasePrice = vehicle.msrp_usd ?? 0;

  // Annual miles
  const annualMiles =
    routine.weekly_miles != null && routine.weekly_miles > 0
      ? routine.weekly_miles * 52
      : routine.commute_miles_roundtrip != null && routine.commute_miles_roundtrip > 0
      ? routine.commute_miles_roundtrip * 5 * 52
      : DEFAULT_ANNUAL_MILES;

  // Efficiency (mi/kWh) derived from real-world range and battery size
  const efficiency =
    vehicle.battery_kwh > 0
      ? vehicle.real_world_range_mi / vehicle.battery_kwh
      : 3.5; // fallback mid-range EV efficiency

  const annualKwh = annualMiles / efficiency;
  const charging5y = Math.round(annualKwh * ELECTRICITY_RATE_PER_KWH * 5);
  const maintenance5y = MAINTENANCE_PER_YEAR * 5;
  const insurance5y = INSURANCE_PER_YEAR * 5;
  const depreciation5y = Math.round(purchasePrice * DEPRECIATION_RATE_5Y);

  const total = charging5y + maintenance5y + insurance5y + depreciation5y;

  return {
    total,
    purchase_price:  purchasePrice,
    charging_5y:     charging5y,
    maintenance_5y:  maintenance5y,
    insurance_5y:    insurance5y,
    depreciation_5y: depreciation5y,
  };
}
