"use client";

/**
 * SavedScenariosList Component
 *
 * Displays user's saved scenarios with preview info and reopen option.
 * Only shown to authenticated users.
 */

import { useState, useEffect } from "react";
import { Loader2, Archive } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui";
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
      return { bg: "bg-green-900/40", text: "text-green-400", label: "Good Fit" };
    case "CONDITIONAL":
      return { bg: "bg-yellow-900/40", text: "text-yellow-400", label: "Conditional" };
    case "HIGH_FRICTION":
      return { bg: "bg-red-900/40", text: "text-red-400", label: "High Friction" };
    default:
      return { bg: "bg-white/[0.08]", text: "text-white/60", label: "—" };
  }
}

export default function SavedScenariosList({
  onSelectScenario,
  maxItems = 5,
  compact = false,
}: SavedScenariosListProps) {
  const { isAuthenticated, session, isLoading, isReady } = useAuth();
  const [scenarios, setScenarios] = useState<SavedScenarioPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    // Wait for isReady - this ensures the token is fully validated after SIGNED_IN
    if (!isAuthenticated || !isReady || !session?.access_token) {
      if (!isLoading) {
        setScenarios([]);
        setLoading(false);
        setHasFetched(true);
      }
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
          // 401/403 = expired token, treat as not-authenticated
          if (response.status === 401 || response.status === 403) {
            setScenarios([]);
            setLoading(false);
            return;
          }
          throw new Error(data.error || "Failed to load scenarios");
        }

        setScenarios(data.scenarios);
        setHasMore(data.has_more);
      } catch (err) {
        console.error("Load scenarios error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    };

    fetchScenarios();
  }, [isAuthenticated, isReady, session?.access_token, maxItems, isLoading]);

  // Don't show while auth is still resolving
  if (isLoading || !isAuthenticated) {
    return null;
  }

  // Show spinner while waiting for first fetch
  if (!hasFetched) {
    return (
      <div className={compact ? "" : "bg-[#161b22] rounded-xl p-6 border border-white/[0.08]"}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#00d97e]" />
        </div>
      </div>
    );
  }

  // Hide entirely if authenticated but has no scenarios and no error
  if (hasFetched && scenarios.length === 0 && !error) {
    return null;
  }

  return (
    <div className={compact ? "" : "bg-[#161b22] rounded-xl p-6 border border-white/[0.08]"}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold text-white ${compact ? "text-base" : "text-lg"}`}>
          Your Saved Scenarios
        </h3>
        {hasMore && !compact && (
          <button className="text-sm text-[#00d97e] hover:text-[#00d97e]/80">
            View all
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#00d97e]" />
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-sm text-red-400">{error}</p>
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
                  p-4 border border-white/[0.08] rounded-lg transition-all
                  ${onSelectScenario ? "cursor-pointer hover:border-white/20 hover:bg-white/[0.04]" : ""}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white truncate">
                        {scenario.vehicle_year} {scenario.vehicle_model}
                      </h4>
                      {scenario.is_comparison && (
                        <span className="text-xs px-2 py-0.5 bg-purple-900/40 text-purple-300 rounded-full">
                          Comparison
                        </span>
                      )}
                    </div>

                    {scenario.one_sentence_verdict && !compact && (
                      <p className="text-sm text-white/70 line-clamp-2 mb-2">
                        {scenario.one_sentence_verdict}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-white/50">
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
                  <div className="mt-2 pt-2 border-t border-white/[0.08]">
                    <p className="text-xs text-white/40 italic line-clamp-1">
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
        <EmptyState
          icon={<Archive className="w-10 h-10" />}
          title="No saved scenarios yet"
          description="Save scenarios from your results to compare later"
        />
      )}
    </div>
  );
}
