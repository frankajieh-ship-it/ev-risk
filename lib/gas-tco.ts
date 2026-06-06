/**
 * Gas car 5-year Total Cost of Ownership — mirrors lib/ownership-cost.ts for EVs.
 * Used by the TCO Calculator tool (/tools/tco).
 */

export interface GasTCOInputs {
  purchase_price: number;
  annual_miles: number;
  gas_price_per_gallon: number;
  mpg?: number;               // default 28
  insurance_per_year?: number; // default 1_800
}

export interface GasTCO {
  purchase_price: number;
  fuel_5y: number;
  fuel_annual: number;
  maintenance_5y: number;
  maintenance_annual: number;
  insurance_5y: number;
  depreciation_5y: number;
  total_5y: number;
}

const GAS_MAINTENANCE_PER_YEAR = 1_200; // gas cars: oil, filters, brakes, transmission service
const GAS_DEPRECIATION_RATE_5Y = 0.55;  // ~55% value loss over 5 years
const DEFAULT_INSURANCE_PER_YEAR = 1_800; // gas car baseline; EVs carry ~15% premium separately
const DEFAULT_MPG = 28;

export function computeGasTCO(inputs: GasTCOInputs): GasTCO {
  const {
    purchase_price,
    annual_miles,
    gas_price_per_gallon,
    mpg = DEFAULT_MPG,
    insurance_per_year = DEFAULT_INSURANCE_PER_YEAR,
  } = inputs;

  const fuel_annual = (annual_miles / mpg) * gas_price_per_gallon;
  const fuel_5y = Math.round(fuel_annual * 5);
  const maintenance_5y = GAS_MAINTENANCE_PER_YEAR * 5;
  const insurance_5y = insurance_per_year * 5;
  const depreciation_5y = Math.round(purchase_price * GAS_DEPRECIATION_RATE_5Y);

  const total_5y = Math.round(fuel_5y + maintenance_5y + insurance_5y + depreciation_5y);

  return {
    purchase_price,
    fuel_5y,
    fuel_annual: Math.round(fuel_annual),
    maintenance_5y,
    maintenance_annual: GAS_MAINTENANCE_PER_YEAR,
    insurance_5y,
    depreciation_5y,
    total_5y,
  };
}

export interface BreakevenResult {
  year: number | null;       // null = EV never breaks even within 10 years
  never: boolean;
  cumulative_savings_by_year: number[]; // index 0 = year 1
}

/**
 * Compute break-even year comparing EV vs gas car.
 * purchase_premium = ev_price - gas_price (can be negative if EV is cheaper).
 * annual_ev_cost = charging + maintenance per year.
 * annual_gas_cost = fuel + maintenance per year.
 */
export function computeBreakevenYear(
  purchase_premium: number,
  annual_ev_cost: number,
  annual_gas_cost: number
): BreakevenResult {
  const annual_saving = annual_gas_cost - annual_ev_cost;
  const cumulative: number[] = [];

  for (let year = 1; year <= 10; year++) {
    const cumulative_saving = annual_saving * year - purchase_premium;
    cumulative.push(Math.round(cumulative_saving));
    if (cumulative_saving >= 0 && year <= 10) {
      // Fill remaining years
      for (let y = year + 1; y <= 10; y++) {
        cumulative.push(Math.round(annual_saving * y - purchase_premium));
      }
      return { year, never: false, cumulative_savings_by_year: cumulative };
    }
  }

  return { year: null, never: true, cumulative_savings_by_year: cumulative };
}
