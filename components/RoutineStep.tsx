"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MapPin } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { inferClimateFromZip } from "@/lib/zip-climate-mapping";
import type { ClimateSeasonality } from "@/types";
import type { MinimumViableRoutine } from "@/types/v2";
import { validateMVR } from "@/types/v2";

/** Map ZIP-inferred ClimateSeasonality → routine climate value */
function mapZipClimateToRoutine(cs: ClimateSeasonality): MinimumViableRoutine["climate"] | null {
  switch (cs) {
    case "COLD_WINTER": return "winter";
    case "HOT_SUMMER": return "hot";
    case "MILD": return "mild";
    case "MIXED": return "mild"; // mixed seasons → mild (closest match)
    default: return null;
  }
}

function climateLabel(cs: ClimateSeasonality): string {
  switch (cs) {
    case "COLD_WINTER": return "Cold winters";
    case "HOT_SUMMER": return "Hot";
    case "MILD": return "Mild";
    case "MIXED": return "Mild (mixed seasons)";
    default: return "";
  }
}

interface RoutineStepProps {
  onComplete: (routine: MinimumViableRoutine) => void;
}

type MilesMode = "weekly" | "commute";

// Map validation errors to friendly messages
function getMissingFieldHint(errors: string[]): string | null {
  if (!errors.length) return null;
  const first = errors[0];
  if (first.includes("charging_access")) return "Select where you charge to continue";
  if (first.includes("weekly_miles") || first.includes("commute_miles"))
    return "Add weekly miles or commute distance to continue";
  if (first.includes("climate")) return "Select your climate to continue";
  if (first.includes("longest_day")) return "Select your long day pattern to continue";
  return "Complete all fields to continue";
}

