"use client";

/**
 * RefineStep — 6-question spec/accessory narrowing step
 *
 * Rendered inline inside VehicleRecommendations to narrow a full
 * recommendations list down to a Top 3. All filtering is client-side.
 */

import { useState } from "react";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

export interface RefinePrefs {
  budgetCeiling: 20000 | 30000 | 40000 | 50000 | null;
  priority: "friction" | "price" | "cargo" | null;
  seatCount: 2 | 5 | 7 | null;
  needsTow: boolean | null;
  brandPref: "any" | "us_only" | "no_tesla" | null;
  mustHave: "heated_seats" | "one_pedal" | "android_auto" | null;
}

interface RefineStepProps {
  onSubmit: (prefs: RefinePrefs) => void;
  onBack: () => void;
}

type ToggleValue = string | number | boolean | null;

function ToggleGroup<T extends ToggleValue>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
            value === opt.value
              ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]"
              : "bg-white/[0.05] text-white/60 border-white/[0.10] hover:border-[#00d97e]/40 hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function RefineStep({ onSubmit, onBack }: RefineStepProps) {
  const [prefs, setPrefs] = useState<RefinePrefs>({
    budgetCeiling: null,
    priority: null,
    seatCount: null,
    needsTow: null,
    brandPref: null,
    mustHave: null,
  });

  const set = <K extends keyof RefinePrefs>(key: K, value: RefinePrefs[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(prefs);
  };

  return (
    <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#00d97e]" />
          <h3 className="text-base font-semibold text-white">Narrow to your Top 3</h3>
        </div>
        <span className="ml-auto text-xs text-white/30">6 quick questions</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">Budget ceiling</label>
          <ToggleGroup
            options={[
              { label: "Under $20k", value: 20000 as const },
              { label: "Under $30k", value: 30000 as const },
              { label: "Under $40k", value: 40000 as const },
              { label: "$50k+",      value: 50000 as const },
            ]}
            value={prefs.budgetCeiling}
            onChange={(v) => set("budgetCeiling", v as RefinePrefs["budgetCeiling"])}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">What matters most to you?</label>
          <ToggleGroup
            options={[
              { label: "Least charging hassle", value: "friction" as const },
              { label: "Lowest price",          value: "price"   as const },
              { label: "Most cargo / space",    value: "cargo"   as const },
            ]}
            value={prefs.priority}
            onChange={(v) => set("priority", v as RefinePrefs["priority"])}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">Seat count needed</label>
          <ToggleGroup
            options={[
              { label: "2–4", value: 2 as const },
              { label: "5",   value: 5 as const },
              { label: "7+",  value: 7 as const },
            ]}
            value={prefs.seatCount}
            onChange={(v) => set("seatCount", v as RefinePrefs["seatCount"])}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">Need towing or heavy cargo capacity?</label>
          <ToggleGroup
            options={[
              { label: "Yes", value: true  },
              { label: "No",  value: false },
            ]}
            value={prefs.needsTow}
            onChange={(v) => set("needsTow", v as boolean)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">Brand preference</label>
          <ToggleGroup
            options={[
              { label: "Any brand",     value: "any"      as const },
              { label: "US brands only",value: "us_only"  as const },
              { label: "No Tesla",      value: "no_tesla" as const },
            ]}
            value={prefs.brandPref}
            onChange={(v) => set("brandPref", v as RefinePrefs["brandPref"])}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">Must-have feature (pick one)</label>
          <ToggleGroup
            options={[
              { label: "Heated seats",      value: "heated_seats"  as const },
              { label: "One-pedal driving", value: "one_pedal"     as const },
              { label: "Android Auto",      value: "android_auto"  as const },
              { label: "None",              value: null },
            ]}
            value={prefs.mustHave}
            onChange={(v) => set("mustHave", v as RefinePrefs["mustHave"])}
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-[#00d97e] text-[#0d1117] font-semibold rounded-xl hover:bg-[#00c970] transition-colors text-sm"
        >
          Show my Top 3 →
        </button>
      </form>
    </div>
  );
}
