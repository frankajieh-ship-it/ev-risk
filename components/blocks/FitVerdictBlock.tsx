"use client";

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { FitSignal, MentalLoadLabel } from "@/types/presentation";

interface FitVerdictBlockProps {
  fitSignal: FitSignal;
  verdict: string;
  mentalLoad: MentalLoadLabel;
}

export function FitVerdictBlock({
  fitSignal,
  verdict,
  mentalLoad,
}: FitVerdictBlockProps) {
  const getStyle = () => {
    if (fitSignal === "Good Fit" || fitSignal === "Good Fit — with conditions") {
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-800",
        Icon: CheckCircle,
        iconColor: "text-green-600",
      };
    } else if (fitSignal === "Conditional Fit") {
      return {
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        text: "text-yellow-800",
        Icon: AlertTriangle,
        iconColor: "text-yellow-600",
      };
    }
    return {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      Icon: XCircle,
      iconColor: "text-red-600",
    };
  };

  const style = getStyle();
  const Icon = style.Icon;

  return (
    <div className={`${style.bg} border ${style.border} rounded-2xl p-6`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${style.iconColor} flex-shrink-0`} />
          <span className={`text-lg font-semibold ${style.text}`} style={{ lineHeight: "var(--leading-snug)" }}>{fitSignal}</span>
        </div>
        <span className="text-xs font-medium text-gray-500 bg-white/80 px-2.5 py-1 rounded-full whitespace-nowrap border border-white/60">
          {mentalLoad}
        </span>
      </div>
      <p className="text-sm text-gray-700" style={{ lineHeight: "var(--leading-normal)" }}>{verdict}</p>
    </div>
  );
}
