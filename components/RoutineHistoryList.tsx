"use client";

import { motion } from "framer-motion";
import { Clock, AlertTriangle, ChevronRight } from "lucide-react";

export interface RoutineHistoryEntry {
  id: string;
  created_at: string;
  fit_label: string;
  friction_score: number;
  break_first_reason: string | null;
  stress_level: string;
  scenario_name: string | null;
  inputs_json: {
    routine?: { charging_access?: string; climate?: string };
    vehicle?: { year?: number; make?: string; model?: string };
  };
}

interface RoutineHistoryListProps {
  runs: RoutineHistoryEntry[];
  onSelect: (run: RoutineHistoryEntry) => void;
  totalCount: number;
  maxFree?: number;
  isUnlocked: boolean;
}

const FIT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Great Fit":    { bg: "bg-[#00d97e]/10", text: "text-[#00d97e]",  border: "border-[#00d97e]/20" },
  "Good Fit":     { bg: "bg-blue-500/10",  text: "text-blue-400",   border: "border-blue-500/20" },
  "Mixed Fit":    { bg: "bg-amber-500/10", text: "text-amber-400",  border: "border-amber-500/20" },
  "High Friction":{ bg: "bg-red-500/10",   text: "text-red-400",    border: "border-red-500/20" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function RoutineHistoryList({
  runs,
  onSelect,
}: RoutineHistoryListProps) {
  if (runs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          Your Scenarios
        </h2>
      </div>

      <div className="space-y-2">
        {runs.map((run) => {
          const colors = FIT_COLORS[run.fit_label] || FIT_COLORS["Mixed Fit"];
          const vehicle = run.inputs_json?.vehicle;
          const vehicleLabel = vehicle
            ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
            : null;

          return (
            <button
              key={run.id}
              onClick={() => onSelect(run)}
              className="w-full flex items-center gap-3 p-3 bg-[#161b22] rounded-xl border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.03] transition-all text-left group"
            >
              {/* Score badge */}
              <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                {run.friction_score}
              </span>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white/80 truncate">
                    {run.scenario_name || run.fit_label}
                  </span>
                  {vehicleLabel && (
                    <span className="text-xs text-white/30 truncate hidden sm:inline">
                      {vehicleLabel}
                    </span>
                  )}
                </div>
                {run.break_first_reason && (
                  <span className="flex items-center gap-1 text-xs text-white/40 mt-0.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{run.break_first_reason}</span>
                  </span>
                )}
              </div>

              {/* Time + arrow */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-white/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(run.created_at)}
                </span>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
