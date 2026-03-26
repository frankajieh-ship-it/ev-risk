"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Zap, Wrench, Tag, Bell, DollarSign, Gauge, TrendingUp, Lock, ChevronDown, ChevronUp } from "lucide-react";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";

interface SalvageRiskCardProps {
  result: SalvageRiskResult;
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

export default function SalvageRiskCard({ result }: SalvageRiskCardProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const cfg = GRADE_CONFIG[result.grade];
  const Icon = cfg.icon;

  // Top risk factors for checklist (only those >= 60)
  const highFactors = FACTOR_ROWS
    .filter(({ key }) => result.factors[key] >= 60)
    .sort((a, b) => result.factors[b.key] - result.factors[a.key])
    .slice(0, 3);

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

      {/* Overall bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cfg.barClass}`}
          style={{ width: `${result.score}%` }}
        />
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        {FACTOR_ROWS.map(({ key, label, icon: FactorIcon }) => {
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

      {/* Risk checklist — collapsible, only shown when factors >= 60 */}
      {highFactors.length > 0 && (
        <div className="border-t border-gray-200/60 pt-3">
          <button
            onClick={() => setChecklistOpen((o) => !o)}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 hover:text-gray-800"
          >
            <span>What&apos;s raising this risk score?</span>
            {checklistOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {checklistOpen && (
            <div className="mt-2 space-y-2">
              {highFactors.map(({ key, label, icon: FactorIcon }) => (
                <div key={key} className="flex items-start gap-2 p-2 bg-white/70 rounded-lg">
                  <FactorIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{FACTOR_EXPLANATIONS[key]}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
