"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MapPin } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { inferClimateFromZip } from "@/lib/zip-climate-mapping";
import type { ClimateSeasonality } from "@/types";
import type { MinimumViableRoutine } from "@/types/v2";
import { validateMVR } from "@/types/v2";

function mapZipClimateToRoutine(cs: ClimateSeasonality): MinimumViableRoutine["climate"] | null {
  switch (cs) {
    case "COLD_WINTER": return "winter";
    case "HOT_SUMMER": return "hot";
    case "MILD": return "mild";
    case "MIXED": return "mild";
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
  dark?: boolean;
}

type MilesMode = "weekly" | "commute";

export default function RoutineStep({ onComplete, dark = false }: RoutineStepProps) {
  const { trackEvent } = useEventTracking();

  const [chargingAccess, setChargingAccess] = useState<MinimumViableRoutine["charging_access"] | null>(null);
  const [milesMode, setMilesMode] = useState<MilesMode>("weekly");
  const [weeklyMiles, setWeeklyMiles] = useState<string>("");
  const [commuteMiles, setCommuteMiles] = useState<string>("");
  const [climate, setClimate] = useState<MinimumViableRoutine["climate"] | null>(null);
  const [longestDay, setLongestDay] = useState<MinimumViableRoutine["longest_day_pattern"] | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [zipClimateNote, setZipClimateNote] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("routine_step_viewed");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZipChange = (value: string) => {
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

  const trackField = (field: string) => {
    trackEvent("routine_field_completed", { field_id: field });
  };

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
        dark
          ? selected
            ? "border-[#00d97e] bg-[#00d97e]/10 shadow-sm"
            : "border-white/10 hover:border-white/25 bg-white/[0.05]"
          : selected
            ? "border-blue-600 bg-blue-100 shadow-sm"
            : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2">
          <Check className={`w-4 h-4 ${dark ? "text-[#00d97e]" : "text-blue-600"}`} />
        </span>
      )}
      <div className={`font-semibold text-sm ${dark ? "text-white" : "text-gray-900"}`}>{label}</div>
      <div className={`text-xs mt-1 ${
        dark
          ? selected ? "text-[#00d97e]/80" : "text-white/50"
          : selected ? "text-blue-700" : "text-gray-600"
      }`}>{desc}</div>
    </button>
  );

  const handleSubmit = () => {
    if (!chargingAccess) {
      setFormError("Select where you charge most often to continue");
      return;
    }
    const hasMiles = milesMode === "weekly" ? !!weeklyMiles : !!commuteMiles;
    if (!hasMiles) {
      setFormError("Add your weekly miles or commute distance to continue");
      return;
    }
    if (!longestDay) {
      setFormError("Select how often you have a longer driving day to continue");
      return;
    }

    const routine: Partial<MinimumViableRoutine> = {
      charging_access: chargingAccess,
      climate: climate ?? "mild",
      longest_day_pattern: longestDay,
      ...(milesMode === "weekly" && weeklyMiles ? { weekly_miles: Number(weeklyMiles) } : {}),
      ...(milesMode === "commute" && commuteMiles ? { commute_miles_roundtrip: Number(commuteMiles) } : {}),
    };

    const final = validateMVR(routine);
    if (!final.ok) {
      setFormError("Complete all required fields to continue");
      return;
    }

    trackEvent("proceeded_to_vehicle", { pages_completed: 1 });
    onComplete(routine as MinimumViableRoutine);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto"
    >
      <div className="space-y-8">

        {/* Q1 — Charging access */}
        <fieldset>
          <legend className="sr-only">Where will you charge most often?</legend>
          <label className={`block text-sm font-semibold mb-3 ${dark ? "text-white/80" : "text-gray-700"}`}>
            Where will you charge most often? <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "home" as const,   label: "Home",   desc: "Garage / driveway" },
              { value: "work" as const,   label: "Work",   desc: "Workplace charger" },
              { value: "public" as const, label: "Public", desc: "Public networks"   },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={chargingAccess === opt.value}
                onClick={() => { setChargingAccess(opt.value); setFormError(null); if (chargingAccess !== opt.value) trackField("charging_access"); }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label.toLowerCase()} charging — ${opt.desc.toLowerCase()}`}
              />
            ))}
          </div>
          <p className={`text-xs mt-2 ${dark ? "text-white/40" : "text-gray-500"}`}>Pick where you charge most weeks.</p>
        </fieldset>

        {/* Q2 — Miles */}
        <div>
          <label className={`block text-sm font-semibold mb-3 ${dark ? "text-white/80" : "text-gray-700"}`}>
            {milesMode === "weekly"
              ? "How far do you drive in a typical week?"
              : "What’s your daily roundtrip commute?"}{" "}
            <span className="text-red-400">*</span>
          </label>
          <div className={`flex rounded-lg p-1 mb-3 ${dark ? "bg-white/[0.07]" : "bg-gray-100"}`}>
            {(["weekly", "commute"] as MilesMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { if (milesMode !== mode) { setMilesMode(mode); trackEvent("toggle_weekly_vs_commute", { to: mode }); } }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  milesMode === mode
                    ? dark ? "bg-white/10 shadow-sm text-white" : "bg-white shadow-sm text-gray-900"
                    : dark ? "text-white/50 hover:text-white/70" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode === "weekly" ? "Weekly miles" : "Daily commute"}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="number"
              min="1"
              max={milesMode === "weekly" ? 2000 : 500}
              placeholder={milesMode === "weekly" ? "e.g. 200" : "e.g. 30 round trip"}
              value={milesMode === "weekly" ? weeklyMiles : commuteMiles}
              onChange={(e) => {
                setFormError(null);
                if (milesMode === "weekly") {
                  setWeeklyMiles(e.target.value);
                  if (e.target.value && !weeklyMiles) trackField("weekly_miles");
                } else {
                  setCommuteMiles(e.target.value);
                  if (e.target.value && !commuteMiles) trackField("commute_miles");
                }
              }}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none ${
                dark
                  ? "bg-white/[0.06] border-white/10 text-white placeholder-white/30 focus:border-[#00d97e]/60"
                  : "border-gray-200 focus:border-blue-500 text-gray-900"
              }`}
            />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm ${dark ? "text-white/40" : "text-gray-500"}`}>
              {milesMode === "weekly" ? "miles/week" : "miles/day"}
            </span>
          </div>
          <p className={`text-xs mt-2 ${dark ? "text-white/40" : "text-gray-500"}`}>
            {milesMode === "weekly" ? "Enter your typical weekly total." : "Enter your daily round-trip distance."}
          </p>
        </div>

        {/* Q3 — Longest day pattern */}
        <fieldset>
          <legend className="sr-only">How often do you have a longer-than-usual driving day?</legend>
          <label className={`block text-sm font-semibold mb-3 ${dark ? "text-white/80" : "text-gray-700"}`}>
            How often do you have a longer-than-usual driving day? <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "once_a_week" as const,    label: "Weekly",  desc: "Once a week"         },
              { value: "monthly_trip" as const,   label: "Monthly", desc: "A few times a month" },
              { value: "rare_road_trip" as const, label: "Rarely",  desc: "A few times a year"  },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={longestDay === opt.value}
                onClick={() => { setLongestDay(opt.value); setFormError(null); if (longestDay !== opt.value) trackField("longest_day_pattern"); }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label.toLowerCase()} — ${opt.desc.toLowerCase()}`}
              />
            ))}
          </div>
          <p className={`text-xs mt-2 ${dark ? "text-white/40" : "text-gray-500"}`}>The day that breaks routines first.</p>
        </fieldset>

        {/* ZIP → climate (optional) */}
        <div>
          <label className={`block text-xs font-medium mb-2 ${dark ? "text-white/50" : "text-gray-500"}`}>
            Your ZIP <span className={dark ? "text-white/30" : "text-gray-400"}>(optional — auto-sets climate)</span>
          </label>
          <div className="relative">
            <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? "text-white/40" : "text-gray-400"}`} />
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 60601"
              value={zipCode}
              onChange={(e) => handleZipChange(e.target.value)}
              className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl focus:outline-none text-sm ${
                dark
                  ? "bg-white/[0.06] border-white/10 text-white placeholder-white/30 focus:border-[#00d97e]/60"
                  : "border-gray-200 focus:border-blue-500 text-gray-900"
              }`}
            />
          </div>
          <AnimatePresence>
            {zipClimateNote && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`mt-2 text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 ${
                  dark
                    ? "text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/20"
                    : "text-green-700 bg-green-50 border border-green-200"
                }`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                {zipClimateNote}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Error */}
      <AnimatePresence>
        {formError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-sm text-red-500 text-center"
          >
            {formError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className={`mt-8 w-full flex items-center justify-center gap-1.5 py-3 px-6 rounded-xl font-semibold shadow-md transition-all ${
          dark
            ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090]"
            : "text-white bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
        }`}
      >
        See recommendations →
      </button>
    </motion.div>
  );
}
