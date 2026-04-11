"use client";

/**
 * SampleVerdictBlock — Static marketing teaser
 *
 * Shows a mock YELLOW verdict for a 2022 Tesla Model 3 LR to
 * demonstrate what the receipt analysis looks like before the
 * user pastes their own listing.
 */

import { AlertTriangle, HelpCircle } from "lucide-react";

export default function SampleVerdictBlock() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.05] overflow-hidden">
      {/* Mock verdict banner */}
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-yellow-300">
              YELLOW — Proceed with Caution
            </p>
            <p className="text-xs text-yellow-400/70 mt-0.5">
              2022 Tesla Model 3 Long Range · $28,500 · 47,000 mi
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Sample risk flags */}
        <div>
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
            Risk Flags
          </h4>
          <ul className="space-y-2">
            {[
              "No service records provided — request maintenance history before buying",
              "Price is 12% below market average for this model and mileage",
              "47k miles is above average for a 2022 — check for fleet or rideshare use",
            ].map((flag) => (
              <li key={flag} className="flex items-start gap-2 text-sm text-white/70">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                {flag}
              </li>
            ))}
          </ul>
        </div>

        {/* Sample must-ask questions */}
        <div>
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
            Must-Ask Questions
          </h4>
          <ul className="space-y-2">
            {[
              "Can you provide the full service history or Carfax report?",
              "Was this vehicle ever used for rideshare, rental, or fleet purposes?",
            ].map((q) => (
              <li key={q} className="flex items-start gap-2 text-sm text-white/70">
                <HelpCircle className="w-4 h-4 text-[#00d97e]/70 flex-shrink-0 mt-0.5" />
                {q}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Blurred teaser overlay */}
      <div className="relative">
        <div className="p-5 pt-0 space-y-3 blur-sm select-none" aria-hidden="true">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded w-full" />
          <div className="h-4 bg-white/10 rounded w-5/6" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/60">
          <p className="text-sm font-semibold text-white text-center px-4">
            Paste your listing above to unlock the full analysis
          </p>
        </div>
      </div>
    </div>
  );
}
