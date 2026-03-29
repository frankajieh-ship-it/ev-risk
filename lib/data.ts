/**
 * EV-Risk™ Data Loaders
 *
 * Loads static data from data_v1.0/ (legacy) and data_v2/ (expanded)
 * All data is loaded server-side for API routes
 */

import fs from "fs";
import path from "path";
import { parse as csvParse } from "csv-parse/sync";

// ---------- Type Definitions ----------

export interface BatteryChemistry {
  name: string;
  manufacturers: string[];
  degradation_rate_per_year: number;
  description: string;
}

export interface BatteryDegradationData {
  chemistry_map: Record<string, BatteryChemistry>;
  thresholds: {
    green: { max_degradation_percent: number; description: string };
    yellow: { min_degradation_percent: number; max_degradation_percent: number; description: string };
    red: { min_degradation_percent: number; description: string };
  };
  replacement_cost_estimates: Record<string, {
    kwh_range: string;
    typical_cost: number;
    examples: string[];
  }>;
  warranty_reference: {
    standard_coverage: string;
    degradation_threshold: string;
    note: string;
  };
}

export interface RangeDeltaRow {
  model: string;
  year: number;
  epa_range_mi: number;
  real_world_range_mi: number;
  delta_percent: number;
  chemistry: string;
  battery_kwh: number;
  msrp_usd: number;
  dc_fast_kw: number;
  incentive_new: boolean;
}

export interface RecallRow {
  manufacturer: string;
  model: string;
  year_start: number;
  year_end: number;
  recall_id: string;
  issue_type: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  units_affected: number;
}

export interface OwnerIssue {
  category: string;
  frequency: "High" | "Medium" | "Low";
  issues: string[];
  severity: "Critical" | "High" | "Medium" | "Low";
  typical_age: string;
}

export interface OwnerIssueData {
  common_issues: OwnerIssue[];
  reliability_score: number;
}

export interface ClimateZoneRow {
  zip_prefix: string;
  state: string;
  city: string;
  zone: "Extreme Hot" | "Hot" | "Hot Humid" | "Moderate" | "Mild" | "Cold" | "Extreme Cold";
  avg_temp_f: number;
  extreme_heat_days: number;
  extreme_cold_days: number;
  description: string;
}

export interface ChargerDensityRow {
  zip_prefix: string;
  state: string;
  region: string;
  dcfc_per_100k_pop: number;
  l2_per_100k_pop: number;
  density_score: "Excellent" | "Good" | "Moderate" | "Poor";
  description: string;
}

// ---------- v2 Type Definitions ----------

export interface VehicleMasterRow {
  make: string;
  model: string;
  year: number;
  trim: string;
  vin_pattern: string | null;
  battery_kwh: number | null;
  chemistry: "NCA" | "NMC" | "NMC811" | "LFP" | "unknown";
  dc_fast_kw: number | null;
  onboard_ac_kw: number | null;
  epa_range_mi: number | null;
  real_world_range_mi: number | null;
  delta_percent: number | null;
  msrp_usd: number | null;
  incentive_federal: number;
  incentive_eligible: boolean;
  incentive_expiry: string | null;
  data_source: "epa_api" | "manual";
  last_updated: string;
}

export interface RecallLiveRow {
  NHTSACampaignNumber: string;
  Manufacturer: string;
  Make: string;
  Model: string;
  ModelYear: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  ReportReceivedDate: string;
}

export interface ChargerDensityV2Row {
  zip5: string;
  state: string;
  dcfc_count: number;
  l2_count: number;
  dcfc_per_100k: number;
  l2_per_100k: number;
  density_score: "Excellent" | "Good" | "Moderate" | "Poor";
}

export interface Incentive {
  make: string;
  model: string;
  year_start: number;
  year_end: number | null;
  trim_filter: string | null;
  incentive_type: "federal_new" | "federal_used" | "state_new" | "state_used";
  state: string | null;
  amount_usd: number;
  msrp_cap: number | null;
  income_cap: number | null;
  eligible_from: string;
  eligible_to: string | null;
  source_url: string;
  last_verified: string;
}

