"use client";

/**
 * SavedScenariosList Component
 *
 * Displays user's saved scenarios with preview info and reopen option.
 * Only shown to authenticated users.
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { SavedScenarioPreview } from "@/app/api/user/scenario/list/route";

interface SavedScenariosListProps {
  onSelectScenario?: (scenario: SavedScenarioPreview) => void;
  maxItems?: number;
  compact?: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

function getFitSignalStyles(signal: string | null): { bg: string; text: string; label: string } {
  switch (signal) {
    case "GOOD":
      return { bg: "bg-green-100", text: "text-green-800", label: "Good Fit" };
    case "CONDITIONAL":
      return { bg: "bg-yellow-100", text: "text-yellow-800", label: "Conditional" };
    case "HIGH_FRICTION":
      return { bg: "bg-red-100", text: "text-red-800", label: "High Friction" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-800", label: "—" };
  }
}

export default function SavedScenariosList({
  onSelectScenario,
  maxItems = 5,
  compact = false,
}: SavedScenariosListProps) {
  const { isAuthenticated, session, isLoading } = useAuth();
  const [scenarios, setScenarios] = useState<SavedScenarioPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !session?.access_token) {
      setScenarios([]);
      return;
    }

    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/user/scenario/list?limit=${maxItems}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load scenarios");
        }

        setScenarios(data.scenarios);
        setHasMore(data.has_more);
      } catch (err) {
        console.error("Load scenarios error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, [isAuthenticated, session?.access_token, maxItems]);

  // Don't show if not authenticated or still loading
  if (isLoading || !isAuthenticated) {
    return null;
  }

  // Show nothing if no scenarios
  if (!loading && scenarios.length === 0 && !error) {
    return null;
  }

  return (
    <div className={compact ? "" : "bg-white rounded-xl shadow-lg p-6 border border-gray-100"}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold text-gray-900 ${compact ? "text-base" : "text-lg"}`}>
          Your Saved Scenarios
        </h3>
        {hasMore && !compact && (
          <button className="text-sm text-blue-600 hover:text-blue-700">
            View all
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && scenarios.length > 0 && (
        <div className="space-y-3">
          {scenarios.map((scenario) => {
            const fitStyles = getFitSignalStyles(scenario.fit_signal);

            return (
              <div
                key={scenario.id}
                onClick={() => onSelectScenario?.(scenario)}
                className={`
                  p-4 border border-gray-200 rounded-lg transition-all
                  ${onSelectScenario ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50" : ""}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 truncate">
                        {scenario.vehicle_year} {scenario.vehicle_model}
                      </h4>
                      {scenario.is_comparison && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                          Comparison
                        </span>
                      )}
                    </div>

                    {scenario.one_sentence_verdict && !compact && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {scenario.one_sentence_verdict}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatDate(scenario.saved_at)}</span>
                      {scenario.inputs.dailyMiles && (
                        <span>{scenario.inputs.dailyMiles} mi/day</span>
                      )}
                      {scenario.inputs.homeCharging !== undefined && (
                        <span>{scenario.inputs.homeCharging ? "Home charging" : "No home charging"}</span>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${fitStyles.bg} ${fitStyles.text}`}>
                      {fitStyles.label}
                    </span>
                  </div>
                </div>

                {scenario.notes && !compact && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 italic line-clamp-1">
                      Note: {scenario.notes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && scenarios.length === 0 && (
        <div className="text-center py-6">
          <svg
            className="w-12 h-12 mx-auto text-gray-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="text-sm text-gray-500">No saved scenarios yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Save scenarios from your results to compare later
          </p>
        </div>
      )}
    </div>
  );
}
