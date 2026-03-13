"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Trophy, AlertTriangle, ChevronRight, X, CheckCircle2, Zap, Shield, Brain } from "lucide-react";
import { rankCandidates } from "@/lib/shortlist-coach";
import { removeFromShortlist } from "@/lib/shortlist-store";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { ShortlistCandidate, PreferenceWeight, RankedCandidate } from "@/lib/shortlist-coach";

interface ShortlistCoachProps {
  candidates: ShortlistCandidate[];
  onCandidatesChange: (updated: ShortlistCandidate[]) => void;
  onAddAnother?: () => void;
}

const SCORE_COLOR = (score: number) => {
  if (score >= 75) return "text-green-700";
  if (score >= 55) return "text-amber-700";
  return "text-red-700";
};

const SCORE_BG = (score: number) => {
  if (score >= 75) return "bg-green-50 border-green-200";
  if (score >= 55) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
};

function RankBadge({ rank, isWinner }: { rank: number; isWinner: boolean }) {
  if (isWinner) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-800">
        <Trophy className="w-3 h-3" /> Winner
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
      #{rank}
    </span>
  );
}

function CandidateCard({
  ranked,
  isWinner,
  onRemove,
}: {
  ranked: RankedCandidate;
  isWinner: boolean;
  onRemove: (run_id: string) => void;
}) {
  return (
    <div
      className={`relative border rounded-2xl p-5 ${
        isWinner
          ? "border-green-300 bg-green-50 shadow-sm"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* Remove button */}
      <button
        onClick={() => onRemove(ranked.candidate.run_id)}
        className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="Remove from shortlist"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-4 pr-6">
        <RankBadge rank={ranked.rank} isWinner={isWinner} />
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-tight">
            {ranked.candidate.vehicle_label}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-sm font-semibold ${SCORE_COLOR(ranked.composite_score)}`}
            >
              {ranked.composite_score}/100 tie-breaker score
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">
              {ranked.candidate.fit_score.label}
            </span>
          </div>
        </div>
      </div>

      {/* Win reasons */}
      <ul className="space-y-1.5 mb-4">
        {ranked.win_reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            {r}
          </li>
        ))}
      </ul>

      {/* Detail grid */}
      <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-gray-700">Breaks first: </span>
            <span className="text-gray-600">{ranked.breaks_first}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-gray-700">Plan B: </span>
            <span className="text-gray-600">{ranked.plan_b_summary}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Zap className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-gray-700">Verify: </span>
            <span className="text-gray-600">{ranked.verify_this}</span>
          </span>
        </div>
      </div>

      {/* Secondary scores bar */}
      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-center text-xs">
        {(
          [
            ["Resilience", ranked.secondary_scores.resilience],
            ["Friction", ranked.secondary_scores.friction_forecast],
            ["Household", ranked.secondary_scores.household],
            ["Confidence", ranked.secondary_scores.confidence],
          ] as [string, number][]
        ).map(([label, score]) => (
          <div key={label}>
            <div className={`font-semibold ${SCORE_COLOR(score)}`}>{score}</div>
            <div className="text-gray-400">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShortlistCoach({
  candidates,
  onCandidatesChange,
  onAddAnother,
}: ShortlistCoachProps) {
  const [preference, setPreference] = useState<PreferenceWeight | null>(null);
  const { trackEvent } = useEventTracking();

  const result = useMemo(
    () => rankCandidates(candidates, preference ?? undefined),
    [candidates, preference]
  );

  const handleRemove = (run_id: string) => {
    removeFromShortlist(run_id);
    onCandidatesChange(candidates.filter((c) => c.run_id !== run_id));
    trackEvent("shortlist_remove", { run_id });
  };

  const handlePreference = (p: PreferenceWeight) => {
    setPreference(p);
    trackEvent("shortlist_preference_set", { preference: p });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Your Shortlist ({candidates.length})
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {result.too_close
              ? "Scores are close — answer one question to decide"
              : result.winner
              ? `${result.winner.candidate.vehicle_label} ranks first`
              : "Ranked by routine fit"}
          </p>
        </div>
        {onAddAnother && candidates.length < 4 && (
          <button
            onClick={onAddAnother}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add another
          </button>
        )}
      </div>

      {/* Winner banner */}
      {result.winner && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">{result.artifact.headline}</p>
            <p className="text-xs text-green-700 mt-0.5">
              Leads #2 by {result.decision_gap} tie-breaker points
            </p>
          </div>
        </div>
      )}

      {/* Tie-break question */}
      {result.too_close && result.tie_break_question && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-2 mb-3">
            <Brain className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-blue-900">
              {result.tie_break_question}
            </p>
          </div>
          <div className="space-y-2">
            {result.tie_break_options?.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePreference(opt.value)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                  preference === opt.value
                    ? "border-blue-500 bg-blue-100"
                    : "border-gray-200 bg-white hover:border-blue-300"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ranked candidate cards */}
      <div className="space-y-4">
        {result.top3.map((ranked) => (
          <CandidateCard
            key={ranked.candidate.run_id}
            ranked={ranked}
            isWinner={!result.too_close && ranked.rank === 1}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="pt-2">
        {result.artifact.cta === "paste_listing" && result.artifact.cta_run_id ? (
          <Link
            href="/routine"
            onClick={() => trackEvent("shortlist_cta_clicked", { cta: "paste_listing" })}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Run EVFit for {result.winner?.candidate.vehicle_label ?? "winner"}
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link
            href="/routine"
            onClick={() => trackEvent("shortlist_cta_clicked", { cta: "add_car" })}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Run EVFit for another car to compare
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
