"use client";

import { motion } from "framer-motion";
import { Clock, Zap, AlertTriangle, ChevronRight } from "lucide-react";

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
  "Great Fit": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  "Good Fit": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Mixed Fit": { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  "High Friction": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
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
  totalCount,
  maxFree = 3,
  isUnlocked,
}: RoutineHistoryListProps) {
  if (runs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Your Scenarios
        </h2>
        {!isUnlocked && (
          <span className="text-xs text-gray-500">
            {totalCount} of {maxFree} free used
          </span>
        )}
        {isUnlocked && (
          <span className="text-xs text-green-600 font-medium">Unlimited</span>
        )}
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
              className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all text-left group"
            >
              {/* Fit label badge */}
              <span className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                {run.friction_score}
              </span>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {run.scenario_name || run.fit_label}
                  </span>
                  {vehicleLabel && (
                    <span className="text-xs text-gray-400 truncate hidden sm:inline">
                      {vehicleLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {run.break_first_reason && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="truncate">{run.break_first_reason}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Time + arrow */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(run.created_at)}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
