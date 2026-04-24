"use client";

/**
 * ConfidenceBlock - Data Completeness Indicator
 *
 * Critical framing: Confidence = data completeness, NOT correctness/truth
 * Shows High/Medium/Low only (no numeric values on web)
 * Numeric confidence stays internal + PDF only
 */

import { Database } from "lucide-react";
import type { ConfidenceLevel } from "@/types/presentation";

interface ConfidenceBlockProps {
  level: ConfidenceLevel;
  summary: string;
}

export function ConfidenceBlock({ level, summary }: ConfidenceBlockProps) {
  const getBadgeStyle = () => {
    if (level === "High") return "bg-green-500/20 text-green-400";
    if (level === "Medium") return "bg-amber-500/20 text-amber-400";
    return "bg-red-500/20 text-red-400";
  };

  // Reframe confidence as data completeness
  const getCompleteness = () => {
    if (level === "High") return "Complete";
    if (level === "Medium") return "Partial";
    return "Limited";
  };

  return (
    <div className="bg-white/[0.05] rounded-xl p-5 border border-white/[0.08]">
      <div className="flex items-center gap-3 mb-3">
        <Database className="w-5 h-5 text-white/50" />
        <h3 className="font-bold text-white">Data Available</h3>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${getBadgeStyle()}`}
        >
          {getCompleteness()}
        </span>
      </div>
      <p className="text-sm text-white/70">{summary}</p>
    </div>
  );
}
