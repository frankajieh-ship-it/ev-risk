"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import type { MinimumViableRoutine } from "@/types/v2";

interface EVMatchFilterPanelProps {
  routine: MinimumViableRoutine;
  /** Called on any filter change — consumer re-fetches recommendations */
  onChange: (updated: MinimumViableRoutine) => void;
}

type Section = "ownership" | "driving" | "utility" | "priorities" | "preferences";

type PriorityKey = "range" | "charging" | "cost" | "reliability" | "interior" | "tech";

const PRIORITY_OPTIONS: Array<{ key: PriorityKey; label: string; desc: string }> = [
  { key: "range",       label: "Max range",          desc: "Never worry about distance" },
  { key: "charging",    label: "Low charging hassle", desc: "Simple, predictable charging" },
  { key: "cost",        label: "Lowest cost",         desc: "Purchase price + running costs" },
  { key: "reliability", label: "Reliability",         desc: "Fewest repairs over time" },
  { key: "interior",    label: "Interior quality",    desc: "Comfort and refinement" },
  { key: "tech",        label: "Tech features",       desc: "Driver assistance, displays" },
];

function Card({
  selected, onClick, label, desc,
}: { selected: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative p-3 rounded-lg border text-left transition-all text-sm ${
        selected
          ? "border-[#00d97e] bg-[#00d97e]/10 text-white"
          : "border-white/[0.08] bg-[#161b22] text-white/60 hover:border-white/20"
      }`}
    >
      <div className="font-medium">{label}</div>
      {desc && <div className="text-xs mt-0.5 opacity-70">{desc}</div>}
    </button>
  );
}

function SectionHeader({
  id, title, openSections, onToggle,
}: { id: Section; title: string; openSections: Set<Section>; onToggle: (s: Section) => void }) {
  return (
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors"
    >
      {title}
      {openSections.has(id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );
}

export default function EVMatchFilterPanel({ routine, onChange }: EVMatchFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(["ownership"]));

  const toggleSection = useCallback((s: Section) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) { next.delete(s); } else { next.add(s); }
      return next;
    }), []);

  const update = useCallback(
    (patch: Partial<MinimumViableRoutine>) => onChange({ ...routine, ...patch }),
    [routine, onChange]
  );

  const togglePriority = useCallback((key: NonNullable<MinimumViableRoutine["priority_weights"]>[number]) => {
    const current = routine.priority_weights ?? [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : current.length < 3
        ? [...current, key]
        : current;
    update({ priority_weights: next.length > 0 ? next : undefined });
  }, [routine.priority_weights, update]);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4 text-[#00d97e]" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Refine your results</div>
          <div className="text-xs text-white/40">Get a more accurate match — answer a few more questions</div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-1 border-t border-white/[0.06]">

          {/* Ownership Context */}
          <SectionHeader id="ownership" title="Ownership context" openSections={openSections} onToggle={toggleSection} />
          {openSections.has("ownership") && (
            <div className="space-y-4 pb-4">

              {/* EV experience */}
              <div>
                <p className="text-xs text-white/50 mb-2">First EV or upgrading?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "first_time" as const, label: "First EV", desc: "Brand new to EVs" },
                    { v: "researching" as const, label: "Researching", desc: "Comparing options" },
                    { v: "experienced" as const, label: "Upgrading", desc: "Already own one" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.ev_experience === opt.v}
                      onClick={() => update({ ev_experience: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* New vs used */}
              <div>
                <p className="text-xs text-white/50 mb-2">New, certified used, or either?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "new" as const, label: "New", desc: "Factory warranty" },
                    { v: "used" as const, label: "Used / CPO", desc: "Lower upfront cost" },
                    { v: "any" as const, label: "Either", desc: "Open to both" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.vehicle_condition === opt.v}
                      onClick={() => update({ vehicle_condition: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Backup vehicle */}
              <div>
                <p className="text-xs text-white/50 mb-2">Do you have a backup vehicle?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "yes_daily" as const, label: "Yes — daily", desc: "Always available" },
                    { v: "yes_rarely" as const, label: "Yes — rarely", desc: "For emergencies" },
                    { v: "no" as const, label: "No", desc: "EV is my only car" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.has_backup_vehicle === opt.v}
                      onClick={() => update({ has_backup_vehicle: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Ownership timeline */}
              <div>
                <p className="text-xs text-white/50 mb-2">How long will you keep it?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "lease_1_3" as const, label: "Lease (1–3 yr)", desc: "Short commitment" },
                    { v: "medium_3_5" as const, label: "3–5 years", desc: "Mid-term" },
                    { v: "long_5_plus" as const, label: "5+ years", desc: "Long-term owner" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.ownership_timeline === opt.v}
                      onClick={() => update({ ownership_timeline: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Driving Behavior */}
          <div className="border-t border-white/[0.06] pt-1">
            <SectionHeader id="driving" title="Driving behavior" openSections={openSections} onToggle={toggleSection} />
          </div>
          {openSections.has("driving") && (
            <div className="space-y-4 pb-4">

              {/* Routine pattern */}
              <div>
                <p className="text-xs text-white/50 mb-2">Mostly city, highway, or mixed?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "LOCAL" as const, label: "City / local", desc: "Short, slow trips" },
                    { v: "MIXED" as const, label: "Mixed", desc: "Variety of trips" },
                    { v: "MOTORWAY_HEAVY" as const, label: "Highway", desc: "Lots of high-speed" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.routine_pattern === opt.v}
                      onClick={() => update({ routine_pattern: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Charging stop tolerance */}
              <div>
                <p className="text-xs text-white/50 mb-2">Willing to stop 20–30 min on long trips?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "ok" as const, label: "No problem", desc: "Happy to stop" },
                    { v: "prefer_limit" as const, label: "Prefer to limit", desc: "Occasional stops OK" },
                    { v: "rather_not" as const, label: "Rather not", desc: "Minimal stops only" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.charging_stop_tolerance === opt.v}
                      onClick={() => update({ charging_stop_tolerance: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Parking exposure */}
              <div>
                <p className="text-xs text-white/50 mb-2">Where do you usually park at home?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "garage" as const, label: "Garage", desc: "Protected parking" },
                    { v: "outdoor" as const, label: "Driveway", desc: "Exposed to weather" },
                    { v: "street" as const, label: "Street", desc: "No dedicated spot" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.parking_exposure === opt.v}
                      onClick={() => update({ parking_exposure: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Utility Needs */}
          <div className="border-t border-white/[0.06] pt-1">
            <SectionHeader id="utility" title="Utility needs" openSections={openSections} onToggle={toggleSection} />
          </div>
          {openSections.has("utility") && (
            <div className="space-y-4 pb-4">

              {/* Towing */}
              <div>
                <p className="text-xs text-white/50 mb-2">Do you tow anything?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "none" as const, label: "No towing", desc: "" },
                    { v: "light" as const, label: "Light (bike rack, trailer)", desc: "" },
                    { v: "heavy" as const, label: "Heavy (boat, 5th wheel)", desc: "" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={routine.towing_needs === opt.v}
                      onClick={() => update({ towing_needs: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Passenger count */}
              <div>
                <p className="text-xs text-white/50 mb-2">Seats needed regularly?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 4, 5, 7].map((n) => (
                    <Card
                      key={n}
                      selected={routine.passenger_count === n}
                      onClick={() => update({ passenger_count: n })}
                      label={`${n}`}
                      desc={n === 7 ? "3-row SUV" : n === 2 ? "Just me" : `${n} people`}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Vehicle Preferences */}
          <div className="border-t border-white/[0.06] pt-1">
            <SectionHeader id="preferences" title="Vehicle preferences" openSections={openSections} onToggle={toggleSection} />
          </div>
          {openSections.has("preferences") && (
            <div className="space-y-4 pb-4">

              {/* Budget max */}
              <div>
                <p className="text-xs text-white/50 mb-2">Max purchase price</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: undefined, label: "Any" },
                    { v: 30000,     label: "$30k" },
                    { v: 40000,     label: "$40k" },
                    { v: 50000,     label: "$50k" },
                    { v: 60000,     label: "$60k" },
                    { v: 75000,     label: "$75k" },
                  ] as Array<{ v: number | undefined; label: string }>).map((opt) => (
                    <Card
                      key={String(opt.v)}
                      selected={(routine.budget_max_usd ?? undefined) === opt.v}
                      onClick={() => update({ budget_max_usd: opt.v })}
                      label={opt.label}
                      desc=""
                    />
                  ))}
                </div>
              </div>

              {/* Max mileage */}
              <div>
                <p className="text-xs text-white/50 mb-2">Max listing mileage</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: undefined, label: "Any" },
                    { v: 30000,     label: "30k mi" },
                    { v: 60000,     label: "60k mi" },
                    { v: 80000,     label: "80k mi" },
                    { v: 100000,    label: "100k mi" },
                  ] as Array<{ v: number | undefined; label: string }>).map((opt) => (
                    <Card
                      key={String(opt.v)}
                      selected={(routine.max_mileage ?? undefined) === opt.v}
                      onClick={() => update({ max_mileage: opt.v })}
                      label={opt.label}
                      desc=""
                    />
                  ))}
                </div>
              </div>

              {/* Drivetrain */}
              <div>
                <p className="text-xs text-white/50 mb-2">Drivetrain</p>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { v: "any" as const, label: "Any" },
                    { v: "awd" as const, label: "AWD" },
                    { v: "rwd" as const, label: "RWD" },
                    { v: "fwd" as const, label: "FWD" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={(routine.preferred_drivetrain ?? "any") === opt.v}
                      onClick={() => update({
                        preferred_drivetrain: opt.v === "any" ? undefined : opt.v,
                        require_awd: opt.v === "awd" ? true : undefined,
                      })}
                      label={opt.label}
                      desc=""
                    />
                  ))}
                </div>
              </div>

              {/* Body style */}
              <div>
                <p className="text-xs text-white/50 mb-2">Body style</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "any" as const,       label: "Any",       desc: "" },
                    { v: "suv" as const,        label: "SUV",       desc: "Crossover or SUV" },
                    { v: "sedan" as const,      label: "Sedan",     desc: "Car-like profile" },
                    { v: "hatchback" as const,  label: "Hatchback", desc: "Compact, practical" },
                    { v: "truck" as const,      label: "Truck",     desc: "Pickup bed" },
                    { v: "van" as const,        label: "Van",       desc: "Minivan or cargo" },
                  ]).map((opt) => (
                    <Card
                      key={opt.v}
                      selected={(routine.preferred_body_type ?? "any") === opt.v}
                      onClick={() => update({ preferred_body_type: opt.v === "any" ? undefined : opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Minimum seating */}
              <div>
                <p className="text-xs text-white/50 mb-2">Minimum seats needed</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: undefined, label: "Any",  desc: "" },
                    { v: 5,         label: "5",    desc: "Standard" },
                    { v: 7,         label: "7",    desc: "3-row or config" },
                  ] as Array<{ v: number | undefined; label: string; desc: string }>).map((opt) => (
                    <Card
                      key={String(opt.v)}
                      selected={(routine.min_seating ?? undefined) === opt.v}
                      onClick={() => update({ min_seating: opt.v })}
                      label={opt.label}
                      desc={opt.desc}
                    />
                  ))}
                </div>
              </div>

              {/* Must-have features */}
              <div>
                <p className="text-xs text-white/50 mb-2">Must-have features</p>
                <div className="flex flex-col gap-2">
                  {([
                    { key: "require_heat_pump" as const, label: "Heat pump", desc: "Better cold-weather efficiency" },
                    { key: "require_awd" as const,       label: "AWD / 4WD",   desc: "All-weather traction" },
                  ]).map((feat) => {
                    const active = !!routine[feat.key];
                    return (
                      <button
                        key={feat.key}
                        onClick={() => update({ [feat.key]: active ? undefined : true })}
                        aria-pressed={active}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${
                          active
                            ? "border-[#00d97e] bg-[#00d97e]/10 text-white"
                            : "border-white/[0.08] bg-[#161b22] text-white/60 hover:border-white/20"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${active ? "bg-[#00d97e] border-[#00d97e]" : "border-white/30"}`}>
                          {active && <span className="text-[#0d1117] text-xs font-bold">✓</span>}
                        </div>
                        <div>
                          <div className="font-medium">{feat.label}</div>
                          <div className="text-xs opacity-70">{feat.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* Priorities */}
          <div className="border-t border-white/[0.06] pt-1">
            <SectionHeader id="priorities" title="What matters most to you?" openSections={openSections} onToggle={toggleSection} />
          </div>
          {openSections.has("priorities") && (
            <div className="pb-4">
              <p className="text-xs text-white/50 mb-3">Pick up to 3 — shapes tie-breaking in results.</p>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_OPTIONS.map((opt) => {
                  const selected = (routine.priority_weights ?? []).includes(opt.key);
                  const atMax = !selected && (routine.priority_weights ?? []).length >= 3;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => !atMax && togglePriority(opt.key)}
                      aria-pressed={selected}
                      disabled={atMax}
                      className={`p-3 rounded-lg border text-left text-sm transition-all ${
                        selected
                          ? "border-[#00d97e] bg-[#00d97e]/10 text-white"
                          : atMax
                            ? "border-white/[0.04] bg-[#161b22]/50 text-white/25 cursor-not-allowed"
                            : "border-white/[0.08] bg-[#161b22] text-white/60 hover:border-white/20"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              {(routine.priority_weights ?? []).length > 0 && (
                <button
                  onClick={() => update({ priority_weights: undefined })}
                  className="mt-2 text-xs text-white/30 hover:text-white/60 underline underline-offset-2 transition-colors"
                >
                  Clear priorities
                </button>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
