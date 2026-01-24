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
    <div className={`${style.bg} border-2 ${style.border} rounded-xl p-6`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Icon className={`w-7 h-7 ${style.iconColor} flex-shrink-0`} />
          <span className={`text-xl font-bold ${style.text}`}>{fitSignal}</span>
        </div>
        <span className="text-sm text-gray-600 bg-white/80 px-3 py-1.5 rounded-full whitespace-nowrap">
          {mentalLoad}
        </span>
      </div>
      <p className="text-gray-800 leading-relaxed">{verdict}</p>
    </div>
  );
}
