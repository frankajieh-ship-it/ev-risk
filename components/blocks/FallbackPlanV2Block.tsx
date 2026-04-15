"use client";

import type { FallbackPlan } from "@/types/v2-contract";

interface FallbackPlanV2BlockProps {
  fallbackPlan: FallbackPlan;
}

export function FallbackPlanV2Block({ fallbackPlan }: FallbackPlanV2BlockProps) {
  // Backward compat: old saved reports may have "anchor" instead of "primary"
  const primaryText = fallbackPlan.primary ?? (fallbackPlan as unknown as Record<string, string>).anchor ?? "";

  return (
    <div className="p-5 bg-white/[0.05] rounded-xl border border-white/10 space-y-4">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
        Your Fallback Plan
      </h3>

      <div className="space-y-3">
        {/* Primary plan */}
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00d97e]/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#00d97e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium text-white/40 uppercase">Your plan</p>
            <p className="text-sm text-white/80">{primaryText}</p>
          </div>
        </div>

        {/* Backup */}
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium text-white/40 uppercase">When it breaks</p>
            <p className="text-sm text-white/80">{fallbackPlan.backup}</p>
          </div>
        </div>

        {/* Trigger */}
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-medium text-white/40 uppercase">What causes it</p>
            <p className="text-sm text-white/80">{fallbackPlan.trigger}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
