/**
 * Data Sources Badge
 *
 * Displays transparency badge showing what live data was factored into scoring.
 * Shows weather, charger availability, and whether data is live or estimated.
 */

import { Check } from "lucide-react";
import type { DataSources } from "@/types/recommendations";

interface DataSourcesBadgeProps {
  dataSources: DataSources;
  chargingAccess?: "home" | "work" | "public";
}

export function DataSourcesBadge({ dataSources, chargingAccess }: DataSourcesBadgeProps) {
  const {
    weather_live,
    chargers_live,
    weather_temp_f,
    weather_condition,
    charger_count,
    location_name,
  } = dataSources;

  return (
    <div className="mb-4 p-3 bg-[#00d97e]/[0.08] rounded-lg border border-[#00d97e]/20">
      <div className="flex items-center gap-2 mb-1">
        <Check className="w-4 h-4 text-[#00d97e] flex-shrink-0" />
        <p className="text-sm font-semibold text-[#00d97e]">
          Live data factored into your score
        </p>
      </div>
      <ul className="text-xs text-[#00d97e]/70 space-y-0.5 ml-6">
        {/* Weather data */}
        {weather_live && weather_temp_f && location_name ? (
          <li>
            • Weather: {weather_temp_f}°F{weather_condition ? ` (${weather_condition})` : ""} in {location_name} (via OpenWeatherMap)
          </li>
        ) : (
          <li>• Weather: Estimated based on your climate selection</li>
        )}

        {/* Charger data (only shown if public charging) */}
        {chargingAccess === "public" && (
          <>
            {chargers_live && charger_count > 0 ? (
              <li>• Chargers: {charger_count} nearby stations found (via NREL)</li>
            ) : chargers_live && charger_count === 0 ? (
              <li>• Chargers: No nearby stations found — consider mapping backup chargers</li>
            ) : (
              <li>• Chargers: Add a ZIP code for live charger data</li>
            )}
          </>
        )}
      </ul>
    </div>
  );
}
