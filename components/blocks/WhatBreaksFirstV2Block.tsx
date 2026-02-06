"use client";

import type { WhatBreaksFirst } from "@/types/v2";

interface WhatBreaksFirstV2BlockProps {
  whatBreaksFirst: WhatBreaksFirst;
}

export function WhatBreaksFirstV2Block({ whatBreaksFirst }: WhatBreaksFirstV2BlockProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        What breaks first
      </h3>

      <div className="space-y-3">
        {/* Primary */}
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg mt-0.5">1</span>
            <div>
              <p className="font-semibold text-gray-900">{whatBreaksFirst.primary}</p>
              <p className="text-sm text-gray-500 mt-1 italic">
                {whatBreaksFirst.primary_citation}
              </p>
            </div>
          </div>
        </div>

        {/* Secondary */}
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-start gap-3">
            <span className="text-yellow-500 text-lg mt-0.5">2</span>
            <div>
              <p className="font-semibold text-gray-900">{whatBreaksFirst.secondary}</p>
              <p className="text-sm text-gray-500 mt-1 italic">
                {whatBreaksFirst.secondary_citation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
