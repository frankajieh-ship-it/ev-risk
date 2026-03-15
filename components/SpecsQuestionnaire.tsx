"use client";

/**
 * SpecsQuestionnaire — Optional specs & accessories refinement
 *
 * Section 1: Hard-filter questions (drivetrain, range floor, fast charge, towing)
 * Section 2: Preference questions (heat pump, ADAS, interior, wheels, winter)
 *
 * Calls onSubmit with completed VehicleSpecsPrefs. Calls onSkip to bail out.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import type { VehicleSpecsPrefs } from "@/types/v2";

interface SpecsQuestionnaireProps {
  onSubmit: (prefs: VehicleSpecsPrefs) => void;
  onSkip: () => void;
}

// ============================================================
// REUSABLE CARD
// ============================================================

function SelectionCard({
  selected,
  onClick,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative p-4 rounded-xl border-2 text-left transition-all w-full ${
        selected
          ? "border-blue-600 bg-blue-50 shadow-sm"
          : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-blue-600" />
        </span>
      )}
      <div className="font-semibold text-gray-900 text-sm pr-6">{label}</div>
      <div className={`text-xs mt-0.5 ${selected ? "text-blue-700" : "text-gray-500"}`}>{desc}</div>
    </button>
  );
}

// Multi-select chip
function Chip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
        selected
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      }`}
    >
      {selected && <span className="mr-1">✓</span>}
      {label}
    </button>
  );
}

// Section header
function SectionHeader({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {number}
        </span>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 pl-8">{subtitle}</p>
    </div>
  );
}

// Question label
function QLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-800 mb-3">{children}</p>;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SpecsQuestionnaire({ onSubmit, onSkip }: SpecsQuestionnaireProps) {
  // Section 1 — Hard filters
  const [drivetrain, setDrivetrain] = useState<VehicleSpecsPrefs["drivetrain"] | null>(null);
  const [minWinterRange, setMinWinterRange] = useState<number>(200);
  const [fastCharge, setFastCharge] = useState<VehicleSpecsPrefs["fast_charge_kw"] | null>(null);
  const [towing, setTowing] = useState<VehicleSpecsPrefs["towing"] | null>(null);

  // Section 2 — Preference scoring
  const [heatPump, setHeatPump] = useState<VehicleSpecsPrefs["heat_pump"] | null>(null);
  const [adas, setAdas] = useState<VehicleSpecsPrefs["adas"]>([]);
  const [interior, setInterior] = useState<VehicleSpecsPrefs["interior"] | null>(null);
  const [wheelSize, setWheelSize] = useState<VehicleSpecsPrefs["wheel_size"] | null>(null);
  const [winterReadiness, setWinterReadiness] = useState<VehicleSpecsPrefs["winter_readiness"] | null>(null);

  const isComplete =
    drivetrain !== null &&
    fastCharge !== null &&
    towing !== null &&
    heatPump !== null &&
    adas.length > 0 &&
    interior !== null &&
    wheelSize !== null &&
    winterReadiness !== null;

  const toggleAdas = (val: VehicleSpecsPrefs["adas"][number]) => {
    setAdas((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const handleSubmit = () => {
    if (!isComplete) return;
    onSubmit({
      drivetrain: drivetrain!,
      min_winter_range_mi: minWinterRange,
      fast_charge_kw: fastCharge!,
      towing: towing!,
      heat_pump: heatPump!,
      adas,
      interior: interior!,
      wheel_size: wheelSize!,
      winter_readiness: winterReadiness!,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Refine your shortlist</h2>
        <p className="text-gray-500 text-sm">
          9 quick questions on hardware and features. Takes about 2 minutes.
        </p>
      </div>

      {/* ── SECTION 1: MUST-HAVE SPECS ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 space-y-7">
        <SectionHeader
          number="1"
          title="Must-have specs"
          subtitle="These are hard requirements — we'll flag anything that doesn't measure up."
        />

        {/* Q1: Drivetrain */}
        <div>
          <QLabel>Do you need AWD?</QLabel>
          <div className="grid grid-cols-2 gap-2">
            <SelectionCard
              selected={drivetrain === "awd_required"}
              onClick={() => setDrivetrain("awd_required")}
              label="AWD required"
              desc="Non-negotiable — must handle snow or off-pavement"
            />
            <SelectionCard
              selected={drivetrain === "rwd_preferred"}
              onClick={() => setDrivetrain("rwd_preferred")}
              label="RWD preferred"
              desc="Performance-focused, but open to AWD"
            />
            <SelectionCard
              selected={drivetrain === "fwd_ok"}
              onClick={() => setDrivetrain("fwd_ok")}
              label="FWD is fine"
              desc="Mild roads, care more about efficiency"
            />
            <SelectionCard
              selected={drivetrain === "any"}
              onClick={() => setDrivetrain("any")}
              label="Any drivetrain"
              desc="No strong preference"
            />
          </div>
        </div>

        {/* Q2: Winter range floor */}
        <div>
          <QLabel>
            Minimum comfortable winter range:{" "}
            <span className="text-blue-600 font-semibold">{minWinterRange} mi</span>
          </QLabel>
          <input
            type="range"
            min={100}
            max={350}
            step={10}
            value={minWinterRange}
            onChange={(e) => setMinWinterRange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex gap-2 mt-3 flex-wrap">
            {[150, 200, 250, 300].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setMinWinterRange(val)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  minWinterRange === val
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {val} mi
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Real-world winter range is typically 20–30% below EPA. We compare against that.
          </p>
        </div>

        {/* Q3: Fast-charging speed */}
        <div>
          <QLabel>How important is fast-charging speed?</QLabel>
          <div className="space-y-2">
            <SelectionCard
              selected={fastCharge === "150plus"}
              onClick={() => setFastCharge("150plus")}
              label="Must have 150+ kW DC"
              desc="Regular road trips — I can't wait 45 min at a charger"
            />
            <SelectionCard
              selected={fastCharge === "100_150"}
              onClick={() => setFastCharge("100_150")}
              label="100–150 kW is enough"
              desc="Occasional highway trips, comfortable with 30–40 min stops"
            />
            <SelectionCard
              selected={fastCharge === "l2_primary"}
              onClick={() => setFastCharge("l2_primary")}
              label="Level 2 is my primary method"
              desc="I mostly charge at home or work — DC speed rarely matters"
            />
          </div>
        </div>

        {/* Q4: Towing */}
        <div>
          <QLabel>Do you need to tow or haul heavy loads?</QLabel>
          <div className="grid grid-cols-3 gap-2">
            <SelectionCard
              selected={towing === "regularly"}
              onClick={() => setTowing("regularly")}
              label="Yes, regularly"
              desc="Trailer, boat, or heavy cargo routinely"
            />
            <SelectionCard
              selected={towing === "occasionally"}
              onClick={() => setTowing("occasionally")}
              label="Occasionally"
              desc="A few times a year"
            />
            <SelectionCard
              selected={towing === "rarely"}
              onClick={() => setTowing("rarely")}
              label="Rarely/never"
              desc="Not a real need"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: ACCESSORIES & COMFORT ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-7">
        <SectionHeader
          number="2"
          title="Accessories & comfort"
          subtitle="These add bonus points to vehicles that match — they won't eliminate anyone."
        />

        {/* Q5: Heat pump */}
        <div>
          <QLabel>How important is a heat pump?</QLabel>
          <div className="grid grid-cols-3 gap-2">
            <SelectionCard
              selected={heatPump === "must_have"}
              onClick={() => setHeatPump("must_have")}
              label="Must have"
              desc="Cold winters — I want maximum range efficiency"
            />
            <SelectionCard
              selected={heatPump === "nice_to_have"}
              onClick={() => setHeatPump("nice_to_have")}
              label="Nice to have"
              desc="Would prefer it but won't make or break"
            />
            <SelectionCard
              selected={heatPump === "not_important"}
              onClick={() => setHeatPump("not_important")}
              label="Not important"
              desc="Mild climate or don't care"
            />
          </div>
        </div>

        {/* Q6: Driver assistance (multi-select) */}
        <div>
          <QLabel>Driver assistance features — pick what matters:</QLabel>
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={adas.includes("full_adas")}
              onClick={() => toggleAdas("full_adas")}
              label="Full ADAS (adaptive cruise, lane keeping)"
            />
            <Chip
              selected={adas.includes("basic_cruise_lane")}
              onClick={() => toggleAdas("basic_cruise_lane")}
              label="Basic cruise + lane assist"
            />
            <Chip
              selected={adas.includes("none")}
              onClick={() => toggleAdas("none")}
              label="Don't care about ADAS"
            />
          </div>
        </div>

        {/* Q7: Interior & tech */}
        <div>
          <QLabel>Interior and tech preference?</QLabel>
          <div className="grid grid-cols-1 gap-2">
            <SelectionCard
              selected={interior === "premium_touchscreen"}
              onClick={() => setInterior("premium_touchscreen")}
              label="Large touchscreen + premium feel"
              desc="I want a tech-forward, well-appointed cabin"
            />
            <SelectionCard
              selected={interior === "simple_interface"}
              onClick={() => setInterior("simple_interface")}
              label="Simple, physical controls"
              desc="Less screen clutter, easier to use while driving"
            />
            <SelectionCard
              selected={interior === "any"}
              onClick={() => setInterior("any")}
              label="No strong preference"
              desc="Interior won't tip the decision"
            />
          </div>
        </div>

        {/* Q8: Wheel size */}
        <div>
          <QLabel>What&apos;s your priority with wheel size?</QLabel>
          <div className="grid grid-cols-1 gap-2">
            <SelectionCard
              selected={wheelSize === "smaller_efficiency"}
              onClick={() => setWheelSize("smaller_efficiency")}
              label="Smaller wheels, better efficiency"
              desc="Prioritise real-world range over looks"
            />
            <SelectionCard
              selected={wheelSize === "18_19_fine"}
              onClick={() => setWheelSize("18_19_fine")}
              label="18-19in is fine"
              desc="Good balance of range and ride quality"
            />
            <SelectionCard
              selected={wheelSize === "style_matters"}
              onClick={() => setWheelSize("style_matters")}
              label="Style matters, I'll accept the range hit"
              desc="Larger alloys for the look, okay with slightly less range"
            />
          </div>
        </div>

        {/* Q9: Winter readiness */}
        <div>
          <QLabel>Winter driving readiness?</QLabel>
          <div className="grid grid-cols-1 gap-2">
            <SelectionCard
              selected={winterReadiness === "awd_dedicated_tires"}
              onClick={() => setWinterReadiness("awd_dedicated_tires")}
              label="AWD + dedicated winter tires"
              desc="Serious snow — I want every advantage"
            />
            <SelectionCard
              selected={winterReadiness === "all_season_ok"}
              onClick={() => setWinterReadiness("all_season_ok")}
              label="All-seasons are fine"
              desc="Light to moderate winter conditions"
            />
            <SelectionCard
              selected={winterReadiness === "mild_climate"}
              onClick={() => setWinterReadiness("mild_climate")}
              label="Mild climate — not a concern"
              desc="Rarely or never deal with snow or ice"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 pb-8">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          Skip — keep my current results
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isComplete}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            isComplete
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Apply to shortlist
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
