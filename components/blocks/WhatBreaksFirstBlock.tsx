"use client";

import { AlertTriangle } from "lucide-react";

interface WhatBreaksFirstBlockProps {
  items: string[];
}

export function WhatBreaksFirstBlock({ items }: WhatBreaksFirstBlockProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-[var(--surface-1)] rounded-xl p-5 border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">What Breaks First</h3>
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
