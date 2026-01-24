"use client";

import { Shield } from "lucide-react";
import type { ConfidenceLevel } from "@/types/presentation";

interface ConfidenceBlockProps {
  level: ConfidenceLevel;
  summary: string;
}

export function ConfidenceBlock({ level, summary }: ConfidenceBlockProps) {
  const getBadgeStyle = () => {
    if (level === "High") return "bg-green-100 text-green-700";
    if (level === "Medium") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <Shield className="w-5 h-5 text-gray-600" />
        <h3 className="font-bold text-gray-900">Confidence</h3>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${getBadgeStyle()}`}
        >
          {level}
        </span>
      </div>
      <p className="text-sm text-gray-700">{summary}</p>
    </div>
  );
}
