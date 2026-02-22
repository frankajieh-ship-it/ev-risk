"use client";

import type { Region } from "@/lib/region";

interface RegionSelectorProps {
  region: Region;
  onChange: (region: Region) => void;
}

const OPTIONS: { value: Region; label: string; flag: string }[] = [
  { value: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}" },
  { value: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
];

export default function RegionSelector({ region, onChange }: RegionSelectorProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
      {OPTIONS.map((opt) => {
        const active = region === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{opt.flag}</span>
            <span>{opt.label}</span>
            {opt.value === "UK" && active && (
              <span className="text-[10px] text-gray-400 font-normal">(beta)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
