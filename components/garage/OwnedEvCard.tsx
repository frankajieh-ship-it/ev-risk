"use client";

/**
 * OwnedEvCard
 *
 * Displays a single owned EV in My Garage with:
 * - Routine health score badge
 * - Generate/refresh report button
 * - Sellers Report upsell (locked/unlocked)
 */

import Link from "next/link";
import { Loader2, FileText, ExternalLink, ShieldCheck, TrendingUp } from "lucide-react";

interface RoutineHealth {
  score: number;
  label: string;
  headline: string;
  watch_area: string | null;
}

interface OwnedEvCardProps {
  vehicleId: string;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  vinRedacted: string | null;
  routineHealth: RoutineHealth | null;
  reportLoading: boolean;
  sellersReportUnlocked: boolean;
  onGenerateReport: () => void;
}

const SCORE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Great Fit":    { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  "Good Fit":     { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200"  },
  "Mixed Fit":    { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  "High Friction":{ bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"   },
};

export default function OwnedEvCard({
  vehicleId,
  make,
  model,
  year,
  trim,
  vinRedacted,
  routineHealth,
  reportLoading,
  sellersReportUnlocked,
  onGenerateReport,
}: OwnedEvCardProps) {
  const colors = routineHealth
    ? (SCORE_COLORS[routineHealth.label] ?? SCORE_COLORS["Mixed Fit"])
    : null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white shadow-sm p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              My Car
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {year} {make} {model}{trim ? ` ${trim}` : ""}
          </p>
          {vinRedacted && (
            <p className="text-xs text-gray-400 font-mono">VIN: {vinRedacted}</p>
          )}
        </div>

        {routineHealth && colors && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border ${colors.bg} ${colors.border}`}>
            <TrendingUp className={`w-3.5 h-3.5 ${colors.text}`} />
            <span className={`text-sm font-bold ${colors.text}`}>{routineHealth.score}</span>
            <span className={`text-xs ${colors.text} opacity-70`}>/100</span>
          </div>
        )}
      </div>

      {/* Report summary */}
      {routineHealth && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          <p className="font-medium text-gray-800 mb-0.5">{routineHealth.label}</p>
          <p className="text-gray-500 leading-relaxed">{routineHealth.headline}</p>
          {routineHealth.watch_area && (
            <p className="mt-1 text-amber-700">
              <span className="font-medium">Watch: </span>{routineHealth.watch_area}
            </p>
          )}
        </div>
      )}

      {!routineHealth && !reportLoading && (
        <p className="text-xs text-gray-400">
          Generate your free Routine Health Report to see how this EV fits your driving pattern.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto">
        {routineHealth ? (
          <Link
            href={`/workspace/garage/${vehicleId}/owned-ev`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            View Report
          </Link>
        ) : (
          <button
            onClick={onGenerateReport}
            disabled={reportLoading}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {reportLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
            ) : (
              <><TrendingUp className="w-3.5 h-3.5" /> Generate Free Report</>
            )}
          </button>
        )}

        {sellersReportUnlocked ? (
          <Link
            href={`/workspace/garage/${vehicleId}/owned-ev?tab=sellers`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            View Sellers Report
          </Link>
        ) : (
          <Link
            href={`/workspace/garage/${vehicleId}/owned-ev`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Generate Sellers Report — $9.99
          </Link>
        )}
      </div>
    </div>
  );
}
