/**
 * Battery warranty data by manufacturer.
 * Coverage = years OR miles (whichever comes first).
 */

export interface WarrantyEntry {
  years: number;
  miles: number;
  start_year: number; // first model year this warranty applies to
}

export interface WarrantyOverride {
  years: number;
  miles: number;
  before_year: number; // applies when vehicle year < before_year
}

// Model+year-specific exceptions to the make-level defaults
export const WARRANTY_OVERRIDES: Record<string, WarrantyOverride> = {
  "nissan leaf": { years: 5, miles: 60_000, before_year: 2019 },
};

export const WARRANTY_TABLE: Record<string, WarrantyEntry> = {
  "tesla":          { years: 8, miles: 100_000, start_year: 2012 },
  "hyundai":        { years: 10, miles: 100_000, start_year: 2019 },
  "kia":            { years: 10, miles: 100_000, start_year: 2021 },
  "genesis":        { years: 10, miles: 100_000, start_year: 2021 },
  "chevrolet":      { years: 8, miles: 100_000, start_year: 2014 },
  "gmc":            { years: 8, miles: 100_000, start_year: 2022 },
  "cadillac":       { years: 8, miles: 100_000, start_year: 2023 },
  "ford":           { years: 8, miles: 100_000, start_year: 2021 },
  "rivian":         { years: 8, miles: 175_000, start_year: 2022 },
  "volkswagen":     { years: 8, miles: 100_000, start_year: 2021 },
  "nissan":         { years: 8, miles: 100_000, start_year: 2011 },
  "bmw":            { years: 8, miles: 100_000, start_year: 2021 },
  "mini":           { years: 8, miles: 100_000, start_year: 2020 },
  "audi":           { years: 8, miles: 100_000, start_year: 2021 },
  "mercedes-benz":  { years: 10, miles: 120_000, start_year: 2022 },
  "polestar":       { years: 8, miles: 100_000, start_year: 2020 },
  "volvo":          { years: 8, miles: 100_000, start_year: 2021 },
  "lucid":          { years: 8, miles: 100_000, start_year: 2021 },
  "subaru":         { years: 8, miles: 100_000, start_year: 2023 },
  "toyota":         { years: 8, miles: 100_000, start_year: 2023 },
  "honda":          { years: 8, miles: 100_000, start_year: 2024 },
  "acura":          { years: 8, miles: 100_000, start_year: 2024 },
  "jeep":           { years: 8, miles: 100_000, start_year: 2022 },
  "ram":            { years: 8, miles: 100_000, start_year: 2024 },
  "dodge":          { years: 8, miles: 100_000, start_year: 2024 },
  "fisker":         { years: 8, miles: 100_000, start_year: 2023 },
  "default":        { years: 8, miles: 100_000, start_year: 2015 },
};

export function getWarranty(make: string, model?: string, year?: number): WarrantyEntry {
  if (model && year) {
    const key = `${make.toLowerCase().trim()} ${model.toLowerCase().trim()}`;
    const override = WARRANTY_OVERRIDES[key];
    if (override && year < override.before_year) {
      return { years: override.years, miles: override.miles, start_year: year };
    }
  }
  const makeKey = make.toLowerCase().trim();
  return WARRANTY_TABLE[makeKey] ?? WARRANTY_TABLE["default"];
}

/** Battery replacement cost estimate based on kWh at 2024 industry rates. */
export function estimateReplacementCost(battery_kwh: number): { low: number; high: number } {
  const cost_per_kwh = 130; // USD/kWh — BloombergNEF 2024
  const base = battery_kwh * cost_per_kwh;
  return {
    low: Math.round(base * 0.85 / 100) * 100,
    high: Math.round(base * 1.30 / 100) * 100,
  };
}

export type WarrantyStatus = "covered" | "expiring_soon" | "expired";

export interface WarrantyResult {
  make: string;
  model: string;
  year: number;
  warranty_years: number;
  warranty_miles: number;
  expiry_year: number;
  expiry_miles: number;
  current_mileage: number;
  years_remaining: number;
  miles_remaining: number;
  pct_time_used: number;
  pct_miles_used: number;
  status: WarrantyStatus;
  replacement_cost_low: number;
  replacement_cost_high: number;
  battery_kwh?: number;
}

export function computeWarrantyResult(
  make: string,
  model: string,
  year: number,
  currentMileage: number,
  currentYear: number,
  battery_kwh?: number
): WarrantyResult {
  const entry = getWarranty(make, model, year);
  const expiry_year = year + entry.years;
  const years_remaining = Math.max(0, expiry_year - currentYear);
  const miles_remaining = Math.max(0, entry.miles - currentMileage);
  const years_elapsed = currentYear - year;
  const pct_time_used = Math.min(100, Math.round((years_elapsed / entry.years) * 100));
  const pct_miles_used = Math.min(100, Math.round((currentMileage / entry.miles) * 100));

  let status: WarrantyStatus;
  if (years_remaining === 0 || miles_remaining === 0) {
    status = "expired";
  } else if (years_remaining <= 1 || miles_remaining <= 10_000) {
    status = "expiring_soon";
  } else {
    status = "covered";
  }

  const kwh = battery_kwh ?? 75;
  const { low, high } = estimateReplacementCost(kwh);

  return {
    make,
    model,
    year,
    warranty_years: entry.years,
    warranty_miles: entry.miles,
    expiry_year,
    expiry_miles: entry.miles,
    current_mileage: currentMileage,
    years_remaining,
    miles_remaining,
    pct_time_used,
    pct_miles_used,
    status,
    replacement_cost_low: low,
    replacement_cost_high: high,
    battery_kwh: battery_kwh,
  };
}
