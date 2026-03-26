/**
 * RecallPanel
 *
 * Slide-in panel from the right showing recall detail for one garage vehicle.
 * Opened when user clicks a RecallBadge.
 *
 * Props:
 *   vehicleLabel  — display name like "2023 Chevy Bolt EUV"
 *   recalls       — array of Recall objects from RecallBadge
 *   authToken     — Bearer token for dismiss API calls
 *   onClose       — close the panel
 *   onDismissed   — callback with dismissed recall id so parent can update badge
 */
"use client";

import { useState } from "react";
import { X, AlertTriangle, CheckCircle, ExternalLink, ShieldAlert } from "lucide-react";
import type { Recall } from "./RecallBadge";

interface RecallPanelProps {
  vehicleLabel: string;
  recalls: Recall[];
  authToken: string;
  onClose: () => void;
  onDismissed?: (recallId: string) => void;
}

const SYSTEM_EMOJI: Record<string, string> = {
  battery: "🔋",
  charging: "⚡",
  software: "💻",
  range: "📍",
  safety: "🛡️",
  powertrain: "⚙️",
  other: "🔧",
};

function scoreLabel(score: number): { label: string; className: string } {
  if (score >= 8) return { label: "High Impact", className: "text-red-600 bg-red-50 border-red-200" };
  if (score >= 5) return { label: "Medium Impact", className: "text-amber-600 bg-amber-50 border-amber-200" };
  return { label: "Low Impact", className: "text-green-700 bg-green-50 border-green-200" };
}

export default function RecallPanel({
  vehicleLabel,
  recalls,
  authToken,
  onClose,
  onDismissed,
}: RecallPanelProps) {
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleRecalls = recalls.filter((r) => !dismissed.has(r.id));

  async function handleDismiss(recall: Recall) {
    setDismissing(recall.id);
    try {
      const res = await fetch("/api/recalls/dismiss", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recall_id: recall.id }),
      });
      if (res.ok) {
        setDismissed((prev) => new Set([...prev, recall.id]));
        onDismissed?.(recall.id);
      }
    } catch {}
    setDismissing(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900">Recall Alerts</h2>
            <p className="text-sm text-gray-500">{vehicleLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {visibleRecalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <CheckCircle size={32} className="mb-2 text-green-500" />
              <p className="text-sm font-medium text-gray-600">All recalls marked as seen</p>
            </div>
          ) : (
            visibleRecalls.map((recall) => {
              const { label, className } = scoreLabel(recall.routine_impact_score);
              const systems = recall.affected_systems || [];

              return (
                <div key={recall.id} className="border rounded-xl p-4 space-y-3 bg-white">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {recall.is_safety_critical && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        <ShieldAlert size={10} /> Safety Critical
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${className}`}>
                      {label} · {recall.routine_impact_score}/10
                    </span>
                    {recall.component && (
                      <span className="text-xs text-gray-500 font-mono uppercase tracking-wide">
                        {recall.component}
                      </span>
                    )}
                  </div>

                  {/* AI summary */}
                  {recall.ai_summary && (
                    <p className="text-sm text-gray-800 leading-relaxed">{recall.ai_summary}</p>
                  )}

                  {/* Affected systems */}
                  {systems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {systems.map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                        >
                          {SYSTEM_EMOJI[s] || "•"} {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Remedy */}
                  {recall.remedy && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">What to do</p>
                      <p className="text-xs text-blue-800 leading-relaxed">{recall.remedy}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-0.5">
                    <a
                      href="https://www.nhtsa.gov/vehicle-safety/recalls"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink size={10} /> NHTSA Detail
                    </a>
                    {recall.recall_id && (
                      <span className="text-xs text-gray-400 font-mono">{recall.recall_id}</span>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => handleDismiss(recall)}
                      disabled={dismissing === recall.id}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
                    >
                      <CheckCircle size={11} />
                      {dismissing === recall.id ? "Dismissing…" : "Mark as seen"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
