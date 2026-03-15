/**
 * Saved Results Dashboard
 *
 * /saved
 * Shows user's saved receipts and EV routine results with tabs.
 * Anonymous users see localStorage-saved receipts.
 * Authenticated users see server-saved + localStorage results merged.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, FileText, Zap, Loader2, GitCompare } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useRegion } from "@/hooks/useRegion";
import type { SavedScenarioPreview } from "@/app/api/user/scenario/list/route";

type TabFilter = "all" | "receipt" | "evroutine";

const LOCAL_STORAGE_KEY = "offo_saved_receipts";

interface LocalSavedReceipt {
  receipt_id: string;
  vehicle: string;
  verdict: string;
  verdict_reason: string | null;
  price: number | null;
  mileage: number | null;
  saved_at: string;
}

function getLocalSavedReceipts(): LocalSavedReceipt[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Convert a localStorage receipt into the same shape the card renderer expects */
function localToPreview(local: LocalSavedReceipt): SavedScenarioPreview {
  return {
    id: `local_${local.receipt_id}`,
    scenario_type: "receipt",
    receipt_id: local.receipt_id,
    scenario_hash: `receipt_${local.receipt_id}`,
    vehicle_model: local.vehicle || "Unknown Vehicle",
    vehicle_year: 0,
    fit_signal: local.verdict,
    one_sentence_verdict: local.verdict_reason,
    title: local.vehicle
      ? `${local.vehicle} — ${local.verdict === "GREEN" ? "Good Deal" : local.verdict === "YELLOW" ? "Fair Deal" : local.verdict === "RED" ? "Poor Deal" : local.verdict}`
      : null,
    saved_at: local.saved_at,
    is_comparison: false,
    last_viewed_at: null,
    notes: null,
    inputs: {},
  };
}

