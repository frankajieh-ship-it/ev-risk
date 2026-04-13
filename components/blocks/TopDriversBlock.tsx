"use client";

import { TrendingUp } from "lucide-react";

interface TopDriversBlockProps {
  drivers: string[];
}

export function TopDriversBlock({ drivers }: TopDriversBlockProps) {
  if (drivers.length === 0) return null;

  return (
    <div className="bg-[var(--surface-1)] rounded-xl p-5 border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Top Drivers</h3>
      </div>
      <ul className="space-y-2">
        {drivers.map((driver, idx) => (
          <li key={idx} className="text-sm text-gray-700">
            {driver}
          </li>
        ))}
      </ul>
    </div>
  );
}
