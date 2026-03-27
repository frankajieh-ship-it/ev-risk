"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MapPin, ArrowLeft, ArrowRight } from "lucide-react";
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
}

type MilesMode = "weekly" | "commute";

const PAGES = [
  { title: "Charging & Home",      subtitle: "How will you charge?"         },
  { title: "Driving Patterns",     subtitle: "How do you drive?"            },
  { title: "Budget & Preferences", subtitle: "What are you looking for?"    },
  { title: "Final Adjustments",    subtitle: "Almost done"                  },
] as const;

export default function RoutineStep({ onComplete }: RoutineStepProps) {
  const { trackEvent } = useEventTracking();

  // --- Internal page index (0–3) ---
  const [currentPage, setCurrentPage] = useState(0);
  const [pageError, setPageError] = useState<string | null>(null);

  // --- Core fields ---
  const [chargingAccess, setChargingAccess] = useState<MinimumViableRoutine["charging_access"] | null>(null);
  const [milesMode, setMilesMode] = useState<MilesMode>("weekly");
  const [weeklyMiles, setWeeklyMiles] = useState<string>("");
  const [commuteMiles, setCommuteMiles] = useState<string>("");
  const [climate, setClimate] = useState<MinimumViableRoutine["climate"] | null>(null);
  const [longestDay, setLongestDay] = useState<MinimumViableRoutine["longest_day_pattern"] | null>(null);

  // ZIP → climate autofill
  const [zipCode, setZipCode] = useState("");
  const [zipClimateNote, setZipClimateNote] = useState<string | null>(null);

  // --- Quick Fit fields ---
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [bodyStyle, setBodyStyle] = useState<MinimumViableRoutine["body_style"] | null>(null);
  const [homeType, setHomeType] = useState<MinimumViableRoutine["home_type"] | null>(null);
  const [canInstallCharger, setCanInstallCharger] = useState<MinimumViableRoutine["can_install_charger"] | null>(null);
  const [sharedCharger, setSharedCharger] = useState<boolean | null>(null);
  const [overnightDwellHours, setOvernightDwellHours] = useState<number | null>(null);

  // --- Deep Fit fields (now on pages 1 & 3) ---
  const [longestDayMiles, setLongestDayMiles] = useState<string>("");
  const [parkingExposure, setParkingExposure] = useState<MinimumViableRoutine["parking_exposure"] | null>(null);
  const [minComfortableSoc, setMinComfortableSoc] = useState<number | null>(null);
  const [towingNeeds, setTowingNeeds] = useState<MinimumViableRoutine["towing_needs"] | null>(null);
  const [wantsCarplay, setWantsCarplay] = useState<boolean | null>(null);

  // Scroll-to-top on page change
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackEvent("routine_step_viewed");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPageError(null);
  }, [currentPage]);

  const buildRoutine = (): Partial<MinimumViableRoutine> => ({
    charging_access: chargingAccess || undefined,
    climate: climate || undefined,
    longest_day_pattern: longestDay || undefined,
    ...(milesMode === "weekly" && weeklyMiles ? { weekly_miles: Number(weeklyMiles) } : {}),
    ...(milesMode === "commute" && commuteMiles ? { commute_miles_roundtrip: Number(commuteMiles) } : {}),
    ...(budgetMax ? { budget_max: budgetMax } : {}),
    ...(bodyStyle ? { body_style: bodyStyle } : {}),
    ...(homeType ? { home_type: homeType } : {}),
    ...(canInstallCharger ? { can_install_charger: canInstallCharger } : {}),
    ...(sharedCharger != null ? { shared_charger: sharedCharger } : {}),
    ...(overnightDwellHours ? { overnight_dwell_hours: overnightDwellHours } : {}),
    ...(longestDayMiles ? { longest_day_miles: Number(longestDayMiles) } : {}),
    ...(parkingExposure ? { parking_exposure: parkingExposure } : {}),
    ...(minComfortableSoc != null ? { min_comfortable_soc: minComfortableSoc } : {}),
    ...(towingNeeds ? { towing_needs: towingNeeds } : {}),
    ...(wantsCarplay != null ? { wants_carplay: wantsCarplay } : {}),
  });

  /** Returns error message if current page's required fields are missing, else null */
  const validatePage = (): string | null => {
    if (currentPage === 0) {
      if (!chargingAccess) return "Select where you charge most often to continue";
    }
    if (currentPage === 1) {
      const hasMiles = milesMode === "weekly" ? !!weeklyMiles : !!commuteMiles;
      if (!hasMiles) return "Add your weekly miles or commute distance to continue";
      if (!longestDay) return "Select how often you have a longer driving day to continue";
    }
    if (currentPage === 3) {
      if (!climate) return "Select your climate to continue";
    }
    return null;
  };

  const handleNext = () => {
    const err = validatePage();
    if (err) {
      setPageError(err);
      return;
    }
    if (currentPage < 3) {
      trackEvent("routine_page_advanced", { from_page: currentPage });
      setCurrentPage(currentPage + 1);
    } else {
      // Final page — submit
      const routine = buildRoutine();
      const final = validateMVR(routine);
      if (!final.ok) {
        setPageError("Complete all required fields to continue");
        return;
      }
      trackEvent("proceeded_to_vehicle", { pages_completed: 4 });
      onComplete(routine as MinimumViableRoutine);
    }
  };

  const handleBack = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const trackField = (field: string) => {
    trackEvent("routine_field_completed", { field_id: field });
  };

  // ZIP code → auto-fill climate
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

  // Reusable card button
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

  // Skip affordance for optional fields
  const SkipButton = ({ onSkip }: { onSkip: () => void }) => (
    <button
      onClick={onSkip}
      className="mt-2 text-xs text-gray-400 hover:text-gray-500 underline"
    >
      Not sure → Skip
    </button>
  );

  // ── Page content ────────────────────────────────────────────────────────────

  const renderPage0 = () => (
    <div className="space-y-8">
      {/* Charging access (required) */}
      <fieldset>
        <legend className="sr-only">Where will you charge most often?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Where will you charge most often? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "home" as const, label: "Home",   desc: "Garage / driveway" },
            { value: "work" as const, label: "Work",   desc: "Workplace charger" },
            { value: "public" as const, label: "Public", desc: "Public networks"  },
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

      {/* Home charging sub-questions */}
      <AnimatePresence>
        {chargingAccess === "home" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200 pt-6 space-y-6">
              <p className="text-sm font-semibold text-gray-700">Home charging details</p>

              {/* Home type */}
              <fieldset>
                <legend className="sr-only">What type of home do you live in?</legend>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  What type of home do you live in?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    { value: "house" as const,     label: "House",     desc: "Single-family" },
                    { value: "apartment" as const, label: "Apartment", desc: "Rental unit"   },
                    { value: "condo" as const,     label: "Condo",     desc: "Owned unit"    },
                    { value: "other" as const,     label: "Other",     desc: "Townhome / other" },
                  ]).map((opt) => (
                    <SelectionCard
                      key={opt.value}
                      selected={homeType === opt.value}
                      onClick={() => { setHomeType(opt.value); if (homeType !== opt.value) trackField("home_type"); }}
                      label={opt.label}
                      desc={opt.desc}
                      ariaLabel={`Select ${opt.label}`}
                    />
                  ))}
                </div>
                <SkipButton onSkip={() => setHomeType(null)} />
              </fieldset>

              {/* Can install charger */}
              <fieldset>
                <legend className="sr-only">Can you install a charger?</legend>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Can you install a home charger?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "yes" as const,              label: "Yes",   desc: "Ready to go"       },
                    { value: "need_permission" as const,  label: "Maybe", desc: "Need permission"   },
                    { value: "no" as const,               label: "No",    desc: "Not possible"      },
                  ]).map((opt) => (
                    <SelectionCard
                      key={opt.value}
                      selected={canInstallCharger === opt.value}
                      onClick={() => { setCanInstallCharger(opt.value); if (canInstallCharger !== opt.value) trackField("can_install_charger"); }}
                      label={opt.label}
                      desc={opt.desc}
                      ariaLabel={`Select ${opt.label} — ${opt.desc}`}
                    />
                  ))}
                </div>
                <SkipButton onSkip={() => setCanInstallCharger(null)} />
              </fieldset>

              {/* Shared charger */}
              <fieldset>
                <legend className="sr-only">Do you share this charger with a partner?</legend>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Share this charger with a partner?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: true,  label: "Yes", desc: "Shared charging" },
                    { value: false, label: "No",  desc: "Just me"         },
                  ]).map((opt) => (
                    <SelectionCard
                      key={opt.value.toString()}
                      selected={sharedCharger === opt.value}
                      onClick={() => { setSharedCharger(opt.value); if (sharedCharger !== opt.value) trackField("shared_charger"); }}
                      label={opt.label}
                      desc={opt.desc}
                      ariaLabel={`Select ${opt.label} — ${opt.desc}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Shared chargers reduce available charging windows.</p>
                <SkipButton onSkip={() => setSharedCharger(null)} />
              </fieldset>

              {/* Overnight dwell */}
              <fieldset>
                <legend className="sr-only">How long is your car parked overnight?</legend>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  How long is your car parked overnight?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    { value: 6,  label: "~6 hours",  desc: "Short overnight"    },
                    { value: 8,  label: "~8 hours",  desc: "Typical night"      },
                    { value: 10, label: "~10 hours", desc: "Evening to morning" },
                    { value: 12, label: "12+ hours", desc: "Long dwell"         },
                  ]).map((opt) => (
                    <SelectionCard
                      key={opt.value}
                      selected={overnightDwellHours === opt.value}
                      onClick={() => { setOvernightDwellHours(opt.value); if (overnightDwellHours !== opt.value) trackField("overnight_dwell_hours"); }}
                      label={opt.label}
                      desc={opt.desc}
                      ariaLabel={`Select ${opt.label} parking time`}
                    />
                  ))}
                </div>
                <SkipButton onSkip={() => setOvernightDwellHours(null)} />
              </fieldset>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderPage1 = () => (
    <div className="space-y-8">
      {/* Miles (required) */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          {milesMode === "weekly"
            ? "How far do you drive in a typical week?"
            : "What\u2019s your daily roundtrip commute?"}{" "}
          <span className="text-red-500">*</span>
        </label>
        <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
          {(["weekly", "commute"] as MilesMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                if (milesMode !== mode) {
                  setMilesMode(mode);
                  trackEvent("toggle_weekly_vs_commute", { to: mode });
                }
              }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                milesMode === mode
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
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

      {/* Longest day pattern (required) */}
      <fieldset>
        <legend className="sr-only">How often do you have a longer-than-usual driving day?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          How often do you have a longer-than-usual driving day? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "once_a_week" as const,   label: "Weekly",  desc: "Once a week"          },
            { value: "monthly_trip" as const,  label: "Monthly", desc: "A few times a month"  },
            { value: "rare_road_trip" as const, label: "Rarely", desc: "A few times a year"   },
          ]).map((opt) => (
            <SelectionCard
              key={opt.value}
              selected={longestDay === opt.value}
              onClick={() => { setLongestDay(opt.value); if (longestDay !== opt.value) trackField("longest_day_pattern"); }}
              label={opt.label}
              desc={opt.desc}
              ariaLabel={`Select ${opt.label.toLowerCase()} — ${opt.desc.toLowerCase()}`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">The day that breaks routines first.</p>
      </fieldset>

      {/* Longest day miles (optional) */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          How many miles was your longest driving day recently?
        </label>
        <div className="relative">
          <input
            type="number"
            min="1"
            max="1000"
            placeholder="e.g. 150"
            value={longestDayMiles}
            onChange={(e) => {
              setLongestDayMiles(e.target.value);
              if (e.target.value && !longestDayMiles) trackField("longest_day_miles");
            }}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">miles</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Drives your minimum range requirement.</p>
        <SkipButton onSkip={() => setLongestDayMiles("")} />
      </div>

      {/* Parking exposure (optional) */}
      <fieldset>
        <legend className="sr-only">Where do you park overnight?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Where do you park overnight?
        </label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "garage" as const,  label: "Garage",  desc: "Protected / indoor" },
            { value: "outdoor" as const, label: "Outdoor", desc: "Driveway / lot"      },
            { value: "street" as const,  label: "Street",  desc: "Curbside"            },
          ]).map((opt) => (
            <SelectionCard
              key={opt.value}
              selected={parkingExposure === opt.value}
              onClick={() => { setParkingExposure(opt.value); if (parkingExposure !== opt.value) trackField("parking_exposure"); }}
              label={opt.label}
              desc={opt.desc}
              ariaLabel={`Select ${opt.label} parking`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Affects winter range loss and preconditioning.</p>
        <SkipButton onSkip={() => setParkingExposure(null)} />
      </fieldset>
    </div>
  );

  const renderPage2 = () => (
    <div className="space-y-8">
      {/* Budget (optional) */}
      <fieldset>
        <legend className="sr-only">What&apos;s your budget range?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          What&apos;s your budget range?
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { value: 25000,  label: "Under $25k", desc: "Entry-level EVs" },
            { value: 40000,  label: "$25k–$40k",  desc: "Mid-range"       },
            { value: 60000,  label: "$40k–$60k",  desc: "Premium"         },
            { value: 100000, label: "$60k+",      desc: "Luxury / truck"  },
          ]).map((opt) => (
            <SelectionCard
              key={opt.value}
              selected={budgetMax === opt.value}
              onClick={() => { setBudgetMax(opt.value); if (budgetMax !== opt.value) trackField("budget_max"); }}
              label={opt.label}
              desc={opt.desc}
              ariaLabel={`Select budget ${opt.label}`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Helps filter to vehicles you&apos;d actually consider.</p>
        <SkipButton onSkip={() => setBudgetMax(null)} />
      </fieldset>

      {/* Body style (optional) */}
      <fieldset>
        <legend className="sr-only">Preferred body style?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Preferred body style?
        </label>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {([
            { value: "sedan" as const,    label: "Sedan",  desc: "Compact / mid-size" },
            { value: "suv" as const,      label: "SUV",    desc: "Crossover / SUV"    },
            { value: "truck" as const,    label: "Truck",  desc: "Pickup"             },
            { value: "hatchback" as const, label: "Hatch", desc: "Hatchback"          },
            { value: "any" as const,      label: "Any",    desc: "No preference"      },
          ]).map((opt) => (
            <SelectionCard
              key={opt.value}
              selected={bodyStyle === opt.value}
              onClick={() => { setBodyStyle(opt.value); if (bodyStyle !== opt.value) trackField("body_style"); }}
              label={opt.label}
              desc={opt.desc}
              ariaLabel={`Select ${opt.label} body style`}
            />
          ))}
        </div>
        <SkipButton onSkip={() => setBodyStyle(null)} />
      </fieldset>

      {/* Towing (optional) */}
      <fieldset>
        <legend className="sr-only">Do you tow or carry heavy loads?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Do you tow or carry heavy loads?
        </label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "none" as const,  label: "None",  desc: "No towing"           },
            { value: "light" as const, label: "Light", desc: "Bike rack / trailer" },
            { value: "heavy" as const, label: "Heavy", desc: "Boat / camper"       },
          ]).map((opt) => (
            <SelectionCard
              key={opt.value}
              selected={towingNeeds === opt.value}
              onClick={() => { setTowingNeeds(opt.value); if (towingNeeds !== opt.value) trackField("towing_needs"); }}
              label={opt.label}
              desc={opt.desc}
              ariaLabel={`Select ${opt.label} towing`}
            />
          ))}
        </div>
        <SkipButton onSkip={() => setTowingNeeds(null)} />
      </fieldset>

      {/* CarPlay (optional) */}
      <fieldset>
        <legend className="sr-only">Must-have: Apple CarPlay / Android Auto?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Must-have: Apple CarPlay / Android Auto?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <SelectionCard
            selected={wantsCarplay === true}
            onClick={() => { setWantsCarplay(true); if (wantsCarplay !== true) trackField("wants_carplay"); }}
            label="Yes"
            desc="Must have CarPlay/AA"
            ariaLabel="Must have CarPlay/Android Auto"
          />
          <SelectionCard
            selected={wantsCarplay === false}
            onClick={() => { setWantsCarplay(false); if (wantsCarplay !== false) trackField("wants_carplay"); }}
            label="Not required"
            desc="Built-in system is fine"
            ariaLabel="CarPlay/Android Auto not required"
          />
        </div>
        <SkipButton onSkip={() => setWantsCarplay(null)} />
      </fieldset>
    </div>
  );

  const renderPage3 = () => (
    <div className="space-y-8">
      {/* Climate (required) */}
      <fieldset>
        <legend className="sr-only">What&apos;s your climate like?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          What&apos;s your climate like? <span className="text-red-500">*</span>
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
            { value: "winter" as const, label: "Cold winters", desc: "Regular snow & ice"    },
            { value: "mild" as const,   label: "Mild",          desc: "Moderate year-round"  },
            { value: "hot" as const,    label: "Hot",           desc: "Regular heat waves"   },
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
        <p className="text-xs text-gray-500 mt-2">
          Affects range buffer, charging speed, and routine friction.{" "}
          {zipCode.length === 5 ? "You can override the auto-detected climate above." : ""}
        </p>
      </fieldset>

      {/* Minimum comfortable SOC (optional) */}
      <fieldset>
        <legend className="sr-only">What&apos;s your minimum comfortable battery level?</legend>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          What&apos;s your minimum comfortable battery level?
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Some drivers feel anxious below 20%. This helps calibrate your effective range.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: 10,  label: "10–15%", desc: "I run it lean"       },
            { value: 20,  label: "20–25%", desc: "Moderate buffer"     },
            { value: 30,  label: "30%+",   desc: "Always well-charged" },
          ]).map((opt) => (
            <SelectionCard
              key={opt.value}
              selected={minComfortableSoc === opt.value}
              onClick={() => { setMinComfortableSoc(opt.value); if (minComfortableSoc !== opt.value) trackField("min_comfortable_soc"); }}
              label={opt.label}
              desc={opt.desc}
              ariaLabel={`Select ${opt.label} minimum battery`}
            />
          ))}
        </div>
        <SkipButton onSkip={() => setMinComfortableSoc(null)} />
      </fieldset>
    </div>
  );

  const pageContent = [renderPage0, renderPage1, renderPage2, renderPage3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto"
      ref={topRef}
    >
      {/* Step progress header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">
            Step {currentPage + 1} of {PAGES.length} · {PAGES[currentPage].title}
          </span>
          <span className="text-xs text-gray-400">{PAGES[currentPage].subtitle}</span>
        </div>
        {/* Dot progress */}
        <div className="flex gap-1.5 mb-1">
          {PAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentPage ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Page content — animated slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {pageContent[currentPage]()}
        </motion.div>
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {pageError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-sm text-red-600 text-center"
          >
            {pageError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="mt-8 flex gap-3">
        {currentPage > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <button
          onClick={handleNext}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
        >
          {currentPage < 3 ? (
            <>Next <ArrowRight className="w-4 h-4" /></>
          ) : (
            "Find Your EV →"
          )}
        </button>
      </div>

      {/* Page 2 skip-all nudge */}
      {currentPage === 2 && (
        <p className="text-center text-xs text-gray-400 mt-3">
          All questions on this page are optional — skip any you&apos;re unsure about.
        </p>
      )}
    </motion.div>
  );
}
