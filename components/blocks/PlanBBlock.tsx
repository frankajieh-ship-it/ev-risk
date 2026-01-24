"use client";

import { Lightbulb } from "lucide-react";

interface PlanBBlockProps {
  items: string[];
}

export function PlanBBlock({ items }: PlanBBlockProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-900">What This Means Practically</h3>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        If you want to make this work:
      </p>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 text-sm text-gray-700"
          >
            <span className="w-4 h-4 border border-blue-300 rounded flex-shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
