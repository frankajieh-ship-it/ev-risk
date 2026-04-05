"use client";

import { useEffect } from "react";
import { Zap, AlertTriangle, CheckCircle, ArrowRight, Battery } from "lucide-react";
import Link from "next/link";
import type { RoutineShareSnapshot } from "@/lib/share-snapshot";
import { useEventTracking } from "@/hooks/useEventTracking";

interface Props {
  snapshot: RoutineShareSnapshot;
  createdAt: string;
  slug: string;
  inviteToken?: string;
}

const FIT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Zap }> = {
  "Great Fit":     { color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  icon: CheckCircle },
  "Good Fit":      { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   icon: Zap },
  "Mixed Fit":     { color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", icon: AlertTriangle },
  "High Friction": { color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: AlertTriangle },
};

const CHARGING_LABELS: Record<string, string> = {
  home: "Home charging",
  work: "Work charging",
  public: "Public charging only",
};

const CLIMATE_LABELS: Record<string, string> = {
  winter: "Often cold / winter",
  mild: "Mild year-round",
  hot: "Hot / warm climate",
};

const LONGEST_DAY_LABELS: Record<string, string> = {
  once_a_week: "Long day weekly",
  monthly_trip: "Long day monthly",
  rare_road_trip: "Rare long days",
};

export default function RoutineSharePageClient({ snapshot, createdAt, slug, inviteToken }: Props) {
  const { trackEvent } = useEventTracking();

  useEffect(() => {
    trackEvent("share_page_viewed", {
      share_slug: slug,
      flow: "evfit",
      source: inviteToken ? "invite" : "share_link",
    });
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const config = FIT_CONFIG[snapshot.fit_label] ?? FIT_CONFIG["Mixed Fit"];
  const FitIcon = config.icon;

  const vehicle = snapshot.vehicle
    ? [snapshot.vehicle.year, snapshot.vehicle.make, snapshot.vehicle.model].filter(Boolean).join(" ")
    : null;

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const ctaHref = inviteToken
    ? `/?invite_token=${inviteToken}&ref=coshopper`
    : `/?ref=${slug}`;

  const ctaLabel = inviteToken
    ? "Run my fit too"
    : "Check your own EV fit";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1">
            OFFO EV Fit Report
          </p>
          <h1 className="text-xl font-bold text-gray-900">
            {vehicle ? `${vehicle} EV Fit` : "EV Routine Check"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Shared on {formattedDate}</p>
        </div>

        {/* Fit verdict */}
        <div className={`rounded-xl border-2 ${config.border} ${config.bg} p-5 mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FitIcon className={`w-5 h-5 ${config.color}`} />
              <span className={`text-lg font-bold ${config.color}`}>{snapshot.fit_label}</span>
            </div>
            <span className={`text-2xl font-bold ${config.color}`}>{snapshot.score_0_100}/100</span>
          </div>
          {/* Score bar */}
          <div className="w-full bg-white/60 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                snapshot.score_0_100 >= 75 ? "bg-green-500" :
                snapshot.score_0_100 >= 50 ? "bg-blue-500" :
                snapshot.score_0_100 >= 30 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${snapshot.score_0_100}%` }}
            />
          </div>
        </div>

        {/* Routine summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Battery className="w-4 h-4 text-gray-500" />
            Routine snapshot
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div>
              <span className="text-gray-400 text-xs">Charging</span>
              <p className="font-medium">{CHARGING_LABELS[snapshot.routine_summary.charging_access] ?? snapshot.routine_summary.charging_access}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Climate</span>
              <p className="font-medium">{CLIMATE_LABELS[snapshot.routine_summary.climate] ?? snapshot.routine_summary.climate}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Long days</span>
              <p className="font-medium">{LONGEST_DAY_LABELS[snapshot.routine_summary.longest_day_pattern] ?? snapshot.routine_summary.longest_day_pattern}</p>
            </div>
            {snapshot.routine_summary.weekly_miles && (
              <div>
                <span className="text-gray-400 text-xs">Weekly miles</span>
                <p className="font-medium">{snapshot.routine_summary.weekly_miles} mi/wk</p>
              </div>
            )}
          </div>
        </div>

        {/* Stress flags */}
        {snapshot.stress_flags.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Friction points
            </h2>
            <ul className="space-y-2">
              {snapshot.stress_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className={`mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${
                    flag.severity === "high" ? "bg-red-100 text-red-700" :
                    flag.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{flag.severity}</span>
                  {flag.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What breaks first */}
        {snapshot.top_breakpoint && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" />
              What breaks first
            </h2>
            <p className="text-sm font-medium text-gray-800 mb-2">{snapshot.top_breakpoint.title}</p>
            {snapshot.top_breakpoint.plan_b && (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Plan B: </span>
                {snapshot.top_breakpoint.plan_b}
              </p>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-center text-xs text-gray-400 mt-4 mb-6">
          <p>by OFFO — EV Routine Fit Check</p>
        </div>

        {/* CTA */}
        <Link
          href={ctaHref}
          onClick={() => trackEvent("share_to_fit_started", {
            share_slug: slug,
            source: inviteToken ? "invite_page" : "share_page",
            flow: "evfit",
          })}
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>

      </div>
    </div>
  );
}
