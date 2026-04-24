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
        bg: "bg-green-500/10",
        border: "border-green-500/30",
        text: "text-green-300",
        Icon: CheckCircle,
        iconColor: "text-green-400",
      };
    } else if (fitSignal === "Conditional Fit") {
      return {
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30",
        text: "text-yellow-300",
        Icon: AlertTriangle,
        iconColor: "text-yellow-400",
      };
    }
    return {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      Icon: XCircle,
      iconColor: "text-red-400",
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
        <span className="text-xs font-medium text-white/50 bg-white/[0.08] px-2.5 py-1 rounded-full whitespace-nowrap border border-white/[0.12]">
          {mentalLoad}
        </span>
      </div>
      <p className="text-sm text-white/70" style={{ lineHeight: "var(--leading-normal)" }}>{verdict}</p>
    </div>
  );
}
