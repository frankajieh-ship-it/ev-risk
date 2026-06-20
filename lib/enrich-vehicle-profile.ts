/**
 * enrichVehicleProfile — stub after MarketCheck removal.
 * Previously decoded VIN via MarketCheck to populate vehicle_profiles.
 * Kept as a no-op so call sites don't need to change.
 */

export function enrichVehicleProfileFromVin(
  _vin: string,
  _make: string,
  _model: string,
  _year: number
): void {
  // No-op: MarketCheck VIN decode removed. Vehicle profiles are populated manually.
}
