"use client";

import { AlertTriangle } from "lucide-react";

interface WhatBreaksFirstBlockProps {
  items: string[];
}

export function WhatBreaksFirstBlock({ items }: WhatBreaksFirstBlockProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-gray-900">What Breaks First</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 text-sm text-gray-700"
          >
            <span className="text-orange-500 mt-0.5 flex-shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
