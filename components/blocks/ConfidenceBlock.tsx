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
    if (level === "High") return "bg-green-100 text-green-800";
    if (level === "Medium") return "bg-amber-100 text-amber-900";
    return "bg-red-100 text-red-800";
  };

  // Reframe confidence as data completeness
  const getCompleteness = () => {
    if (level === "High") return "Complete";
    if (level === "Medium") return "Partial";
    return "Limited";
  };

  return (
    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <Database className="w-5 h-5 text-gray-600" />
        <h3 className="font-bold text-gray-900">Data Available</h3>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${getBadgeStyle()}`}
        >
          {getCompleteness()}
        </span>
      </div>
      <p className="text-sm text-gray-700">{summary}</p>
    </div>
  );
}
