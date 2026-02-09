"use client";

import type { FallbackPlan } from "@/types/v2-contract";

interface FallbackPlanV2BlockProps {
  fallbackPlan: FallbackPlan;
}

export function FallbackPlanV2Block({ fallbackPlan }: FallbackPlanV2BlockProps) {
  // Backward compat: old saved reports may have "anchor" instead of "primary"
  const primaryText = fallbackPlan.primary ?? (fallbackPlan as any).anchor ?? "";

  return (
    <div className="p-5 bg-white rounded-xl border border-gray-200 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Your Fallback Plan
      </h3>

      <div className="space-y-3">
        {/* Primary plan */}
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Your plan</p>
            <p className="text-sm text-gray-800">{primaryText}</p>
          </div>
        </div>

        {/* Backup */}
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">When it breaks</p>
            <p className="text-sm text-gray-800">{fallbackPlan.backup}</p>
          </div>
        </div>

        {/* Trigger */}
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">What causes it</p>
            <p className="text-sm text-gray-800">{fallbackPlan.trigger}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