export interface ElectricityRate {
  state: string;
  residential_kwh_cents: number;
  ev_tou_kwh_cents: number | null;
  year: number;
  source: string;
  last_updated: string;
}

export interface ChargingProfile {
  make: string;
  model: string;
  year_start: number;
  year_end: number | null;
  peak_dc_kw: number;
  real_peak_dc_kw: number | null;
  time_10_to_80_min: number | null;
  time_20_to_80_min: number | null;
  curve_shape: "flat" | "tapered" | "steep_taper";
  cold_derate_percent: number;
  data_source: string;
  last_updated: string;
}

// ---------- Data Paths ----------

const DATA_DIR = path.join(process.cwd(), "data_v1.0");
const DATA_DIR_V2 = path.join(process.cwd(), "data_v2");

const PATHS = {
  batteryDegradation: path.join(DATA_DIR, "battery_degradation.json"),
  rangeDelta: path.join(DATA_DIR, "range_delta.csv"),
  recalls: path.join(DATA_DIR, "recalls.csv"),
  ownerIssues: path.join(DATA_DIR, "owner_issue_clusters.json"),
  climateZones: path.join(DATA_DIR, "climate_zones.csv"),
  chargerDensity: path.join(DATA_DIR, "charger_density.csv"),
  // v2 paths
  vehicleMaster: path.join(DATA_DIR_V2, "vehicle_master.json"),
  recallsLive: path.join(DATA_DIR_V2, "recalls_live.json"),
  chargerDensityV2: path.join(DATA_DIR_V2, "charger_density_v2.json"),
  incentives: path.join(DATA_DIR_V2, "incentives.json"),
  electricityRates: path.join(DATA_DIR_V2, "electricity_rates.json"),
  chargingProfiles: path.join(DATA_DIR_V2, "charging_profiles.json"),
  rangeStack: path.join(DATA_DIR_V2, "range_stack.json"),
};

// ---------- Data Loaders ----------

/**
 * Load battery degradation data (JSON)
 */
export function loadBatteryDegradationData(): BatteryDegradationData {
  const raw = fs.readFileSync(PATHS.batteryDegradation, "utf-8");
  return JSON.parse(raw);
}

/**
 * Load range delta data (CSV)
 */
export function loadRangeDeltaData(): RangeDeltaRow[] {
  const raw = fs.readFileSync(PATHS.rangeDelta, "utf-8");
  const records = csvParse(raw, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      // Cast numeric columns
      if (context.column === "year" || context.column === "epa_range_mi" ||
          context.column === "real_world_range_mi" || context.column === "battery_kwh" ||
          context.column === "msrp_usd" || context.column === "dc_fast_kw") {
        return parseInt(value) || 0;
      }
      if (context.column === "delta_percent") {
        return parseFloat(value);
      }
      if (context.column === "incentive_new") {
        return value === "Y";
      }
      return value;
    }
  });
  return records as RangeDeltaRow[];
}

/**
 * Load recalls data (CSV)
 */
export function loadRecallsData(): RecallRow[] {
  const raw = fs.readFileSync(PATHS.recalls, "utf-8");
  const records = csvParse(raw, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      // Cast numeric columns
      if (context.column === "year_start" || context.column === "year_end" ||
          context.column === "units_affected") {
        return parseInt(value);
      }
      return value;
    }
  });
  return records as RecallRow[];
}

/**
 * Load owner issue clusters (JSON)
 */
export function loadOwnerIssuesData(): Record<string, OwnerIssueData> {
  const raw = fs.readFileSync(PATHS.ownerIssues, "utf-8");
  return JSON.parse(raw);
}

/**
 * Load climate zones (CSV)
 */
export function loadClimateZonesData(): ClimateZoneRow[] {
  const raw = fs.readFileSync(PATHS.climateZones, "utf-8");
  const records = csvParse(raw, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      // Cast numeric columns
      if (context.column === "avg_temp_f" || context.column === "extreme_heat_days" ||
          context.column === "extreme_cold_days") {
        return parseInt(value);
      }
      return value;
    }
  });
  return records as ClimateZoneRow[];
}

