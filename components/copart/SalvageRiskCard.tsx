"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle, Zap, Wrench, Tag, Bell, DollarSign, Gauge, TrendingUp, Lock } from "lucide-react";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";

type DataSource = "api" | "scrape" | "manual";

interface SalvageRiskCardProps {
  result: SalvageRiskResult;
  dataSource?: DataSource;
  /** Pass false for confirmed ICE to hide EV-specific battery factor */
  isEv?: boolean | null;
}

const GRADE_CONFIG = {
  green: {
    label: "Low Risk",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    barClass: "bg-green-500",
    icon: ShieldCheck,
    iconClass: "text-green-600",
    borderClass: "border-green-200",
    bgClass: "bg-green-50",
  },
  yellow: {
    label: "Moderate Risk",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    barClass: "bg-amber-500",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    borderClass: "border-amber-200",
    bgClass: "bg-amber-50",
  },
  red: {
    label: "High Risk",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    barClass: "bg-red-500",
    icon: ShieldAlert,
    iconClass: "text-red-600",
    borderClass: "border-red-200",
    bgClass: "bg-red-50",
  },
};

const FACTOR_ROWS = [
  { key: "battery_risk" as const, label: "Battery Risk", icon: Zap },
  { key: "structural_risk" as const, label: "Structural Risk", icon: Wrench },
  { key: "title_impact" as const, label: "Title Impact", icon: Tag },
  { key: "recall_overlap" as const, label: "Recall Overlap", icon: Bell },
  { key: "repair_cost_risk" as const, label: "Repair Cost Risk", icon: DollarSign },
  { key: "mileage_penalty" as const, label: "Mileage Penalty", icon: Gauge },
];

// Plain-English explanations for high-risk factors (>= 60)
const FACTOR_EXPLANATIONS: Record<string, string> = {
  battery_risk: "Battery pack likely damaged — EV battery replacement costs $8k–$20k and may not be covered by insurance after salvage.",
  structural_risk: "Structural or charging system damage detected — frame repairs and OBC/DCDC replacements add $3k–$8k+.",
  title_impact: "Salvage/rebuilt title reduces resale value by 20–40% and limits financing and insurance options.",
  recall_overlap: "Open recalls present — verify completion; unresolved safety recalls affect driveability and liability.",
  repair_cost_risk: "Asking price vs. estimated market value suggests significant hidden damage — request full damage report.",
  mileage_penalty: "High mileage increases risk of battery degradation and accelerates component wear post-repair.",
};

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

const DATA_SOURCE_BADGE: Record<DataSource, { label: string; className: string }> = {
  api:    { label: "Live lot data",      className: "bg-green-100 text-green-700 border-green-200" },
  scrape: { label: "Extracted from page", className: "bg-amber-100 text-amber-700 border-amber-200" },
  manual: { label: "Manual entry",        className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function SalvageRiskCard({ result, dataSource, isEv }: SalvageRiskCardProps) {
  const cfg = GRADE_CONFIG[result.grade];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl border ${cfg.borderClass} ${cfg.bgClass} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${cfg.iconClass}`} />
          <h3 className="text-base font-bold text-gray-900">Salvage Risk Score</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
          <span className="text-2xl font-bold text-gray-900">{result.score}/100</span>
        </div>
      </div>
      {/* Data source indicator */}
      {dataSource && (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${DATA_SOURCE_BADGE[dataSource].className}`}>
            {dataSource === "api" ? "●" : dataSource === "scrape" ? "◐" : "○"} {DATA_SOURCE_BADGE[dataSource].label}
          </span>
        </div>
      )}

      {/* Overall bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cfg.barClass}`}
          style={{ width: `${result.score}%` }}
        />
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        {FACTOR_ROWS.filter(({ key }) => key !== "battery_risk" || isEv !== false).map(({ key, label, icon: FactorIcon }) => {
          const riskVal = result.factors[key];
          const barColor =
            riskVal >= 70 ? "bg-red-500" : riskVal >= 40 ? "bg-amber-500" : "bg-green-500";
          return (
            <div key={key} className="flex items-center gap-2">
              <FactorIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 w-32 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${riskVal}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-8 text-right">{riskVal}</span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-700 leading-relaxed">{result.routine_impact_summary}</p>

      {/* Risk factor summary — always visible */}
      <div className="border-t border-gray-200/60 pt-3 space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Risk factor summary</p>
        {FACTOR_ROWS.filter(({ key }) => key !== "battery_risk" || isEv !== false).map(({ key, label, icon: FactorIcon }) => {
          const val = result.factors[key];
          const isHigh = val >= 60;
          const isMid = val >= 30 && val < 60;
          const textColor = isHigh ? "text-red-700" : isMid ? "text-amber-700" : "text-green-700";
          const levelLabel = isHigh ? "Elevated" : isMid ? "Moderate" : "Low";
          return (
            <div key={key} className="flex items-start gap-2 text-xs">
              <FactorIcon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${textColor}`} />
              <span className="text-gray-700 w-28 flex-shrink-0">{label}</span>
              <span className={`font-semibold ${textColor}`}>{val > 0 ? `${levelLabel} (${val})` : "None detected"}</span>
              {isHigh && <span className="text-gray-500 ml-1">— {FACTOR_EXPLANATIONS[key].split("—")[0].trim()}</span>}
            </div>
          );
        })}
      </div>

      {/* ARV hint — shown when price was available for heuristic */}
      {result.arv_hint_low != null && result.arv_hint_high != null && (
        <div className="flex items-start justify-between gap-3 p-3 bg-white/70 rounded-xl border border-gray-200/60">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Intact retail estimate</p>
              <p className="text-xs text-gray-500">Rough heuristic based on damage severity</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-gray-900">
              {fmt(result.arv_hint_low)} – {fmt(result.arv_hint_high)}
            </p>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <Lock className="w-2.5 h-2.5 text-orange-400" />
              <p className="text-xs text-orange-600">Live ARV in full report</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
