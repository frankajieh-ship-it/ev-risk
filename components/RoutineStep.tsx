"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { MinimumViableRoutine } from "@/types/v2";
import { validateMVR } from "@/types/v2";

interface RoutineStepProps {
  onComplete: (routine: MinimumViableRoutine) => void;
  onSkipVehicle: (routine: MinimumViableRoutine) => void;
}

type MilesMode = "weekly" | "commute";

export default function RoutineStep({ onComplete, onSkipVehicle }: RoutineStepProps) {
  const [chargingAccess, setChargingAccess] = useState<MinimumViableRoutine["charging_access"] | null>(null);
  const [milesMode, setMilesMode] = useState<MilesMode>("weekly");
  const [weeklyMiles, setWeeklyMiles] = useState<string>("");
  const [commuteMiles, setCommuteMiles] = useState<string>("");
  const [climate, setClimate] = useState<MinimumViableRoutine["climate"] | null>(null);
  const [longestDay, setLongestDay] = useState<MinimumViableRoutine["longest_day_pattern"] | null>(null);

  const buildRoutine = (): Partial<MinimumViableRoutine> => ({
    charging_access: chargingAccess || undefined,
    climate: climate || undefined,
    longest_day_pattern: longestDay || undefined,
    ...(milesMode === "weekly" && weeklyMiles ? { weekly_miles: Number(weeklyMiles) } : {}),
    ...(milesMode === "commute" && commuteMiles ? { commute_miles_roundtrip: Number(commuteMiles) } : {}),
  });

  const validation = validateMVR(buildRoutine());
  const isValid = validation.ok;

  const handleNext = () => {
    if (!isValid) return;
    onComplete(buildRoutine() as MinimumViableRoutine);
  };

  const handleSkip = () => {
    if (!isValid) return;
    onSkipVehicle(buildRoutine() as MinimumViableRoutine);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your routine</h2>
        <p className="text-gray-600">We'll assess how well an EV fits your daily life.</p>
      </div>

      <div className="space-y-8">
        {/* Q1: Charging Access */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Where will you charge most often?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "home" as const, label: "Home", desc: "Garage / driveway" },
              { value: "work" as const, label: "Work", desc: "Workplace charger" },
              { value: "public" as const, label: "Public", desc: "Public networks" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setChargingAccess(opt.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  chargingAccess === opt.value
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Q2: Miles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700">
              {milesMode === "weekly" ? "How far do you drive in a typical week?" : "What's your daily roundtrip commute?"}
            </label>
            <button
              onClick={() => setMilesMode(milesMode === "weekly" ? "commute" : "weekly")}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              {milesMode === "weekly" ? "Use daily commute instead" : "Use weekly miles instead"}
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              min="1"
              max={milesMode === "weekly" ? 2000 : 500}
              placeholder={milesMode === "weekly" ? "e.g. 200" : "e.g. 40"}
              value={milesMode === "weekly" ? weeklyMiles : commuteMiles}
              onChange={(e) => {
                if (milesMode === "weekly") setWeeklyMiles(e.target.value);
                else setCommuteMiles(e.target.value);
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {milesMode === "weekly" ? "miles/week" : "miles/day"}
            </span>
          </div>
        </div>

        {/* Q3: Climate */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            What's your climate like?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "winter" as const, label: "Cold winters", desc: "Regular snow & ice" },
              { value: "mild" as const, label: "Mild", desc: "Moderate year-round" },
              { value: "hot" as const, label: "Hot", desc: "Regular heat waves" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setClimate(opt.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  climate === opt.value
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Q4: Longest Day Pattern */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            How often do you have a longer-than-usual driving day?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "once_a_week" as const, label: "Weekly", desc: "Once a week" },
              { value: "monthly_trip" as const, label: "Monthly", desc: "A few times a month" },
              { value: "rare_road_trip" as const, label: "Rarely", desc: "Occasional road trips" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLongestDay(opt.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  longestDay === opt.value
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 space-y-3">
          <button
            onClick={handleNext}
            disabled={!isValid}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all ${
              isValid
                ? "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Next: Choose Vehicle
          </button>
          <button
            onClick={handleSkip}
            disabled={!isValid}
            className={`w-full py-2 text-sm transition-colors ${
              isValid
                ? "text-gray-500 hover:text-blue-600 underline"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            Skip vehicle — see routine fit only
          </button>
        </div>
      </div>
    </motion.div>
  );
}
