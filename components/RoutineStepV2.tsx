"use client";

/**
 * RoutineStepV2 — Extended intake form for Routine Reliability Planner
 *
 * Adds to existing RoutineStep:
 * - ZIP code input (optional, enables weather + charger lookup)
 * - Climate auto-detect from ZIP
 * - Vehicle selector (dropdown from vehicle_profiles table)
 * - Shared charger toggle
 *
 * Does NOT modify the original RoutineStep.tsx.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Car, Users } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { inferClimateFromZip } from "@/lib/zip-climate-mapping";
import type { MinimumViableRoutine } from "@/types/v2";
import { validateMVR } from "@/types/v2";
import type { RoutineProfile, VehicleProfile } from "@/types/routine-v2";

interface RoutineStepV2Props {
  onComplete: (profile: Omit<RoutineProfile, "id" | "created_at" | "updated_at">) => void;
}

type MilesMode = "weekly" | "commute";
type ClimateBand = "winter" | "mild" | "hot";

// Map ClimateSeasonality → ClimateBand
function mapClimateSeasonality(cs: string): ClimateBand | null {
  switch (cs) {
    case "COLD_WINTER":
      return "winter";
    case "HOT_SUMMER":
      return "hot";
    case "MILD":
    case "MIXED":
      return "mild";
    default:
      return null;
  }
}

// Map validation errors to friendly messages
function getMissingFieldHint(errors: string[]): string | null {
  if (!errors.length) return null;
  const first = errors[0];
  if (first.includes("charging_access")) return "Select where you charge to continue";
  if (first.includes("weekly_miles") || first.includes("commute_miles"))
    return "Add weekly miles or commute distance to continue";
  if (first.includes("climate")) return "Select your climate to continue";
  if (first.includes("longest_day")) return "Add long day pattern to continue";
  return "Complete all fields to continue";
}

export default function RoutineStepV2({ onComplete }: RoutineStepV2Props) {
  const { trackEvent, trackRoutineFormPartialAbandon } = useEventTracking();

  // Core routine fields (same as RoutineStep)
  const [chargingAccess, setChargingAccess] = useState<MinimumViableRoutine["charging_access"] | null>(null);
  const [milesMode, setMilesMode] = useState<MilesMode>("weekly");
  const [weeklyMiles, setWeeklyMiles] = useState<string>("");
  const [commuteMiles, setCommuteMiles] = useState<string>("");
  const [climate, setClimate] = useState<ClimateBand | null>(null);
  const [longestDay, setLongestDay] = useState<MinimumViableRoutine["longest_day_pattern"] | null>(null);

  // V2 additions
  const [zipCode, setZipCode] = useState<string>("");
  const [climateAutoDetected, setClimateAutoDetected] = useState(false);
  const [sharedCharger, setSharedCharger] = useState(false);
  const [vehicleProfiles, setVehicleProfiles] = useState<VehicleProfile[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  // Refs for scroll-to-field
  const chargingRef = useRef<HTMLFieldSetElement>(null);
  const milesRef = useRef<HTMLDivElement>(null);
  const climateRef = useRef<HTMLFieldSetElement>(null);
  const longestDayRef = useRef<HTMLFieldSetElement>(null);

  // Track step viewed on mount
  useEffect(() => {
    trackEvent("routine_step_viewed");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track page load time for abandon tracking (NEW: March 2026)
  const pageLoadTimeRef = useRef(Date.now());
  const lastFieldTouchedRef = useRef<string>("");
  const formCompletedRef = useRef(false);

  // Update last field touched whenever any field changes
  useEffect(() => {
    if (chargingAccess !== null) lastFieldTouchedRef.current = "charging_access";
  }, [chargingAccess]);

  useEffect(() => {
    if (weeklyMiles || commuteMiles) lastFieldTouchedRef.current = milesMode === "weekly" ? "weekly_miles" : "commute_miles";
  }, [weeklyMiles, commuteMiles, milesMode]);

  useEffect(() => {
    if (zipCode) lastFieldTouchedRef.current = "zip_code";
  }, [zipCode]);

  useEffect(() => {
    if (climate !== null) lastFieldTouchedRef.current = "climate";
  }, [climate]);

  useEffect(() => {
    if (longestDay !== null) lastFieldTouchedRef.current = "longest_day";
  }, [longestDay]);

  useEffect(() => {
    if (selectedVehicleId) lastFieldTouchedRef.current = "vehicle";
  }, [selectedVehicleId]);

  useEffect(() => {
    if (sharedCharger) lastFieldTouchedRef.current = "shared_charger";
  }, [sharedCharger]);

  // Track partial abandon on page unload (NEW: March 2026)
  useEffect(() => {
    const getFilledFields = (): string[] => {
      const fields: string[] = [];
      if (chargingAccess !== null) fields.push("charging_access");
      if (weeklyMiles || commuteMiles) fields.push("miles");
      if (zipCode) fields.push("zip_code");
      if (climate !== null) fields.push("climate");
      if (longestDay !== null) fields.push("longest_day");
      if (selectedVehicleId) fields.push("vehicle");
      if (sharedCharger) fields.push("shared_charger");
      return fields;
    };

    const handleBeforeUnload = () => {
      const filledFields = getFilledFields();
      if (filledFields.length > 0 && !formCompletedRef.current) {
        const timeOnPage = Math.floor((Date.now() - pageLoadTimeRef.current) / 1000);
        trackRoutineFormPartialAbandon({
          fields_filled: filledFields,
          time_on_page_seconds: timeOnPage,
          last_field_touched: lastFieldTouchedRef.current || "unknown",
          abandon_trigger: "navigation",
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const filledFields = getFilledFields();
        if (filledFields.length > 0 && !formCompletedRef.current) {
          const timeOnPage = Math.floor((Date.now() - pageLoadTimeRef.current) / 1000);
          trackRoutineFormPartialAbandon({
            fields_filled: filledFields,
            time_on_page_seconds: timeOnPage,
            last_field_touched: lastFieldTouchedRef.current || "unknown",
            abandon_trigger: "visibility_change",
          });
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [chargingAccess, weeklyMiles, commuteMiles, zipCode, climate, longestDay, selectedVehicleId, sharedCharger, trackRoutineFormPartialAbandon]);

  // Load vehicle profiles
  useEffect(() => {
    let cancelled = false;
    async function loadVehicles() {
      try {
        const res = await fetch("/api/routine/vehicles");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.vehicles) {
            setVehicleProfiles(data.vehicles);
          }
        }
      } catch {
        // Fail silently — vehicle selector is optional
      } finally {
        if (!cancelled) setVehiclesLoading(false);
      }
    }
    loadVehicles();
    return () => { cancelled = true; };
  }, []);

  // Auto-detect climate from ZIP
  const handleZipChange = useCallback((value: string) => {
    setZipCode(value);
    if (value.length === 5 && /^\d{5}$/.test(value)) {
      const detected = inferClimateFromZip(value, "US");
      const mapped = mapClimateSeasonality(detected);
      if (mapped) {
        setClimate(mapped);
        setClimateAutoDetected(true);
        trackEvent("routine_field_completed", { field: "zip_climate_auto" });
      }
    } else {
      if (climateAutoDetected) {
        setClimateAutoDetected(false);
      }
    }
  }, [climateAutoDetected, trackEvent]);

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
  const hasVehicle = !!selectedVehicleId;
  const hasZip = zipCode.length === 5;
  const confidencePct =
    30 +
    (chargingAccess ? 15 : 0) +
    (hasMiles ? 15 : 0) +
    (climate ? 10 : 0) +
    (longestDay ? 10 : 0) +
    (hasZip ? 10 : 0) +
    (hasVehicle ? 10 : 0);

  const getNextHint = (): string => {
    if (!chargingAccess) return "Add charging access to improve accuracy";
    if (!hasMiles) return "Add driving miles to improve accuracy";
    if (!climate) return "Add climate to improve accuracy";
    if (!longestDay) return "Add long day pattern";
    if (!hasZip) return "Add ZIP for weather + charger data";
    if (!hasVehicle) return "Select vehicle for full analysis";
    return "Ready for analysis";
  };

  // Track field completions
  const trackField = (field: string) => {
    trackEvent("routine_field_completed", { field_id: field });
  };

  const handleSubmit = () => {
    if (!isValid) {
      trackEvent("routine_step_blocked", { missing: validation.errors });
      const first = validation.errors[0];
      if (first?.includes("charging_access")) chargingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (first?.includes("weekly_miles") || first?.includes("commute_miles")) milesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (first?.includes("climate")) climateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (first?.includes("longest_day")) longestDayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const selectedVehicle = vehicleProfiles.find((v) => v.id === selectedVehicleId);

    // Track routine check started (when user submits the form)
    trackEvent("routine_check_started", {
      charging_access: chargingAccess,
      has_zip: hasZip,
      has_vehicle: hasVehicle,
      climate_auto_detected: climateAutoDetected,
    });

    trackEvent("routine_check_completed", {
      charging_access: chargingAccess,
      has_zip: hasZip,
      has_vehicle: hasVehicle,
      climate_auto_detected: climateAutoDetected,
    });

    // Mark form as completed to prevent abandon tracking
    formCompletedRef.current = true;

    onComplete({
      anon_session_id: "", // Set by caller
      home_location_zip: zipCode || undefined,
      region: "US",
      climate_band: climate!,
      climate_auto_detected: climateAutoDetected,
      home_charging: chargingAccess!,
      vehicle_profile_id: selectedVehicleId || undefined,
      vehicle_year: selectedVehicle?.year,
      vehicle_make: selectedVehicle?.make,
      vehicle_model: selectedVehicle?.model,
      weekly_miles: milesMode === "weekly" && weeklyMiles ? Number(weeklyMiles) : undefined,
      commute_miles_roundtrip: milesMode === "commute" && commuteMiles ? Number(commuteMiles) : undefined,
      longest_day_pattern: longestDay!,
      shared_charger: sharedCharger,
    });
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your EV Routine Profile</h2>
        <p className="text-gray-600">We&apos;ll find what breaks first in your charging routine and build a Plan B.</p>
      </div>

      {/* Confidence meter */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Analysis confidence: {confidencePct}%</span>
          <span>{getNextHint()}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: "30%" }}
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
            Where do you charge most often?
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
        </div>

        {/* Q3: ZIP Code (optional — enables weather + charger search) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            <MapPin className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Your ZIP code <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="e.g. 10001"
            value={zipCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 5);
              handleZipChange(val);
            }}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900"
          />
          <p className="text-xs text-gray-500 mt-2">
            Enables real-time weather and nearby charger data for your area.
          </p>
          {climateAutoDetected && climate && (
            <p className="text-xs text-blue-600 mt-1">
              Climate auto-detected: {climate === "winter" ? "Cold winters" : climate === "hot" ? "Hot" : "Mild"}
            </p>
          )}
        </div>

        {/* Q4: Climate */}
        <fieldset ref={climateRef}>
          <legend className="sr-only">What&apos;s your climate like?</legend>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            What&apos;s your climate like?
            {climateAutoDetected && <span className="text-blue-500 font-normal ml-2">(auto-detected from ZIP)</span>}
          </label>
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
                  setClimateAutoDetected(false); // User override
                  if (climate !== opt.value) trackField("climate");
                }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label.toLowerCase()} climate — ${opt.desc.toLowerCase()}`}
              />
            ))}
          </div>
        </fieldset>

        {/* Q5: Longest Day Pattern */}
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
        </fieldset>

        {/* Q6: Vehicle Selector (optional) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            <Car className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Your EV <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          {vehiclesLoading ? (
            <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-400 text-sm">
              Loading vehicles...
            </div>
          ) : vehicleProfiles.length > 0 ? (
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                if (e.target.value) trackField("vehicle");
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 bg-white"
            >
              <option value="">Select your EV (optional)</option>
              {vehicleProfiles.map((vp) => (
                <option key={vp.id} value={vp.id}>
                  {vp.year} {vp.make} {vp.model}{vp.trim ? ` ${vp.trim}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-400">No vehicle profiles available yet.</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Selecting your EV improves range and charging speed estimates.
          </p>
        </div>

        {/* Q7: Shared Charger */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Share a charger with a partner?</span>
            <button
              role="switch"
              aria-checked={sharedCharger}
              onClick={() => {
                setSharedCharger(!sharedCharger);
                trackField("shared_charger");
              }}
              className={`relative ml-auto inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                sharedCharger ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                  sharedCharger ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-7">
            Shared chargers reduce available charging windows.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-4 space-y-3">
          {!isValid && (
            <p className="text-sm text-gray-500 text-center">
              {getMissingFieldHint(validation.errors)}
            </p>
          )}

          <button
            onClick={handleSubmit}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all ${
              isValid
                ? "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Analyze My Routine
          </button>
        </div>
      </div>
    </motion.div>
  );
}
