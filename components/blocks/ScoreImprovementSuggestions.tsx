"use client";

/**
 * Score Improvement Suggestions
 *
 * Displays expandable suggestions showing how to improve a vehicle's fit score.
 * Shows 1-3 ranked suggestions with score deltas.
 */

import { useState } from "react";
import { Lightbulb, ChevronDown, CheckCircle } from "lucide-react";
import type { ScoreImprovement } from "@/types/recommendations";

interface ScoreImprovementSuggestionsProps {
  improvements: ScoreImprovement[];
}

export function ScoreImprovementSuggestions({ improvements }: ScoreImprovementSuggestionsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!improvements || improvements.length === 0) {
    return null;
  }

  // Check if already optimized
  const isOptimized = improvements.length === 1 && improvements[0].type === "optimized";

  return (
    <div className={`mt-3 p-3 rounded-lg border ${
      isOptimized
        ? "bg-green-50 border-green-200"
        : "bg-blue-50 border-blue-200"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse suggestions" : "Expand suggestions"}
      >
        {isOptimized ? (
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        ) : (
          <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0" />
        )}
        <span className={`text-sm font-semibold ${
          isOptimized ? "text-green-900" : "text-blue-900"
        }`}>
          {isOptimized ? "Already optimized" : "How to improve this score"}
        </span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${
          expanded ? "rotate-180" : ""
        } ${isOptimized ? "text-green-600" : "text-blue-600"}`} />
      </button>

      {expanded && (
        <div className="mt-2">
          {isOptimized ? (
            <p className="text-xs text-green-800">
              {improvements[0].suggestion}
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-blue-800">
              {improvements.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-semibold text-blue-600 whitespace-nowrap">
                    +{imp.score_delta} pts
                  </span>
                  <span>{imp.suggestion}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