/**
 * Load charger density (CSV)
 */
export function loadChargerDensityData(): ChargerDensityRow[] {
  const raw = fs.readFileSync(PATHS.chargerDensity, "utf-8");
  const records = csvParse(raw, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      // Cast numeric columns
      if (context.column === "dcfc_per_100k_pop" || context.column === "l2_per_100k_pop") {
        return parseInt(value);
      }
      return value;
    }
  });
  return records as ChargerDensityRow[];
}

// ---------- Lookup Helpers ----------

/**
 * Find vehicle range data by model name
 */
export function findRangeDataByModel(model: string, year?: number): RangeDeltaRow | null {
  const rangeData = loadRangeDeltaData();

  // Normalize model name for comparison
  const normalizedModel = model.toLowerCase().trim();

  // First try exact match with year
  if (year) {
    const exactMatch = rangeData.find(
      row => row.model.toLowerCase().includes(normalizedModel) && row.year === year
    );
    if (exactMatch) return exactMatch;
  }

  // Fall back to model name match (use most recent year)
  const modelMatches = rangeData.filter(
    row => row.model.toLowerCase().includes(normalizedModel)
  );

  if (modelMatches.length > 0) {
    // Return most recent year
    return modelMatches.sort((a, b) => b.year - a.year)[0];
  }

  return null;
}

/**
 * Find recalls for specific model and year range
 */
export function findRecallsForVehicle(model: string, year: number): RecallRow[] {
  const recalls = loadRecallsData();

  const normalizedModel = model.toLowerCase().trim();

  return recalls.filter(recall => {
    const recallModel = recall.model.toLowerCase();
    const modelMatch = recallModel.includes(normalizedModel) || normalizedModel.includes(recallModel);
    const yearMatch = year >= recall.year_start && year <= recall.year_end;
    return modelMatch && yearMatch;
  });
}

/**
 * Find owner issues for model
 */
export function findOwnerIssuesForModel(model: string): OwnerIssueData | null {
  const ownerIssues = loadOwnerIssuesData();

  // Try exact key match first
  if (ownerIssues[model]) {
    return ownerIssues[model];
  }

  // Try fuzzy match
  const normalizedModel = model.toLowerCase().trim();
  const matchingKey = Object.keys(ownerIssues).find(
    key => key.toLowerCase().includes(normalizedModel)
  );

  return matchingKey ? ownerIssues[matchingKey] : null;
}

/**
 * Get climate zone by ZIP code
 */
export function getClimateZoneByZip(zipCode: string): ClimateZoneRow | null {
  const climateZones = loadClimateZonesData();
  // Pad to 5 digits before slicing to preserve leading zeros (e.g. "02134" → prefix "021")
  const zipPrefix = String(zipCode).padStart(5, "0").substring(0, 3);

  return climateZones.find(zone => zone.zip_prefix === zipPrefix) || null;
}

/**
 * Get charger density by ZIP code
 * Falls back to data_v2/charger_density_v2.json if available (ZIP-5 keyed, nationwide)
 */
export function getChargerDensityByZip(zipCode: string): ChargerDensityRow | ChargerDensityV2Row | null {
  // Pad to 5 digits before slicing to preserve leading zeros
  const zip5 = String(zipCode).padStart(5, "0");
  const zipPrefix = zip5.substring(0, 3);

  // Prefer v2 (full nationwide coverage, ZIP-5 keyed)
  if (fs.existsSync(PATHS.chargerDensityV2)) {
    const v2 = loadChargerDensityV2Data();
    const match = v2.find(row => row.zip5 === zip5 || row.zip5.substring(0, 3) === zipPrefix);
    if (match) return match;
  }

  // Fallback to v1 sparse data
  const chargerDensity = loadChargerDensityData();
  return chargerDensity.find(density => density.zip_prefix === zipPrefix) || null;
}

// ---------- v2 Data Loaders ----------

/** Load full BEV vehicle catalog from data_v2 (all makes/models 2017+) */
export function loadVehicleMasterData(): VehicleMasterRow[] {
  if (!fs.existsSync(PATHS.vehicleMaster)) return [];
  const raw = fs.readFileSync(PATHS.vehicleMaster, "utf-8");
  return JSON.parse(raw) as VehicleMasterRow[];
}

