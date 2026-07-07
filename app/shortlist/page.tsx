"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListPlus, ChevronLeft, GitCompare } from "lucide-react";
import ShortlistCoach from "@/components/shortlist/ShortlistCoach";
import { getShortlist } from "@/lib/shortlist-store";
import type { ShortlistCandidate } from "@/lib/shortlist-coach";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function ShortlistPage() {
  const { trackEvent } = useEventTracking();
  const [candidates, setCandidates] = useState<ShortlistCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { trackEvent("shortlist_page_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
              <h1 className="text-2xl font-bold text-white">Compare EVs</h1>
              <p className="text-sm text-white/40 mt-1">
                Add 2–3 EVs to get a side-by-side fit score and tie-breaker ranking.
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

        {/* Empty state — with slot placeholders */}
        {candidates.length === 0 && (
          <div className="space-y-3">
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-10 text-center">
              <ListPlus className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-white/70 mb-1">
                Your shortlist is empty
              </h2>
              <p className="text-sm text-white/40 mb-6">
                Analyze a listing, then tap <strong className="text-white/60">&quot;Add to Shortlist&quot;</strong> on the results page.
                Add 2–3 EVs to get a side-by-side fit comparison.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/receipt"
                  className="inline-flex items-center gap-2 bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
                >
                  Analyze a listing →
                </Link>
                <Link
                  href="/deals"
                  className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/60 font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
                >
                  Browse curated deals →
                </Link>
              </div>
            </div>
            {/* Slot previews */}
            {[1, 2, 3].map((slot) => (
              <div key={slot} className="bg-[#161b22]/50 border border-dashed border-white/[0.08] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-dashed border-white/[0.10] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-white/20 font-bold">{slot}</span>
                </div>
                <p className="text-sm text-white/20 italic">EV slot {slot} — empty</p>
              </div>
            ))}
          </div>
        )}

        {/* Single candidate — show one filled slot + two empty */}
        {candidates.length === 1 && (
          <div className="space-y-3">
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-[#00d97e] font-bold">1</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white/90">
                      {candidates[0].vehicle_label}
                    </h2>
                    <p className="text-sm text-white/40 mt-0.5">
                      {candidates[0].fit_score.label} · {candidates[0].fit_score.score_0_100}/100
                    </p>
                  </div>
                </div>
              </div>
              {candidates[0].fit_score.breakpoints_ranked[0] && (
                <p className="text-sm text-white/50 ml-12">
                  <span className="font-medium text-white/70">Breaks first: </span>
                  {candidates[0].fit_score.breakpoints_ranked[0].title}
                </p>
              )}
            </div>
            {[2, 3].map((slot) => (
              <div key={slot} className="bg-[#161b22]/50 border border-dashed border-white/[0.08] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-dashed border-white/[0.10] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-white/20 font-bold">{slot}</span>
                </div>
                <p className="text-sm text-white/20 italic">Add another EV to compare</p>
              </div>
            ))}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-white/80 mb-1">
                Add a second EV to unlock the comparison
              </p>
              <p className="text-xs text-white/40 mb-4">
                Analyze another listing and tap &quot;Add to Shortlist&quot; on the results page.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/receipt"
                  className="inline-flex items-center gap-2 bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
                >
                  Analyze another listing →
                </Link>
                <Link
                  href="/deals"
                  className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/60 font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
                >
                  Browse curated deals →
                </Link>
              </div>
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
