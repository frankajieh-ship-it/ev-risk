"use client";

/**
 * /workspace/ev-fit — EV Fit Score Hub
 *
 * Shows the user's most recent EV Fit analysis result and saved shortlist,
 * with CTAs to retake the questionnaire or browse matching deals.
 * Falls back to an onboarding prompt if no prior analysis exists.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap, ArrowRight, RefreshCw, Car, CheckCircle,
  AlertTriangle, XCircle, ChevronRight, Loader2,
} from "lucide-react";
import { getShortlist } from "@/lib/shortlist-store";
import type { ShortlistCandidate } from "@/lib/shortlist-coach";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";

interface RoutineHistoryEntry {
  id: string;
  created_at: string;
  fit_label: string;
  friction_score: number;
  break_first_reason: string | null;
  stress_level: string;
  scenario_name: string | null;
  inputs_json: {
    routine?: { charging_access?: string; climate?: string };
    vehicle?: { year?: number; make?: string; model?: string };
  };
}

const FIT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  "Great Fit":     { icon: CheckCircle,  color: "text-[#00d97e]",   bg: "bg-[#00d97e]/10",    border: "border-[#00d97e]/20"    },
  "Good Fit":      { icon: CheckCircle,  color: "text-[#00d97e]",   bg: "bg-[#00d97e]/10",    border: "border-[#00d97e]/20"    },
  "Mixed Fit":     { icon: AlertTriangle,color: "text-yellow-400",  bg: "bg-yellow-500/10",   border: "border-yellow-500/20"   },
  "High Friction": { icon: XCircle,      color: "text-red-400",     bg: "bg-red-500/10",      border: "border-red-500/20"      },
};

function getFitConfig(label: string) {
  return FIT_CONFIG[label] ?? FIT_CONFIG["Mixed Fit"];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}

export default function EvFitPage() {
  const [loading, setLoading] = useState(true);
  const [latestRun, setLatestRun] = useState<RoutineHistoryEntry | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistCandidate[]>([]);

  useEffect(() => {
    setShortlist(getShortlist());

    async function loadHistory() {
      try {
        const sessionId = getOrCreatePersistentSessionId();
        if (!sessionId) { setLoading(false); return; }

        const res = await fetch(`/api/routine/history?anon_session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.success && data.runs?.length > 0) {
          setLatestRun(data.runs[0]);
        }
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  // ── No prior run ──────────────────────────────────────────────────────
  if (!latestRun) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#00d97e]">EV Fit Score</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Find your perfect EV fit</h1>
          <p className="text-white/40 text-sm mt-1">
            Answer a few questions about your lifestyle — takes about 2 minutes.
          </p>
        </div>

        {/* What it covers */}
        <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-white mb-4">What we analyze</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Charging setup", desc: "Home access, shared lots, DC fast charge" },
              { label: "Daily range needs", desc: "Commute + weekend driving patterns" },
              { label: "Climate impact", desc: "Cold winters reduce battery range" },
              { label: "Backup plan", desc: "What happens when charging isn't available" },
            ].map((item) => (
              <div key={item.label} className="flex gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00d97e] mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/80 font-medium">{item.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/routine"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#00d97e] text-[#0d1117] rounded-xl font-semibold text-sm hover:bg-[#00c970] transition-colors"
        >
          Start EV Fit Analysis
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // ── Has a prior run ───────────────────────────────────────────────────
  const cfg = getFitConfig(latestRun.fit_label);
  const FitIcon = cfg.icon;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#00d97e]">EV Fit Score</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Your EV Fit</h1>
          <p className="text-xs text-white/30 mt-0.5">Last analyzed {timeAgo(latestRun.created_at)}</p>
        </div>
        <Link
          href="/routine"
          className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retake
        </Link>
      </div>

      {/* Fit verdict card */}
      <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-5 mb-5`}>
        <div className="flex items-center gap-3 mb-3">
          <FitIcon className={`w-6 h-6 ${cfg.color}`} />
          <div>
            <p className={`text-lg font-bold ${cfg.color}`}>{latestRun.fit_label}</p>
            {latestRun.scenario_name && (
              <p className="text-xs text-white/40">{latestRun.scenario_name}</p>
            )}
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-white">{Math.round((1 - latestRun.friction_score / 10) * 100)}</p>
            <p className="text-xs text-white/30">/ 100</p>
          </div>
        </div>

        {latestRun.break_first_reason && (
          <div className="flex items-start gap-2 pt-3 border-t border-white/[0.06]">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/50">{latestRun.break_first_reason}</p>
          </div>
        )}
      </div>

      {/* Shortlisted vehicles */}
      {shortlist.length > 0 && (
        <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white">Saved Vehicles</p>
            <span className="text-xs text-white/30">{shortlist.length} shortlisted</span>
          </div>
          <div className="space-y-2.5">
            {shortlist.slice(0, 3).map((candidate) => {
              const candidateCfg = getFitConfig(candidate.fit_score?.label ?? "");
              const CandidateIcon = candidateCfg.icon;
              return (
                <div key={candidate.run_id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${candidateCfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Car className={`w-4 h-4 ${candidateCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{candidate.vehicle_label}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <CandidateIcon className={`w-3 h-3 ${candidateCfg.color}`} />
                      <p className={`text-xs ${candidateCfg.color}`}>{candidate.fit_score?.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action CTAs */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/routine"
          className="flex items-center justify-center gap-2 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white text-sm font-medium rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retake quiz
        </Link>
        <Link
          href="/deals"
          className="flex items-center justify-center gap-2 py-3 bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-sm font-semibold rounded-xl transition-colors"
        >
          Browse deals
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Past run history link */}
      <Link
        href="/routine"
        className="flex items-center justify-between w-full mt-4 px-4 py-3 bg-[#161b22] border border-white/[0.08] rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        <span>View full analysis history</span>
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