/** Load live NHTSA recall cache from data_v2 */
export function loadRecallsLiveData(): RecallLiveRow[] {
  if (!fs.existsSync(PATHS.recallsLive)) return [];
  const raw = fs.readFileSync(PATHS.recallsLive, "utf-8");
  return JSON.parse(raw) as RecallLiveRow[];
}

/** Load nationwide charger density (ZIP-5 keyed) from data_v2 */
export function loadChargerDensityV2Data(): ChargerDensityV2Row[] {
  if (!fs.existsSync(PATHS.chargerDensityV2)) return [];
  const raw = fs.readFileSync(PATHS.chargerDensityV2, "utf-8");
  return JSON.parse(raw) as ChargerDensityV2Row[];
}

/** Load federal + state EV incentives from data_v2 */
export function loadIncentivesData(): Incentive[] {
  if (!fs.existsSync(PATHS.incentives)) return [];
  const raw = fs.readFileSync(PATHS.incentives, "utf-8");
  return JSON.parse(raw) as Incentive[];
}

/** Load state electricity rates from data_v2 */
export function loadElectricityRatesData(): ElectricityRate[] {
  if (!fs.existsSync(PATHS.electricityRates)) return [];
  const raw = fs.readFileSync(PATHS.electricityRates, "utf-8");
  return JSON.parse(raw) as ElectricityRate[];
}

/** Load charging performance profiles from data_v2 */
export function loadChargingProfilesData(): ChargingProfile[] {
  if (!fs.existsSync(PATHS.chargingProfiles)) return [];
  const raw = fs.readFileSync(PATHS.chargingProfiles, "utf-8");
  return JSON.parse(raw) as ChargingProfile[];
}

// ---------- v2 Lookup Helpers ----------

/**
 * Find vehicle in master catalog by make/model/year.
 * Falls back to data_v1 range data if catalog not yet populated.
 */
export function findVehicleInMaster(make: string, model: string, year?: number): VehicleMasterRow | null {
  const catalog = loadVehicleMasterData();
  if (catalog.length === 0) return null;

  const normMake = make.toLowerCase().trim();
  const normModel = model.toLowerCase().trim();

  if (year) {
    const exact = catalog.find(
      r => r.make.toLowerCase().includes(normMake) &&
           r.model.toLowerCase().includes(normModel) &&
           r.year === year
    );
    if (exact) return exact;
  }

  const matches = catalog.filter(
    r => r.make.toLowerCase().includes(normMake) &&
         r.model.toLowerCase().includes(normModel)
  );
  return matches.length > 0 ? matches.sort((a, b) => b.year - a.year)[0] : null;
}

/**
 * Find live NHTSA recalls for a vehicle.
 * Uses data_v2/recalls_live.json if available, falls back to v1 CSV.
 */
export function findRecallsLiveForVehicle(make: string, model: string, year: number): RecallLiveRow[] {
  const liveRecalls = loadRecallsLiveData();
  if (liveRecalls.length === 0) return [];

  const normModel = model.toLowerCase().trim();
  const normMake = make.toLowerCase().trim();

  return liveRecalls.filter(r => {
    const makeMatch = r.Make.toLowerCase().includes(normMake) || normMake.includes(r.Make.toLowerCase());
    const modelMatch = r.Model.toLowerCase().includes(normModel) || normModel.includes(r.Model.toLowerCase());
    const yearMatch = r.ModelYear === String(year);
    return makeMatch && modelMatch && yearMatch;
  });
}

/**
 * Get applicable federal and/or state incentives for a vehicle.
 * Pass state (2-letter) to include state-level incentives.
 */
