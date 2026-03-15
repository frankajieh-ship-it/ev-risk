"use client";

import type { StressFlagContract } from "@/types/v2-contract";

interface StressFlagsV2BlockProps {
  flags: StressFlagContract[];
}

export function StressFlagsV2Block({ flags }: StressFlagsV2BlockProps) {
  if (flags.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Things to keep in mind
      </h3>
      {flags.map((flag, i) => (
        <div
          key={i}
          className="p-4 bg-white rounded-xl border border-gray-100 space-y-1"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? "bg-red-500" : "bg-yellow-500"}`} />
            <p className="text-sm font-semibold text-gray-900">{flag.title}</p>
          </div>
          <p className="text-xs text-gray-500 italic pl-4">
            {flag.because}
          </p>
          <p className="text-xs text-gray-600 pl-4">
            When it hits: {flag.impact}
          </p>
        </div>
      ))}
    </div>
  );
}