function formatDate(dateString: string, locale = "en-US"): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function getVerdictStyles(
  scenarioType: string,
  fitSignal: string | null
): { bg: string; text: string; label: string } {
  if (scenarioType === "receipt") {
    switch (fitSignal) {
      case "GREEN":
        return { bg: "bg-green-100", text: "text-green-800", label: "Good Deal" };
      case "YELLOW":
        return { bg: "bg-yellow-100", text: "text-yellow-800", label: "Fair Deal" };
      case "RED":
        return { bg: "bg-red-100", text: "text-red-800", label: "Poor Deal" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-800", label: "—" };
    }
  }
  // evroutine
  switch (fitSignal) {
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

export default function SavedPage() {
  const router = useRouter();
  const { isAuthenticated, session, isLoading: authLoading, isReady } = useAuth();
  const { trackEvent } = useEventTracking();
  const { config: regionConfig } = useRegion();

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [scenarios, setScenarios] = useState<SavedScenarioPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    trackEvent("saved_dashboard_viewed");
  }, [trackEvent]);

  // Load saved scenarios: localStorage for everyone, + server for authenticated users
  useEffect(() => {
    const loadScenarios = async () => {
      setLoading(true);
      setError(null);

      // 1. Always load localStorage receipts
      const localReceipts = getLocalSavedReceipts();
      const localPreviews: SavedScenarioPreview[] = localReceipts.map(localToPreview);

      // 2. If authenticated, also fetch server-saved scenarios
      let serverScenarios: SavedScenarioPreview[] = [];

      if (isAuthenticated && isReady && session?.access_token) {
        try {
          const res = await fetch(
            `/api/user/scenario/list?type=${activeTab}&limit=50`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

          const data = await res.json();

          if (res.ok && data.success) {
            serverScenarios = data.scenarios;
          }
        } catch (err) {
          console.error("Load saved scenarios error:", err);
          // Don't block — localStorage results still show
        }
      }

      // 3. Merge and deduplicate (server wins if same receipt_id exists in both)
      const serverReceiptIds = new Set(
        serverScenarios
          .filter((s) => s.scenario_type === "receipt" && s.receipt_id)
          .map((s) => s.receipt_id)
      );

      const uniqueLocalPreviews = localPreviews.filter(
        (lp) => !serverReceiptIds.has(lp.receipt_id)
      );

      let merged = [...serverScenarios, ...uniqueLocalPreviews];

      // 4. Apply tab filter
      if (activeTab === "receipt") {
        merged = merged.filter((s) => s.scenario_type === "receipt");
      } else if (activeTab === "evroutine") {
        merged = merged.filter((s) => s.scenario_type === "evroutine");
      }

      // Sort by saved_at descending
      merged.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());

      setScenarios(merged);
      setTotal(merged.length);
      setLoading(false);
    };

    // Wait for auth to finish loading before fetching
    if (!authLoading) {
      loadScenarios();
    }
  }, [isAuthenticated, isReady, session?.access_token, activeTab, authLoading]);

  const handleScenarioClick = (scenario: SavedScenarioPreview) => {
    trackEvent("saved_scenario_resumed", {
      scenario_type: scenario.scenario_type,
      scenario_id: scenario.id,
    });

    if (scenario.scenario_type === "receipt" && scenario.receipt_id) {
      router.push(`/receipt?resume=${scenario.receipt_id}`);
    } else {
      // EVRoutine — navigate with scenario hash to reload results
      router.push(`/?scenario=${scenario.scenario_hash}`);
    }
  };

  const tabs: { key: TabFilter; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <Bookmark className="w-3.5 h-3.5" /> },
    { key: "receipt", label: "Receipts", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "evroutine", label: "EV Routines", icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Saved Results</h1>
            {total > 0 && (
              <p className="text-sm text-gray-500">{total} saved</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-indigo-600 hover:text-indigo-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && scenarios.length === 0 && (
          <div className="text-center py-16">
            <Bookmark className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium mb-1">
              No saved results yet
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {activeTab === "receipt"
                ? "Generate a listing receipt and save it to see it here."
                : activeTab === "evroutine"
                ? "Run an EV routine check and save it to see it here."
                : "Generate a receipt or run a routine check to get started."}
            </p>
            <button
              onClick={() => router.push(activeTab === "evroutine" ? "/" : "/receipt")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {activeTab === "evroutine" ? "Check EV Routine Fit" : "Generate a Receipt"}
            </button>
          </div>
        )}

        {/* Compare button */}
        {!loading && !error && scenarios.length >= 2 && (
          <div className="flex justify-end mb-2">
            <Link
              href="/compare?from=shortlist"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <GitCompare className="w-4 h-4" />
              Compare top 2 →
            </Link>
          </div>
        )}

        {/* Scenario cards */}
        {!loading && !error && scenarios.length > 0 && (
          <div className="space-y-3">
            {scenarios.map((scenario) => {
              const verdictStyles = getVerdictStyles(
                scenario.scenario_type,
                scenario.fit_signal
              );

              return (
                <button
                  key={scenario.id}
                  onClick={() => handleScenarioClick(scenario)}
                  className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {scenario.scenario_type === "receipt" ? (
                          <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        ) : (
                          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                        <h3 className="font-medium text-gray-900 truncate">
                          {scenario.title ||
                            `${scenario.vehicle_year} ${scenario.vehicle_model}`}
                        </h3>
                      </div>

                      {scenario.one_sentence_verdict && (
                        <p className="text-sm text-gray-600 line-clamp-2 ml-6 mb-2">
                          {scenario.one_sentence_verdict}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-500 ml-6">
                        <span>{formatDate(scenario.saved_at, regionConfig.locale)}</span>
                        <span className="capitalize text-gray-400">
                          {scenario.scenario_type === "receipt"
                            ? "Listing Receipt"
                            : "EV Routine"}
                        </span>
                        {scenario.is_comparison && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            Comparison
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-3 flex-shrink-0">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${verdictStyles.bg} ${verdictStyles.text}`}
                      >
                        {verdictStyles.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
