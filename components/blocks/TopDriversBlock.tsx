"use client";

import { TrendingUp } from "lucide-react";

interface TopDriversBlockProps {
  drivers: string[];
}

export function TopDriversBlock({ drivers }: TopDriversBlockProps) {
  if (drivers.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-900">Top Drivers</h3>
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
