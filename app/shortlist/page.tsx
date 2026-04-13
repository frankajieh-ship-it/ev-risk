"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListPlus, ChevronLeft, GitCompare } from "lucide-react";
import ShortlistCoach from "@/components/shortlist/ShortlistCoach";
import { getShortlist } from "@/lib/shortlist-store";
import type { ShortlistCandidate } from "@/lib/shortlist-coach";

export default function ShortlistPage() {
  const [candidates, setCandidates] = useState<ShortlistCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCandidates(getShortlist());
     
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00d97e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/routine"
            className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to EVFit
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Shortlist</h1>
              <p className="text-sm text-white/40 mt-1">
                Compare up to 4 cars and get a tie-breaker ranking.
              </p>
            </div>
            {candidates.length >= 2 && (
              <Link
                href="/compare?from=shortlist"
                className="flex items-center gap-2 px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-xl hover:bg-[#00c970] transition-colors"
              >
                <GitCompare className="w-4 h-4" />
                Compare these →
              </Link>
            )}
          </div>
        </div>

        {/* Empty state */}
        {candidates.length === 0 && (
          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-10 text-center">
            <ListPlus className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-white/70 mb-1">
              Your shortlist is empty
            </h2>
            <p className="text-sm text-white/40 mb-6">
              Run EVFit for a car and tap &quot;Add to Shortlist&quot; on the results page.
            </p>
            <Link
              href="/routine"
              className="inline-flex items-center gap-2 bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
            >
              Run EVFit →
            </Link>
          </div>
        )}

        {/* Single candidate */}
        {candidates.length === 1 && (
          <div className="space-y-4">
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold text-white/90">
                    {candidates[0].vehicle_label}
                  </h2>
                  <p className="text-sm text-white/40 mt-0.5">
                    {candidates[0].fit_score.label} ·{" "}
                    {candidates[0].fit_score.score_0_100}/100
                  </p>
                </div>
              </div>
              {candidates[0].fit_score.breakpoints_ranked[0] && (
                <p className="text-sm text-white/50">
                  <span className="font-medium text-white/70">Breaks first: </span>
                  {candidates[0].fit_score.breakpoints_ranked[0].title}
                </p>
              )}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-white/80 mb-1">
                Add another car to compare
              </p>
              <p className="text-xs text-white/40 mb-4">
                Run EVFit for a second car and tap &quot;Add to Shortlist&quot; to unlock
                the tie-breaker.
              </p>
              <Link
                href="/routine"
                className="inline-flex items-center gap-2 bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
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