export default function RoutineStep({ onComplete }: RoutineStepProps) {
  const { trackEvent } = useEventTracking();
  const [chargingAccess, setChargingAccess] = useState<MinimumViableRoutine["charging_access"] | null>(null);
  const [milesMode, setMilesMode] = useState<MilesMode>("weekly");
  const [weeklyMiles, setWeeklyMiles] = useState<string>("");
  const [commuteMiles, setCommuteMiles] = useState<string>("");
  const [climate, setClimate] = useState<MinimumViableRoutine["climate"] | null>(null);
  const [longestDay, setLongestDay] = useState<MinimumViableRoutine["longest_day_pattern"] | null>(null);

  // ZIP → climate autofill
  const [zipCode, setZipCode] = useState("");
  const [zipClimateNote, setZipClimateNote] = useState<string | null>(null);

  // Refs for scroll-to-field
  const chargingRef = useRef<HTMLFieldSetElement>(null);
  const milesRef = useRef<HTMLDivElement>(null);
  const climateRef = useRef<HTMLFieldSetElement>(null);
  const longestDayRef = useRef<HTMLFieldSetElement>(null);

  // Track step viewed on mount
  useEffect(() => {
    trackEvent("routine_step_viewed");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildRoutine = (): Partial<MinimumViableRoutine> => ({
    charging_access: chargingAccess || undefined,
    climate: climate || undefined,
    longest_day_pattern: longestDay || undefined,
    ...(milesMode === "weekly" && weeklyMiles ? { weekly_miles: Number(weeklyMiles) } : {}),
    ...(milesMode === "commute" && commuteMiles ? { commute_miles_roundtrip: Number(commuteMiles) } : {}),
  });

  const validation = validateMVR(buildRoutine());
  const isValid = validation.ok;

  // Confidence meter
  const hasMiles = milesMode === "weekly" ? !!weeklyMiles : !!commuteMiles;
  const confidencePct =
    40 +
    (chargingAccess ? 20 : 0) +
    (hasMiles ? 20 : 0) +
    (climate ? 10 : 0) +
    (longestDay ? 10 : 0);

  const getNextHint = (): string => {
    if (!chargingAccess) return "Add charging access to reach 60%";
    if (!hasMiles) return "Add miles to reach 80%";
    if (!climate) return "Add climate to reach 90%";
    if (!longestDay) return "Add long day pattern to reach 90%";
    return "Add vehicle details for full confidence";
  };

  // Track field completions
  const trackField = (field: string) => {
    trackEvent("routine_field_completed", { field });
  };

  const handleNext = () => {
    if (!isValid) {
      trackEvent("routine_step_blocked", { missing: validation.errors });
      // Scroll to first missing field
      const first = validation.errors[0];
      if (first?.includes("charging_access")) chargingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (first?.includes("weekly_miles") || first?.includes("commute_miles")) milesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (first?.includes("climate")) climateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (first?.includes("longest_day")) longestDayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    trackEvent("proceeded_to_vehicle");
    onComplete(buildRoutine() as MinimumViableRoutine);
  };

  // ZIP code → auto-fill climate
  const handleZipChange = (value: string) => {
    // Allow only digits, max 5
    const clean = value.replace(/\D/g, "").slice(0, 5);
    setZipCode(clean);
    setZipClimateNote(null);

    if (clean.length === 5) {
      const inferred = inferClimateFromZip(clean, "US");
      const mapped = mapZipClimateToRoutine(inferred);
      if (mapped) {
        setClimate(mapped);
        setZipClimateNote(`Climate set to "${climateLabel(inferred)}" based on ZIP ${clean}`);
        trackEvent("zip_climate_autofill", { zip: clean, climate: mapped, raw: inferred });
      }
    }
  };

  // Reusable card button component
  const SelectionCard = ({
    selected,
    onClick,
    label,
    desc,
    ariaLabel,
  }: {
    selected: boolean;
    onClick: () => void;
    label: string;
    desc: string;
    ariaLabel: string;
  }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={`relative p-4 rounded-xl border-2 text-left transition-all min-h-[56px] ${
        selected
          ? "border-blue-600 bg-blue-100 shadow-sm"
          : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-blue-600" />
        </span>
      )}
      <div className="font-semibold text-gray-900 text-sm">{label}</div>
      <div className={`text-xs mt-1 ${selected ? "text-blue-700" : "text-gray-600"}`}>{desc}</div>
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your routine</h2>
        <p className="text-gray-600">We&apos;ll assess how well an EV fits your daily life.</p>
      </div>

      {/* Confidence meter */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Routine confidence: {confidencePct}%</span>
          <span>{getNextHint()}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: "40%" }}
            animate={{ width: `${confidencePct}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="space-y-8">
        {/* Q1: Charging Access */}
        <fieldset ref={chargingRef}>
          <legend className="sr-only">Where will you charge most often?</legend>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Where will you charge most often?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "home" as const, label: "Home", desc: "Garage / driveway" },
              { value: "work" as const, label: "Work", desc: "Workplace charger" },
              { value: "public" as const, label: "Public", desc: "Public networks" },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={chargingAccess === opt.value}
                onClick={() => {
                  setChargingAccess(opt.value);
                  if (chargingAccess !== opt.value) trackField("charging_access");
                }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label.toLowerCase()} charging — ${opt.desc.toLowerCase()}`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Pick where you charge most weeks.</p>
        </fieldset>

        {/* Q2: Miles — segmented toggle */}
        <div ref={milesRef}>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            {milesMode === "weekly" ? "How far do you drive in a typical week?" : "What\u2019s your daily roundtrip commute?"}
          </label>
          <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
            <button
              onClick={() => {
                if (milesMode !== "weekly") {
                  setMilesMode("weekly");
                  trackEvent("toggle_weekly_vs_commute", { to: "weekly" });
                }
              }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                milesMode === "weekly"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Weekly miles
            </button>
            <button
              onClick={() => {
                if (milesMode !== "commute") {
                  setMilesMode("commute");
                  trackEvent("toggle_weekly_vs_commute", { to: "commute" });
                }
              }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                milesMode === "commute"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Daily commute
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              min="1"
              max={milesMode === "weekly" ? 2000 : 500}
              placeholder={milesMode === "weekly" ? "e.g. 200" : "e.g. 30 round trip"}
              value={milesMode === "weekly" ? weeklyMiles : commuteMiles}
              onChange={(e) => {
                if (milesMode === "weekly") {
                  setWeeklyMiles(e.target.value);
                  if (e.target.value && !weeklyMiles) trackField("weekly_miles");
                } else {
                  setCommuteMiles(e.target.value);
                  if (e.target.value && !commuteMiles) trackField("commute_miles");
                }
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              {milesMode === "weekly" ? "miles/week" : "miles/day"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {milesMode === "weekly" ? "Enter your typical weekly total." : "Enter your daily round-trip distance."}
          </p>
        </div>

        {/* Q3: Climate (with ZIP autofill) */}
        <fieldset ref={climateRef}>
          <legend className="sr-only">What&apos;s your climate like?</legend>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            What&apos;s your climate like?
          </label>

          {/* ZIP autofill */}
          <div className="mb-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter ZIP code to auto-detect"
                value={zipCode}
                onChange={(e) => handleZipChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 text-sm"
              />
            </div>
            <AnimatePresence>
              {zipClimateNote && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {zipClimateNote}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "winter" as const, label: "Cold winters", desc: "Regular snow & ice" },
              { value: "mild" as const, label: "Mild", desc: "Moderate year-round" },
              { value: "hot" as const, label: "Hot", desc: "Regular heat waves" },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={climate === opt.value}
                onClick={() => {
                  setClimate(opt.value);
                  setZipClimateNote(null);
                  if (climate !== opt.value) trackField("climate");
                }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label.toLowerCase()} climate — ${opt.desc.toLowerCase()}`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Affects range buffer, charging speed, and routine friction. {zipCode.length === 5 ? "You can override the auto-detected climate above." : ""}</p>
        </fieldset>

        {/* Q4: Longest Day Pattern */}
        <fieldset ref={longestDayRef}>
          <legend className="sr-only">How often do you have a longer-than-usual driving day?</legend>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            How often do you have a longer-than-usual driving day?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "once_a_week" as const, label: "Weekly", desc: "Once a week" },
              { value: "monthly_trip" as const, label: "Monthly", desc: "A few times a month" },
              { value: "rare_road_trip" as const, label: "Rarely", desc: "A few times a year" },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={longestDay === opt.value}
                onClick={() => {
                  setLongestDay(opt.value);
                  if (longestDay !== opt.value) trackField("longest_day_pattern");
                }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label.toLowerCase()} — ${opt.desc.toLowerCase()}`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">The day that breaks routines first.</p>
        </fieldset>

        {/* Actions */}
        <div className="pt-4 space-y-3">
          {/* Disabled CTA hint */}
          {!isValid && (
            <p className="text-sm text-gray-500 text-center">
              {getMissingFieldHint(validation.errors)}
            </p>
          )}

          <button
            onClick={handleNext}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all ${
              isValid
                ? "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Next: Choose Vehicle
          </button>
        </div>
      </div>
    </motion.div>
  );
}
