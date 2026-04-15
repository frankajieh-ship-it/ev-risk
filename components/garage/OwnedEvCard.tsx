"use client";

import Link from "next/link";
import { Loader2, ShieldCheck, TrendingUp, ExternalLink } from "lucide-react";

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

const SCORE_STYLE: Record<string, { accent: string; bg: string; border: string }> = {
  "Great Fit":    { accent: "text-[#00d97e]", bg: "bg-[#00d97e]/15", border: "border-[#00d97e]/30" },
  "Good Fit":     { accent: "text-blue-400",   bg: "bg-blue-500/15",  border: "border-blue-500/30"  },
  "Mixed Fit":    { accent: "text-amber-400",  bg: "bg-amber-500/15", border: "border-amber-500/30" },
  "High Friction":{ accent: "text-red-400",    bg: "bg-red-500/15",   border: "border-red-500/30"   },
};

export default function OwnedEvCard({
  vehicleId, make, model, year, trim, vinRedacted,
  routineHealth, reportLoading, sellersReportUnlocked, onGenerateReport,
}: OwnedEvCardProps) {
  const style = routineHealth
    ? (SCORE_STYLE[routineHealth.label] ?? SCORE_STYLE["Mixed Fit"])
    : null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
            Owned
          </span>
          <p className="text-sm font-bold text-white mt-1">
            {year} {make} {model}{trim ? ` ${trim}` : ""}
          </p>
          {vinRedacted && (
            <p className="text-xs text-white/30 font-mono">VIN: {vinRedacted}</p>
          )}
        </div>

        {routineHealth && style && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border ${style.bg} ${style.border}`}>
            <TrendingUp className={`w-3.5 h-3.5 ${style.accent}`} />
            <span className={`text-sm font-bold ${style.accent}`}>{routineHealth.score}</span>
            <span className={`text-xs ${style.accent} opacity-60`}>/100</span>
          </div>
        )}
      </div>

      {/* Report summary */}
      {routineHealth && style && (
        <div className="text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5">
          <p className={`font-semibold mb-0.5 ${style.accent}`}>{routineHealth.label}</p>
          <p className="text-white/50 leading-relaxed">{routineHealth.headline}</p>
          {routineHealth.watch_area && (
            <p className="mt-1.5 text-amber-400/80">
              <span className="font-medium">Watch: </span>{routineHealth.watch_area}
            </p>
          )}
        </div>
      )}

      {!routineHealth && !reportLoading && (
        <p className="text-xs text-white/35 leading-relaxed">
          Generate your free Routine Health Report to see how this EV fits your driving pattern.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto">
        {routineHealth ? (
          <Link
            href={`/workspace/garage/${vehicleId}/owned-ev`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-white/[0.06] text-white/70 hover:bg-white/[0.10] hover:text-white border border-white/[0.08] transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            View Report
          </Link>
        ) : (
          <button
            onClick={onGenerateReport}
            disabled={reportLoading}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {reportLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating&hellip;</>
            ) : (
              <><TrendingUp className="w-3.5 h-3.5" /> Generate Free Report</>
            )}
          </button>
        )}

        {sellersReportUnlocked ? (
          <Link
            href={`/workspace/garage/${vehicleId}/owned-ev?tab=sellers`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-[#00d97e]/15 text-[#00d97e] hover:bg-[#00d97e]/25 border border-[#00d97e]/30 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            View Sellers Report
          </Link>
        ) : (
          <Link
            href={`/workspace/garage/${vehicleId}/owned-ev`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium text-white/35 hover:text-white/60 border border-dashed border-white/[0.12] hover:border-white/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Generate Sellers Report &mdash; $9.99
          </Link>
        )}
      </div>
    </div>
  );
}
