/**
 * CompareBadge — Compare action button
 *
 * Free with login: shows "Compare with another listing" when authenticated.
 * Falls back to paid compare credit display for legacy purchases.
 * Shows "Sign in to Compare" when not authenticated.
 */

"use client";

import { GitCompare, Check, Eye, LogIn } from "lucide-react";

interface CompareBadgeProps {
  compareRemaining?: number;
  compareBoundTo?: string | null;
  isAuthenticated?: boolean;
  onInitiateCompare?: () => void;
  onViewCompare?: () => void;
  onSignIn?: () => void;
}

export default function CompareBadge({
  compareRemaining = 0,
  compareBoundTo,
  isAuthenticated = false,
  onInitiateCompare,
  onViewCompare,
  onSignIn,
}: CompareBadgeProps) {
  // If there's a bound comparison from paid flow, show view button
  if (compareBoundTo && onViewCompare) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/[0.05] rounded-xl border border-white/[0.08]">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/60 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-[#00d97e]" />
            Comparison ready
          </span>
        </div>
        <button
          onClick={onViewCompare}
          className="flex items-center gap-1 text-xs font-medium text-[#00d97e] hover:text-[#00c970] px-3 py-1.5 rounded-lg border border-[#00d97e]/30 hover:bg-[#00d97e]/10 transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
          View Comparison
        </button>
      </div>
    );
  }

  // Legacy paid compare credit available
  if (compareRemaining > 0 && onInitiateCompare) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/[0.05] rounded-xl border border-white/[0.08]">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/70">
            Compare credit:{" "}
            <span className="font-medium text-[#00d97e]">
              {compareRemaining} available
            </span>
          </span>
        </div>
        <button
          onClick={onInitiateCompare}
          className="text-xs font-medium text-[#00d97e] hover:text-[#00c970] px-3 py-1.5 rounded-lg border border-[#00d97e]/30 hover:bg-[#00d97e]/10 transition-all"
        >
          Use Compare Credit
        </button>
      </div>
    );
  }

  // Free compare — authenticated
  if (isAuthenticated && onInitiateCompare) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/[0.05] rounded-xl border border-white/[0.08]">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/60">
            Compare with another listing
          </span>
        </div>
        <button
          onClick={onInitiateCompare}
          className="text-xs font-medium text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.12] hover:bg-white/[0.06] transition-all"
        >
          Compare
        </button>
      </div>
    );
  }

  // Not authenticated — show sign in prompt
  if (!isAuthenticated && onSignIn) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/[0.05] rounded-xl border border-white/[0.08]">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-white/30" />
          <span className="text-sm text-white/40">
            Compare with another listing
          </span>
        </div>
        <button
          onClick={onSignIn}
          className="flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.12] hover:bg-white/[0.06] transition-all"
        >
          <LogIn className="w-3.5 h-3.5" />
          Sign in
        </button>
      </div>
    );
  }

  return null;
}