export function getIncentivesForVehicle(
  make: string,
  model: string,
  year: number,
  state?: string
): Incentive[] {
  const incentives = loadIncentivesData();
  if (incentives.length === 0) return [];

  const normMake = make.toLowerCase().trim();
  const normModel = model.toLowerCase().trim();
  const today = new Date().toISOString().substring(0, 10);

  return incentives.filter(inc => {
    const makeMatch = inc.make.toLowerCase() === normMake || inc.make === "*";
    const modelMatch = inc.model.toLowerCase().includes(normModel) || inc.model === "*";
    const yearMatch = year >= inc.year_start && (inc.year_end === null || year <= inc.year_end);
    const notExpired = inc.eligible_to === null || inc.eligible_to >= today;
    const stateMatch =
      inc.state === null || // federal
      (state && inc.state.toUpperCase() === state.toUpperCase());
    return makeMatch && modelMatch && yearMatch && notExpired && stateMatch;
  });
}

/** Get residential electricity rate for a US state (2-letter code) */
export function getElectricityRate(state: string): ElectricityRate | null {
  const rates = loadElectricityRatesData();
  return rates.find(r => r.state.toUpperCase() === state.toUpperCase()) || null;
}

/** Get charging profile for a vehicle (year-range match) */
export function getChargingProfile(make: string, model: string, year: number): ChargingProfile | null {
  const profiles = loadChargingProfilesData();
  if (profiles.length === 0) return null;

  const normMake = make.toLowerCase().trim();
  const normModel = model.toLowerCase().trim();

  return profiles.find(p =>
    p.make.toLowerCase().includes(normMake) &&
    p.model.toLowerCase().includes(normModel) &&
    year >= p.year_start &&
    (p.year_end === null || year <= p.year_end)
  ) || null;
}

/** Get range stack profile for a vehicle (fuzzy make/model match, closest year) */
export function loadRangeStackForVehicle(make: string, model: string, year: number): RangeStack | null {
  const profiles = loadRangeStackData();
  if (profiles.length === 0) return null;

  const normMake = make.toLowerCase().trim();
  const normModel = model.toLowerCase().trim();

  // Exact year match first
  const exact = profiles.find(
    p => p.make.toLowerCase().includes(normMake) &&
         p.model.toLowerCase().includes(normModel) &&
         p.year === year
  );
  if (exact) return exact;

  // Nearest year fallback
  const matches = profiles.filter(
    p => p.make.toLowerCase().includes(normMake) &&
         p.model.toLowerCase().includes(normModel)
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
}

/** Load range stack data from data_v2/range_stack.json */
export interface RangeStack {
  make: string;
  model: string;
  year: number;
  range_at_neg20f: number | null;
  range_at_0f: number | null;
  range_at_32f: number | null;
  range_at_70f: number;
  range_at_100f: number | null;
  hvac_load_kw: number | null;
  data_source: string;
  notes: string | null;
  last_updated: string;
}

export function loadRangeStackData(): RangeStack[] {
  if (!fs.existsSync(PATHS.rangeStack)) return [];
  return JSON.parse(fs.readFileSync(PATHS.rangeStack, "utf-8")) as RangeStack[];
}

/**
 * Determine battery chemistry from model name
 * (Simplified heuristic - would be better with VIN decode in v2.0)
 */
export function inferBatteryChemistry(model: string, year: number): string {
  const normalizedModel = model.toLowerCase();

  // Tesla-specific logic
  if (normalizedModel.includes("tesla")) {
    if (normalizedModel.includes("model 3") && normalizedModel.includes("standard")) {
      return year >= 2021 ? "LFP" : "NCA";
    }
    if (normalizedModel.includes("model 3") || normalizedModel.includes("model y")) {
      return "NMC811";
    }
    if (normalizedModel.includes("model s") || normalizedModel.includes("model x")) {
      return year >= 2021 ? "NMC811" : "NCA";
    }
  }

  // BYD, Rivian Standard Range use LFP
  if (normalizedModel.includes("byd") ||
      (normalizedModel.includes("rivian") && normalizedModel.includes("standard"))) {
    return "LFP";
  }

  // Lucid, Rivian Max Pack use NMC811
  if (normalizedModel.includes("lucid") ||
      (normalizedModel.includes("rivian") && normalizedModel.includes("max"))) {
    return "NMC811";
  }

  // Default to NMC for most manufacturers
  return "NMC";
}
