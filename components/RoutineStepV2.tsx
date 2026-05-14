"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Car, DollarSign } from "lucide-react";
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

function mapClimateSeasonality(cs: string): ClimateBand | null {
  switch (cs) {
    case "COLD_WINTER": return "winter";
    case "HOT_SUMMER": return "hot";
    case "MILD":
    case "MIXED": return "mild";
    default: return null;
  }
}

function getMissingFieldHint(errors: string[]): string | null {
  if (!errors.length) return null;
  const first = errors[0];
  if (first.includes("charging_access")) return "Answer the charging questions to continue";
  if (first.includes("weekly_miles") || first.includes("commute_miles"))
    return "Add weekly miles or commute distance to continue";
  if (first.includes("climate")) return "Select your climate to continue";
  if (first.includes("longest_day")) return "Add long day pattern to continue";
  return "Complete all required fields to continue";
}

export default function RoutineStepV2({ onComplete }: RoutineStepV2Props) {
  const { trackEvent, trackRoutineFormPartialAbandon } = useEventTracking();

  // Q1: Miles
  const [milesMode, setMilesMode] = useState<MilesMode>("weekly");
  const [weeklyMiles, setWeeklyMiles] = useState<string>("");
  const [commuteMiles, setCommuteMiles] = useState<string>("");

  // Q2: Home charging
  const [hasHomeCharging, setHasHomeCharging] = useState<boolean | null>(null);
  const [homeChargingType, setHomeChargingType] = useState<"L1" | "L2" | "UNKNOWN">("UNKNOWN");

  // Q3: Budget
  const [budgetMax, setBudgetMax] = useState<string>("");

  // Q4: Body style
  const [bodyStyle, setBodyStyle] = useState<MinimumViableRoutine["body_style"] | null>(null);

  // Q5: Climate
  const [climate, setClimate] = useState<ClimateBand | null>(null);
  const [climateAutoDetected, setClimateAutoDetected] = useState(false);

  // Q6: Longest day pattern
  const [longestDay, setLongestDay] = useState<MinimumViableRoutine["longest_day_pattern"] | null>(null);

  // Q7: ZIP code
  const [zipCode, setZipCode] = useState<string>("");

  // Vehicle selector (kept as optional bonus — does not count toward 7 core Qs)
  const [vehicleProfiles, setVehicleProfiles] = useState<VehicleProfile[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [showManualVehicle, setShowManualVehicle] = useState(false);
  const [manualMake, setManualMake] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualRange, setManualRange] = useState("");

  // Refs for scroll-to-field
  const milesRef = useRef<HTMLDivElement>(null);
  const chargingRef = useRef<HTMLFieldSetElement>(null);
  const climateRef = useRef<HTMLFieldSetElement>(null);
  const longestDayRef = useRef<HTMLFieldSetElement>(null);

  // Abandon tracking
  const pageLoadTimeRef = useRef(Date.now());
  const lastFieldTouchedRef = useRef<string>("");
  const formCompletedRef = useRef(false);

  // Derive charging_access for MVR backward compat
  const chargingAccess: MinimumViableRoutine["charging_access"] | null =
    hasHomeCharging === true ? "home"
    : hasHomeCharging === false ? "public"
    : null;

  useEffect(() => { trackEvent("routine_step_viewed"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (chargingAccess !== null) lastFieldTouchedRef.current = "charging_access"; }, [chargingAccess]);
  useEffect(() => { if (weeklyMiles || commuteMiles) lastFieldTouchedRef.current = milesMode === "weekly" ? "weekly_miles" : "commute_miles"; }, [weeklyMiles, commuteMiles, milesMode]);
  useEffect(() => { if (zipCode) lastFieldTouchedRef.current = "zip_code"; }, [zipCode]);
  useEffect(() => { if (climate !== null) lastFieldTouchedRef.current = "climate"; }, [climate]);
  useEffect(() => { if (longestDay !== null) lastFieldTouchedRef.current = "longest_day"; }, [longestDay]);
  useEffect(() => { if (bodyStyle !== null) lastFieldTouchedRef.current = "body_style"; }, [bodyStyle]);
  useEffect(() => { if (selectedVehicleId) lastFieldTouchedRef.current = "vehicle"; }, [selectedVehicleId]);

  useEffect(() => {
    const getFilledFields = (): string[] => {
      const fields: string[] = [];
      if (hasHomeCharging !== null) fields.push("has_home_charging");
      if (weeklyMiles || commuteMiles) fields.push("miles");
      if (zipCode) fields.push("zip_code");
      if (climate !== null) fields.push("climate");
      if (longestDay !== null) fields.push("longest_day");
      if (bodyStyle !== null) fields.push("body_style");
      if (budgetMax) fields.push("budget_max");
      if (selectedVehicleId) fields.push("vehicle");
      return fields;
    };

    const fireAbandon = (trigger: string) => {
      const filledFields = getFilledFields();
      if (filledFields.length > 0 && !formCompletedRef.current) {
        trackRoutineFormPartialAbandon({
          fields_filled: filledFields,
          time_on_page_seconds: Math.floor((Date.now() - pageLoadTimeRef.current) / 1000),
          last_field_touched: lastFieldTouchedRef.current || "unknown",
          abandon_trigger: trigger,
        });
      }
    };

    const handleBeforeUnload = () => fireAbandon("navigation");
    const handleVisibilityChange = () => { if (document.visibilityState === "hidden") fireAbandon("visibility_change"); };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasHomeCharging, weeklyMiles, commuteMiles, zipCode, climate, longestDay, bodyStyle, budgetMax, selectedVehicleId, trackRoutineFormPartialAbandon]);

  // Load vehicle profiles
  useEffect(() => {
    let cancelled = false;
    async function loadVehicles() {
      try {
        const res = await fetch("/api/routine/vehicles");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.vehicles) setVehicleProfiles(data.vehicles);
        }
      } catch { /* fail silently — vehicle selector is optional */ }
      finally { if (!cancelled) setVehiclesLoading(false); }
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
    } else if (climateAutoDetected) {
      setClimateAutoDetected(false);
    }
  }, [climateAutoDetected, trackEvent]);

  const buildRoutine = (): Partial<MinimumViableRoutine> => ({
    charging_access: chargingAccess || undefined,
    climate: climate || "mild",
    longest_day_pattern: longestDay || "monthly_trip",
    ...(milesMode === "weekly" && weeklyMiles ? { weekly_miles: Number(weeklyMiles) } : {}),
    ...(milesMode === "commute" && commuteMiles ? { commute_miles_roundtrip: Number(commuteMiles) } : {}),
    ...(budgetMax ? { budget_max: Number(budgetMax) } : {}),
    ...(bodyStyle ? { body_style: bodyStyle } : {}),
  });

  const validation = validateMVR(buildRoutine());
  const isValid = validation.ok;

  // Confidence meter — 7 core questions, each contributes
  const hasMiles = milesMode === "weekly" ? !!weeklyMiles : !!commuteMiles;
  const hasZip = zipCode.length === 5;
  const hasVehicle = !!selectedVehicleId;
  const confidencePct = Math.min(100,
    20 +
    (hasMiles ? 15 : 0) +
    (hasHomeCharging !== null ? 15 : 0) +
    (budgetMax ? 8 : 0) +
    (bodyStyle !== null ? 8 : 0) +
    (climate ? 10 : 0) +
    (longestDay ? 10 : 0) +
    (hasZip ? 7 : 0) +
    (hasVehicle ? 7 : 0)
  );

  const getNextHint = (): string => {
    if (!hasMiles) return "Add your weekly miles to start";
    if (hasHomeCharging === null) return "Answer the home charging question";
    if (!climate) return "Select your climate";
    if (!longestDay) return "Add your long-day pattern";
    if (!hasZip) return "Add your ZIP for live charger data";
    return "Ready for analysis";
  };

  const trackField = (field: string) => trackEvent("routine_field_completed", { field_id: field });

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
    const usingManual = showManualVehicle && !selectedVehicleId && manualMake && manualModel;

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
    });

    formCompletedRef.current = true;

    onComplete({
      anon_session_id: "",
      home_location_zip: zipCode || undefined,
      region: "US",
      climate_band: climate ?? "mild",
      climate_auto_detected: climateAutoDetected,
      home_charging: chargingAccess!,
      vehicle_profile_id: selectedVehicleId || undefined,
      vehicle_year: usingManual ? (manualYear ? Number(manualYear) : undefined) : selectedVehicle?.year,
      vehicle_make: usingManual ? manualMake : selectedVehicle?.make,
      vehicle_model: usingManual ? manualModel : selectedVehicle?.model,
      vehicle_range_mi: usingManual && manualRange ? Number(manualRange) : undefined,
      weekly_miles: milesMode === "weekly" && weeklyMiles ? Number(weeklyMiles) : undefined,
      commute_miles_roundtrip: milesMode === "commute" && commuteMiles ? Number(commuteMiles) : undefined,
      longest_day_pattern: longestDay ?? "monthly_trip",
      has_home_charging: hasHomeCharging ?? undefined,
      home_charging_type: hasHomeCharging ? homeChargingType : undefined,
    });
  };

  const SelectionCard = ({
    selected, onClick, label, desc, ariaLabel,
  }: { selected: boolean; onClick: () => void; label: string; desc: string; ariaLabel: string }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={`relative p-4 rounded-xl border-2 text-left transition-all min-h-[56px] ${
        selected
          ? "border-[#00d97e] bg-[#00d97e]/10 shadow-sm"
          : "border-white/[0.10] hover:border-white/25 bg-[#161b22]"
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-[#00d97e]" />
        </span>
      )}
      <div className="font-semibold text-white/90 text-sm">{label}</div>
      <div className={`text-xs mt-1 ${selected ? "text-[#00d97e]" : "text-white/40"}`}>{desc}</div>
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Find Your Perfect EV Match</h2>
        <p className="text-white/50">7 quick questions — get instant ranked matches tailored to your routine.</p>
      </div>

      {/* Confidence meter */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-white/40 mb-1.5">
          <span>Match confidence: {confidencePct}%</span>
          <span>{getNextHint()}</span>
        </div>
        <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#00d97e] rounded-full"
            initial={{ width: "20%" }}
            animate={{ width: `${confidencePct}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="space-y-8">

        {/* Q1: Miles */}
        <div ref={milesRef}>
          <label className="block text-sm font-semibold text-white/70 mb-3">
            1. How far do you drive in a typical week?
          </label>
          <div className="flex bg-white/[0.06] rounded-lg p-1 mb-3">
            {(["weekly", "commute"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => { if (milesMode !== mode) { setMilesMode(mode); trackEvent("toggle_weekly_vs_commute", { to: mode }); }}}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  milesMode === mode ? "bg-white/[0.12] text-white" : "text-white/40 hover:text-white/70"
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
                if (milesMode === "weekly") { setWeeklyMiles(e.target.value); if (e.target.value && !weeklyMiles) trackField("weekly_miles"); }
                else { setCommuteMiles(e.target.value); if (e.target.value && !commuteMiles) trackField("commute_miles"); }
              }}
              className="form-input text-white bg-[#161b22] border-white/[0.10]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40">
              {milesMode === "weekly" ? "miles/week" : "miles/day"}
            </span>
          </div>
        </div>

        {/* Q2: Home charging */}
        <fieldset ref={chargingRef} className="space-y-4">
          <legend className="block text-sm font-semibold text-white/70 mb-0">
            2. Do you have home charging?
          </legend>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: true, label: "Yes — Level 2", desc: "240V wall charger" },
              { value: "l1" as unknown as boolean, label: "Yes — Level 1", desc: "Standard 120V outlet" },
              { value: false, label: "No", desc: "No home outlet" },
            ] as const).map((opt) => {
              const isL1 = (opt.value as unknown) === "l1";
              const isSelected = isL1
                ? hasHomeCharging === true && homeChargingType === "L1"
                : opt.value === true
                ? hasHomeCharging === true && homeChargingType !== "L1"
                : hasHomeCharging === false;
              return (
                <SelectionCard
                  key={String(opt.value)}
                  selected={isSelected}
                  onClick={() => {
                    if (isL1) { setHasHomeCharging(true); setHomeChargingType("L1"); }
                    else if (opt.value === true) { setHasHomeCharging(true); setHomeChargingType("L2"); }
                    else { setHasHomeCharging(false); }
                    trackField("has_home_charging");
                  }}
                  label={opt.label}
                  desc={opt.desc}
                  ariaLabel={opt.label}
                />
              );
            })}
          </div>
        </fieldset>

        {/* Q3: Budget */}
        <div>
          <label className="block text-sm font-semibold text-white/70 mb-3">
            3. <DollarSign className="w-4 h-4 inline -mt-0.5" /> What&apos;s your budget? <span className="text-white/30 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-medium">$</span>
            <input
              type="number"
              min="5000"
              max="200000"
              step="1000"
              placeholder="e.g. 35000"
              value={budgetMax}
              onChange={(e) => { setBudgetMax(e.target.value); if (e.target.value && !budgetMax) trackField("budget_max"); }}
              className="form-input pl-8 text-white bg-[#161b22] border-white/[0.10]"
            />
          </div>
          <p className="text-xs text-white/30 mt-2">Filters EV matches to your price range.</p>
        </div>

        {/* Q4: Body style */}
        <div>
          <label className="block text-sm font-semibold text-white/70 mb-3">
            4. What type of vehicle?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "suv" as const, label: "SUV", desc: "Crossover or SUV" },
              { value: "sedan" as const, label: "Sedan", desc: "Car or coupe" },
              { value: "truck" as const, label: "Truck", desc: "Pickup truck" },
              { value: "hatchback" as const, label: "Hatchback", desc: "Compact hatch" },
              { value: "any" as const, label: "Any", desc: "Open to all" },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={bodyStyle === opt.value}
                onClick={() => { setBodyStyle(opt.value); trackField("body_style"); }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label}`}
              />
            ))}
          </div>
        </div>

        {/* Q5: Climate */}
        <fieldset ref={climateRef}>
          <legend className="block text-sm font-semibold text-white/70 mb-3">
            5. What&apos;s your climate?
            {climateAutoDetected && <span className="text-[#00d97e]/70 font-normal ml-2">(auto-detected from ZIP)</span>}
          </legend>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "winter" as const, label: "Cold winters", desc: "Snow & ice" },
              { value: "mild" as const, label: "Mild", desc: "Moderate year-round" },
              { value: "hot" as const, label: "Hot summers", desc: "Regular heat waves" },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={climate === opt.value}
                onClick={() => { setClimate(opt.value); setClimateAutoDetected(false); trackField("climate"); }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label} climate`}
              />
            ))}
          </div>
        </fieldset>

        {/* Q6: Longest day pattern */}
        <fieldset ref={longestDayRef}>
          <legend className="block text-sm font-semibold text-white/70 mb-3">
            6. How often do you take 100+ mile trips?
          </legend>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "once_a_week" as const, label: "Weekly", desc: "Once a week" },
              { value: "monthly_trip" as const, label: "Monthly", desc: "A few times/month" },
              { value: "rare_road_trip" as const, label: "Rarely", desc: "Few times a year" },
            ]).map((opt) => (
              <SelectionCard
                key={opt.value}
                selected={longestDay === opt.value}
                onClick={() => { setLongestDay(opt.value); trackField("longest_day_pattern"); }}
                label={opt.label}
                desc={opt.desc}
                ariaLabel={`Select ${opt.label}`}
              />
            ))}
          </div>
        </fieldset>

        {/* Q7: ZIP code */}
        <div>
          <label className="block text-sm font-semibold text-white/70 mb-3">
            7. <MapPin className="w-4 h-4 inline -mt-0.5" /> Your ZIP code <span className="text-white/30 font-normal">(optional — unlocks live charger data)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="e.g. 10001"
            value={zipCode}
            onChange={(e) => handleZipChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="form-input text-white bg-[#161b22] border-white/[0.10]"
          />
          {climateAutoDetected && climate && (
            <p className="text-xs text-[#00d97e] mt-1">
              Climate auto-detected: {climate === "winter" ? "Cold winters" : climate === "hot" ? "Hot summers" : "Mild"}
            </p>
          )}
        </div>

        {/* Vehicle selector — optional bonus signal */}
        <div>
          <label className="block text-sm font-semibold text-white/70 mb-3">
            <Car className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Comparing a specific EV? <span className="text-white/30 font-normal">(optional)</span>
          </label>
          {vehiclesLoading ? (
            <div className="form-input text-white/30 bg-[#161b22] border-white/[0.10]">Loading vehicles…</div>
          ) : !showManualVehicle ? (
            <>
              {vehicleProfiles.length > 0 ? (
                <select
                  value={selectedVehicleId}
                  onChange={(e) => { setSelectedVehicleId(e.target.value); if (e.target.value) trackField("vehicle"); }}
                  className="form-input text-white bg-[#161b22] border-white/[0.10]"
                >
                  <option value="">Select an EV (optional)</option>
                  {Array.from(new Set(vehicleProfiles.map((v) => v.make))).sort().map((make) => (
                    <optgroup key={make} label={make}>
                      {vehicleProfiles.filter((v) => v.make === make).sort((a, b) => b.year - a.year).map((vp) => (
                        <option key={vp.id} value={vp.id}>
                          {vp.year} {vp.make} {vp.model}{vp.trim ? ` ${vp.trim}` : ""}{vp.usable_range_mi_estimate ? ` (${vp.usable_range_mi_estimate} mi)` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-white/30">No vehicle profiles available.</p>
              )}
              <button
                type="button"
                onClick={() => { setSelectedVehicleId(""); setShowManualVehicle(true); }}
                className="text-xs text-white/40 hover:text-white/70 mt-2 underline underline-offset-2 transition-colors"
              >
                Don&apos;t see yours? Enter manually
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Make (e.g. Hyundai)" value={manualMake} onChange={(e) => setManualMake(e.target.value)} className="form-input text-white bg-[#161b22] border-white/[0.10] text-sm" />
                <input type="text" placeholder="Model (e.g. Kona Electric)" value={manualModel} onChange={(e) => setManualModel(e.target.value)} className="form-input text-white bg-[#161b22] border-white/[0.10] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Year (e.g. 2022)" value={manualYear} onChange={(e) => setManualYear(e.target.value)} className="form-input text-white bg-[#161b22] border-white/[0.10] text-sm" min={2010} max={2026} />
                <input type="number" placeholder="Est. range in miles" value={manualRange} onChange={(e) => setManualRange(e.target.value)} className="form-input text-white bg-[#161b22] border-white/[0.10] text-sm" min={50} max={600} />
              </div>
              <button type="button" onClick={() => { setShowManualVehicle(false); setManualMake(""); setManualModel(""); setManualYear(""); setManualRange(""); }} className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors">
                Back to vehicle list
              </button>
            </div>
          )}
          <p className="text-xs text-white/30 mt-2">Selecting a vehicle improves range and charging estimates.</p>
        </div>

        {/* Submit */}
        <div className="pt-4 space-y-3">
          {!isValid && (
            <p className="text-sm text-white/40 text-center">{getMissingFieldHint(validation.errors)}</p>
          )}
          <button
            onClick={handleSubmit}
            className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
              isValid
                ? "bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] shadow-md hover:shadow-lg"
                : "bg-white/[0.08] text-white/30 cursor-not-allowed"
            }`}
          >
            See My EV Matches →
          </button>
          <p className="text-xs text-center text-white/25">After results load, use the filter panel to refine further.</p>
        </div>

      </div>
    </motion.div>
  );
}
