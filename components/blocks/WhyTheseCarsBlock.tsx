/**
 * WhyTheseCarsBlock - Input Recap Component
 *
 * Shows user inputs as chips to reinforce personalization.
 * Displays what we know about their routine, charging, climate, and location.
 */

import { Home, MapPin, Thermometer, Calendar, Zap } from "lucide-react";
import { MATCHMAKER_COPY } from "@/lib/copy/matchmaker";
import type { MinimumViableRoutine } from "@/types/v2";

interface WhyTheseCarsBlockProps {
  routine: MinimumViableRoutine;
  zipCode?: string | null;
}

interface ChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color?: "blue" | "green" | "amber" | "purple" | "gray";
}

function Chip({ icon: Icon, label, color = "blue" }: ChipProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${colorClasses[color]}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </div>
  );
}

export default function WhyTheseCarsBlock({ routine, zipCode }: WhyTheseCarsBlockProps) {
  // Format charging access
  const chargingLabel =
    routine.charging_access === "home"
      ? MATCHMAKER_COPY.chipLabels.chargingAccess.home
      : routine.charging_access === "work"
      ? MATCHMAKER_COPY.chipLabels.chargingAccess.work
      : MATCHMAKER_COPY.chipLabels.chargingAccess.public;

  // Format climate
  let climateLabel: string = MATCHMAKER_COPY.chipLabels.climate.mild;
  let climateColor: ChipProps["color"] = "gray";

  if (routine.climate === "winter") {
    climateLabel = MATCHMAKER_COPY.chipLabels.climate.cold;
    climateColor = "blue";
  } else if (routine.climate === "hot") {
    climateLabel = MATCHMAKER_COPY.chipLabels.climate.hot;
    climateColor = "amber";
  }

  // Format longest day
  const weeklyMiles = routine.weekly_miles ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 70);
  const longestDayMiles = routine.longest_day_miles ?? Math.ceil(weeklyMiles / 5 * 1.5);

  let longestDayLabel: string = MATCHMAKER_COPY.chipLabels.longestDay.medium;
  if (longestDayMiles < 50) {
    longestDayLabel = MATCHMAKER_COPY.chipLabels.longestDay.short;
  } else if (longestDayMiles > 100) {
    longestDayLabel = MATCHMAKER_COPY.chipLabels.longestDay.long;
  }

  // Weekly miles label
  const weeklyMilesLabel = `~${Math.round(weeklyMiles)} mi/week`;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {MATCHMAKER_COPY.whyTheseCars.title}
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {MATCHMAKER_COPY.whyTheseCars.subtitle}
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Charging Access */}
        <Chip
          icon={routine.charging_access === "home" ? Home : Zap}
          label={chargingLabel}
          color={routine.charging_access === "home" ? "green" : "blue"}
        />

        {/* Weekly Miles */}
        <Chip
          icon={Calendar}
          label={weeklyMilesLabel}
          color="purple"
        />

        {/* Longest Day */}
        <Chip
          icon={Calendar}
          label={longestDayLabel}
          color="amber"
        />

        {/* Climate */}
        <Chip
          icon={Thermometer}
          label={climateLabel}
          color={climateColor}
        />

        {/* ZIP Code (if provided) */}
        {zipCode && (
          <Chip
            icon={MapPin}
            label={`Location: ${zipCode}`}
            color="gray"
          />
        )}
      </div>
    </div>
  );
}
