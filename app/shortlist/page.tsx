"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListPlus, ChevronLeft } from "lucide-react";
import ShortlistCoach from "@/components/shortlist/ShortlistCoach";
import { getShortlist } from "@/lib/shortlist-store";
import type { ShortlistCandidate } from "@/lib/shortlist-coach";

export default function ShortlistPage() {
  const [candidates, setCandidates] = useState<ShortlistCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCandidates(getShortlist());
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/routine"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Back to EVFit
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Shortlist</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare up to 4 cars and get a tie-breaker ranking.
          </p>
        </div>

        {/* Empty state */}
        {candidates.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <ListPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-gray-700 mb-1">
              Your shortlist is empty
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Run EVFit for a car and tap "Add to Shortlist" on the results page.
            </p>
            <Link
              href="/routine"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
            >
              Run EVFit →
            </Link>
          </div>
        )}

        {/* Single candidate */}
        {candidates.length === 1 && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {candidates[0].vehicle_label}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {candidates[0].fit_score.label} ·{" "}
                    {candidates[0].fit_score.score_0_100}/100
                  </p>
                </div>
              </div>
              {candidates[0].fit_score.breakpoints_ranked[0] && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Breaks first: </span>
                  {candidates[0].fit_score.breakpoints_ranked[0].title}
                </p>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Add another car to compare
              </p>
              <p className="text-xs text-blue-700 mb-4">
                Run EVFit for a second car and tap "Add to Shortlist" to unlock
                the tie-breaker.
              </p>
              <Link
                href="/routine"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                Run EVFit for another car →
              </Link>
            </div>
          </div>
        )}

        {/* 2–4 candidates: full coach */}
        {candidates.length >= 2 && (
          <ShortlistCoach
            candidates={candidates}
            onCandidatesChange={setCandidates}
            onAddAnother={
              candidates.length < 4
                ? () => (window.location.href = "/routine")
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
