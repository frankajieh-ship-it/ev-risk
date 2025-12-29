"use client";

/**
 * Insight Cards Component
 *
 * Purpose: Surface actionable patterns from collected data
 * Shows aggregated insights with one-click actions
 */

import type { PatternAnalysis } from "@/types/behavioralPatterns";

interface InsightCardsProps {
  clusters: PatternAnalysis[];
  totalPatterns: number;
}

export default function InsightCards({ clusters, totalPatterns }: InsightCardsProps) {
  const handleCreateContentTemplate = (cluster: PatternAnalysis) => {
    const template = `
# Content Template: ${cluster.pattern_cluster}

## Common User Quote
"${cluster.sample_quotes[0] || "N/A"}"

## Root Causes
${cluster.common_root_causes.map((cause) => `- ${cause}`).join("\n")}

## Suggested Messaging
Focus on: **${cluster.pattern_cluster.toLowerCase()}**

Key insight: This pattern appears in ${cluster.frequency} cases with an average cognitive load of ${cluster.avg_cognitive_load.toFixed(1)}/5.

## Outcome Distribution
- ${cluster.outcome_distribution.adapted_successfully} users adapted successfully
- ${cluster.outcome_distribution.ongoing_friction} experiencing ongoing friction
- ${cluster.outcome_distribution.regret} expressing regret

## Recommended Action
[Add specific product/content recommendation here]
`;

    // Copy to clipboard
    navigator.clipboard.writeText(template);
    alert("Content template copied to clipboard!");
  };

  const handleCreateUIPattern = (cluster: PatternAnalysis) => {
    alert(`UI Pattern ticket would be created for: ${cluster.pattern_cluster}`);
    // In production, this would integrate with Jira/Linear/etc.
  };

  if (clusters.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500 text-lg">No insights available yet.</p>
        <p className="text-gray-400 mt-2">Submit patterns to see aggregated insights.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {clusters.map((cluster, idx) => {
        // Determine icon and category based on pattern name
        const getIcon = (name: string) => {
          if (name.toLowerCase().includes("charg")) return "⚡";
          if (name.toLowerCase().includes("battery")) return "🔋";
          if (name.toLowerCase().includes("apartment")) return "🏢";
          if (name.toLowerCase().includes("predict")) return "🎯";
          return "💡";
        };

        const getCategory = (name: string) => {
          if (name.toLowerCase().includes("charg")) return "charging";
          if (name.toLowerCase().includes("battery")) return "battery";
          if (name.toLowerCase().includes("apartment")) return "housing";
          return "general";
        };

        const icon = getIcon(cluster.pattern_cluster);
        const category = getCategory(cluster.pattern_cluster);
        const categoryColors: Record<string, string> = {
          charging: "bg-yellow-50 border-yellow-200",
          battery: "bg-green-50 border-green-200",
          housing: "bg-blue-50 border-blue-200",
          general: "bg-gray-50 border-gray-200",
        };

        const highFriction = cluster.outcome_distribution.ongoing_friction / cluster.frequency > 0.5;
        const highRegret = cluster.outcome_distribution.regret / cluster.frequency > 0.2;

        return (
          <div
            key={idx}
            className={`border-2 rounded-lg p-6 ${categoryColors[category] || categoryColors.general}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{icon}</span>
                <div>
                  <h3 className="text-lg font-bold">{cluster.pattern_cluster}</h3>
                  <p className="text-sm text-gray-600">
                    {cluster.frequency} pattern{cluster.frequency !== 1 ? "s" : ""} · Avg Load:{" "}
                    {cluster.avg_cognitive_load.toFixed(1)}/5
                  </p>
                </div>
              </div>

              {/* Alert badges */}
              <div className="flex flex-col gap-1">
                {highFriction && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                    ⚠️ High Friction
                  </span>
                )}
                {highRegret && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                    😞 High Regret
                  </span>
                )}
              </div>
            </div>

            {/* Representative Quote */}
            {cluster.sample_quotes[0] && (
              <div className="mb-4 bg-white bg-opacity-50 p-3 rounded border">
                <p className="text-sm text-gray-700 italic">
                  &quot;{cluster.sample_quotes[0]}&quot;
                </p>
              </div>
            )}

            {/* Root Causes */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Root Causes:</h4>
              <ul className="text-sm space-y-1">
                {cluster.common_root_causes.slice(0, 2).map((cause, i) => (
                  <li key={i} className="text-gray-700">
                    • {cause}
                  </li>
                ))}
              </ul>
            </div>

            {/* Outcome Stats */}
            <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white bg-opacity-50 p-2 rounded">
                <span className="text-gray-600">Adapted:</span>{" "}
                <strong>{cluster.outcome_distribution.adapted_successfully}</strong>
              </div>
              <div className="bg-white bg-opacity-50 p-2 rounded">
                <span className="text-gray-600">Friction:</span>{" "}
                <strong>{cluster.outcome_distribution.ongoing_friction}</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleCreateContentTemplate(cluster)}
                className="flex-1 bg-white border-2 border-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-50"
              >
                📄 Content Template
              </button>
              <button
                onClick={() => handleCreateUIPattern(cluster)}
                className="flex-1 bg-white border-2 border-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-50"
              >
                🎨 UI Pattern
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
