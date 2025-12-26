/**
 * EV-Risk™ Data Loaders
 *
 * Loads static data from data_v1.0/ directory
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

// ---------- Data Paths ----------

const DATA_DIR = path.join(process.cwd(), "data_v1.0");

const PATHS = {
  batteryDegradation: path.join(DATA_DIR, "battery_degradation.json"),
  rangeDelta: path.join(DATA_DIR, "range_delta.csv"),
  recalls: path.join(DATA_DIR, "recalls.csv"),
  ownerIssues: path.join(DATA_DIR, "owner_issue_clusters.json"),
  climateZones: path.join(DATA_DIR, "climate_zones.csv"),
  chargerDensity: path.join(DATA_DIR, "charger_density.csv"),
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
          context.column === "real_world_range_mi" || context.column === "battery_kwh") {
        return parseInt(value);
      }
      if (context.column === "delta_percent") {
        return parseFloat(value);
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
  const zipPrefix = zipCode.substring(0, 3);

  return climateZones.find(zone => zone.zip_prefix === zipPrefix) || null;
}

/**
 * Get charger density by ZIP code
 */
export function getChargerDensityByZip(zipCode: string): ChargerDensityRow | null {
  const chargerDensity = loadChargerDensityData();
  const zipPrefix = zipCode.substring(0, 3);

  return chargerDensity.find(density => density.zip_prefix === zipPrefix) || null;
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
