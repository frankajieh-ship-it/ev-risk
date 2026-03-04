/**
 * Charger API Client — NREL Alternative Fuels Data Center (AFDC)
 *
 * Free API: https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/
 * Use DEMO_KEY for development, get real key at https://developer.nrel.gov/signup/
 *
 * Lazy singleton pattern (matches existing lib/supabase.ts).
 */

import { logApi, startTimer } from "./api-logger";
import type { ChargerSearchResult } from "@/types/routine-v2";

// ============================================
// NREL TYPES
// ============================================

interface NRELStation {
  id: number;
  station_name: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  ev_connector_types: string[] | null;
  ev_dc_fast_num: number | null;
  ev_level2_evse_num: number | null;
  ev_network: string | null;
  access_code: string | null;
  distance: number | null;
  station_phone: string | null;
  access_days_time: string | null;
}

interface NRELResponse {
  fuel_stations: NRELStation[];
  total_results: number;
}

// ============================================
// CLIENT
// ============================================

let _client: ChargerClient | null = null;

class ChargerClient {
  private apiKey: string;
  private baseUrl = "https://developer.nrel.gov/api/alt-fuel-stations/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchByZip(
    zipCode: string,
    options?: {
      radius_miles?: number;
      connector_types?: string[];
    }
  ): Promise<
    | { success: true; data: ChargerSearchResult[] }
    | { success: false; error: string }
  > {
    const timer = startTimer();
    const radius = options?.radius_miles || 10;

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        fuel_type: "ELEC",
        location: zipCode,
        radius: radius.toString(),
        status: "E", // Available stations
        access: "public",
        limit: "20",
      });

      if (options?.connector_types?.length) {
        params.append("ev_connector_type", options.connector_types.join(","));
      }

      const res = await fetch(
        `${this.baseUrl}/nearest.json?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) {
        throw new Error(`NREL API ${res.status}`);
      }

      const data: NRELResponse = await res.json();
      const chargers = data.fuel_stations.map((s) => transformStation(s));

      logApi("info", "Charger search success", {
        endpoint: "charger-client",
        elapsed_ms: timer(),
        zip: zipCode,
        results: chargers.length,
      });

      return { success: true, data: chargers };
    } catch (error) {
      logApi("error", "Charger search failed", {
        endpoint: "charger-client",
        elapsed_ms: timer(),
        error_code: "CHARGER_API_ERROR",
        zip: zipCode,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async searchByLocation(
    lat: number,
    lng: number,
    options?: {
      radius_miles?: number;
      connector_types?: string[];
    }
  ): Promise<
    | { success: true; data: ChargerSearchResult[] }
    | { success: false; error: string }
  > {
    const timer = startTimer();
    const radius = options?.radius_miles || 10;

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        fuel_type: "ELEC",
        latitude: lat.toString(),
        longitude: lng.toString(),
        radius: radius.toString(),
        status: "E",
        access: "public",
        limit: "20",
      });

      if (options?.connector_types?.length) {
        params.append("ev_connector_type", options.connector_types.join(","));
      }

      const res = await fetch(
        `${this.baseUrl}/nearest.json?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) {
        throw new Error(`NREL API ${res.status}`);
      }

      const data: NRELResponse = await res.json();
      const chargers = data.fuel_stations.map((s) => transformStation(s));

      logApi("info", "Charger search by location success", {
        endpoint: "charger-client",
        elapsed_ms: timer(),
        lat,
        lng,
        results: chargers.length,
      });

      return { success: true, data: chargers };
    } catch (error) {
      logApi("error", "Charger search by location failed", {
        endpoint: "charger-client",
        elapsed_ms: timer(),
        error_code: "CHARGER_API_ERROR",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================
// TRANSFORM NREL → OUR FORMAT
// ============================================

function transformStation(station: NRELStation): ChargerSearchResult {
  const hasDCFC = (station.ev_dc_fast_num || 0) > 0;
  const hasL2 = (station.ev_level2_evse_num || 0) > 0;

  // Infer max power (reasonable estimates for scoring)
  let maxPowerKw: number | undefined;
  if (hasDCFC) {
    maxPowerKw = 150; // Typical DCFC
  } else if (hasL2) {
    maxPowerKw = 7.2; // Typical L2
  }

  // Normalize connector types
  const connectorTypes = (station.ev_connector_types || []).map(
    normalizeConnector
  );

  return {
    id: `nrel_${station.id}`,
    source: "nrel",
    external_id: station.id.toString(),
    name: station.station_name,
    lat: station.latitude,
    lng: station.longitude,
    address: [station.street_address, station.city, station.state, station.zip]
      .filter(Boolean)
      .join(", "),
    distance_mi: station.distance ?? undefined,
    connector_types: connectorTypes,
    max_power_kw: maxPowerKw,
    level_type: hasDCFC ? "DCFC" : hasL2 ? "L2" : "unknown",
    network: station.ev_network ?? undefined,
    access_type:
      station.access_code === "public" ? "public" : "semi-public",
    status: "unknown", // NREL doesn't provide real-time availability
    hours_24: station.access_days_time?.toLowerCase().includes("24 hour"),
    hours_description: station.access_days_time ?? undefined,
  };
}

function normalizeConnector(type: string): string {
  // NREL uses specific names, normalize for matching
  const map: Record<string, string> = {
    "J1772": "J1772",
    "J1772COMBO": "CCS",
    "CHADEMO": "CHAdeMO",
    "TESLA": "NACS",
    "NACS": "NACS",
  };
  return map[type] || type;
}

// ============================================
// SINGLETON ACCESS
// ============================================

export function getChargerClient(): ChargerClient | null {
  if (_client) return _client;

  const apiKey = process.env.NREL_API_KEY;
  if (!apiKey) return null;

  _client = new ChargerClient(apiKey);
  return _client;
}

export function isChargerApiConfigured(): boolean {
  return !!process.env.NREL_API_KEY;
}
