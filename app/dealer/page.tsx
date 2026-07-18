/**
 * Dealer Dashboard — OFFOLab dark design
 *
 * KPI cards with deltas, buyer location heat map, high-intent buyers panel.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Users, Bookmark, Eye, Car, TrendingUp, TrendingDown,
  Zap, MapPin, AlertCircle, CheckCircle2, Circle, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  dealership_name: string | null;
  metro: string | null;
  weekly_high_intent: number;
  delta_high_intent: string | null;
  inventory_match_count: number;
  avg_days_on_lot: number | null;
  funnel: { views: number; reports: number; receipts: number };
  delta_views_pct: string | null;
  inventory_count: number;
  subscription_tier: string | null;
  subscription_status: string | null;
  computed_at: string;
}

interface BuyerProfile {
  profile_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  fit_score: number | null;
  geo_metro: string | null;
  signal_strength: "high" | "medium" | "low" | "none" | null;
  inventory_match_score: number | null;
}

interface HeatmapPoint {
  metro: string;
  state: string;
  lat: number;
  lon: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreBadgeCls(score: number | null): string {
  if (score == null) return "bg-white/[0.08] text-white/40";
  if (score >= 80) return "bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/30";
  if (score >= 65) return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
  if (score >= 45) return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
  return "bg-red-500/15 text-red-400 border border-red-500/30";
}

function SignalBadge({ strength }: { strength: BuyerProfile["signal_strength"] }) {
  if (!strength || strength === "none") return null;
  const cfg: Record<string, { label: string; cls: string }> = {
    high:   { label: "High", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
    medium: { label: "Med",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30"      },
    low:    { label: "Low",  cls: "bg-white/[0.06] text-white/40 border-white/[0.10]"    },
  };
  const c = cfg[strength];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${c.cls}`}>
      <Zap className="w-2.5 h-2.5" />
      {c.label}
    </span>
  );
}

/** Derive a short display tag from profile_id (e.g. "A1F3" → "A1") */
function buyerTag(profileId: string): string {
  const hex = profileId.replace(/-/g, "").toUpperCase();
  return `#${hex.slice(0, 4)}`;
}

/** Derive avatar initials from profile_id */
function avatarInitials(profileId: string): string {
  const hex = profileId.replace(/-/g, "").toUpperCase();
  return hex.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Geo Heat Map
// ---------------------------------------------------------------------------

function GeoHeatMap({ points }: { points: HeatmapPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-white/30 text-sm">
        No location data yet
      </div>
    );
  }

  // If fewer than 3 points, show bar chart fallback
  if (points.length < 3) {
    const max = points[0]?.count || 1;
    return (
      <div className="space-y-2 p-2">
        {points.map((pt) => (
          <div key={pt.metro} className="flex items-center gap-3">
            <span className="text-xs text-white/60 w-32 truncate shrink-0">{pt.metro}</span>
            <div className="flex-1 bg-white/[0.06] rounded-full h-1.5">
              <div
                className="h-full rounded-full bg-[#00d97e]"
                style={{ width: `${Math.round((pt.count / max) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-white/40 w-6 text-right shrink-0">{pt.count}</span>
          </div>
        ))}
      </div>
    );
  }

  // US bounding box
  const LON_MIN = -125, LON_MAX = -66;
  const LAT_MIN = 24,   LAT_MAX = 49;
  const top20 = points.slice(0, 20);
  const maxCount = top20[0]?.count || 1;

  return (
    <div className="relative w-full h-56 rounded-xl overflow-hidden bg-[#0d1117] border border-white/[0.06]">
      {/* subtle grid lines */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {top20.map((pt) => {
        const x = ((pt.lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100;
        const y = ((LAT_MAX - pt.lat) / (LAT_MAX - LAT_MIN)) * 100;
        const size = Math.max(8, Math.round((pt.count / maxCount) * 22));
        const opacity = 0.4 + (pt.count / maxCount) * 0.6;
        return (
          <div
            key={pt.metro}
            className="absolute flex flex-col items-center gap-0.5"
            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
          >
            {/* glowing dot */}
            <div
              style={{
                width: size,
                height: size,
                opacity,
                boxShadow: `0 0 ${size * 2}px ${size}px rgba(0,217,126,0.25)`,
              }}
              className="rounded-full bg-[#00d97e]"
            />
            {/* city label */}
            <span className="text-[9px] font-semibold text-[#00d97e]/80 bg-[#0d1117]/80 px-1 rounded whitespace-nowrap">
              {pt.metro.split(",")[0]} {pt.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan Badge
// ---------------------------------------------------------------------------

interface PlanBadgeProps {
  tier: string | null;
  status: string | null;
}

function PlanBadge({ tier, status }: PlanBadgeProps) {
  if (!status || status === "pending_payment" || status === "canceled" || status === "inactive") {
    return null;
  }

  const tierLabel = tier
    ? tier.charAt(0).toUpperCase() + tier.slice(1)
    : null;

  const label = status === "trial"
    ? "Free Trial"
    : tierLabel
    ? `${tierLabel} Plan Active`
    : "Plan Active";

  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00d97e]/15 text-[#00d97e] text-xs font-semibold border border-[#00d97e]/30 shrink-0">
      <Zap className="w-3 h-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  icon: React.ElementType;
  iconCls: string;
}

function KpiCard({ label, value, delta, deltaPositive, icon: Icon, iconCls }: KpiCardProps) {
  return (
    <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconCls}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        {delta && (
          <p className={`flex items-center gap-0.5 text-xs font-semibold mt-1 ${deltaPositive ? "text-[#00d97e]" : "text-red-400"}`}>
            {deltaPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding Checklist
// ---------------------------------------------------------------------------

interface ChecklistProps {
  hasInventory: boolean;
  dealershipName: string | null;
}

function OnboardingChecklist({ hasInventory, dealershipName }: ChecklistProps) {
  const [badgeVisited] = useState(() => {
    try { return !!localStorage.getItem("dealer_badge_visited"); } catch { return false; }
  });
  const hasProfile = !!dealershipName;

  const steps = [
    {
      done: hasInventory,
      label: "Add your first vehicle",
      desc: "Upload inventory so buyers can be matched to your lot",
      href: "/dealer/inventory",
      cta: "Add inventory",
    },
    {
      done: hasProfile,
      label: "Complete your dealer profile",
      desc: "Add phone, website, and description to build buyer trust",
      href: "/dealer/profile",
      cta: "Edit profile",
    },
    {
      done: badgeVisited,
      label: "Copy your verified badge",
      desc: "Embed the OFFO badge on your website to signal trust",
      href: "/dealer/badge",
      cta: "Get embed code",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  if (completedCount === steps.length) return null;

  return (
    <div className="bg-[#161b22] border border-[#00d97e]/20 rounded-2xl p-5 mb-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Getting started</h2>
          <p className="text-xs text-white/40 mt-0.5">
            {completedCount} of {steps.length} steps complete — finish to start seeing buyer matches
          </p>
        </div>
        <span className="text-xs font-semibold text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-full px-2.5 py-1">
          {completedCount}/{steps.length}
        </span>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 border transition-colors ${
              step.done
                ? "border-white/[0.05] bg-white/[0.02] opacity-60"
                : "border-white/[0.07] bg-white/[0.03]"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-[#00d97e] flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${step.done ? "text-white/40 line-through" : "text-white/80"}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-white/30 mt-0.5 truncate">{step.desc}</p>
              )}
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="flex items-center gap-1 text-xs font-semibold text-[#00d97e] hover:text-[#00f090] transition-colors flex-shrink-0"
              >
                {step.cta}
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DealerDashboard() {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [profiles, setProfiles] = useState<BuyerProfile[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    Promise.all([
      fetch("/api/dealer/dashboard",      { headers }).then((r) => r.json()),
      fetch("/api/dealer/buyer-profiles", { headers }).then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/dealer/geo-heatmap",    { headers }).then((r) => r.json()).catch(() => ({ points: [] })),
    ])
      .then(([dash, bp, hm]) => {
        if (dash.error) throw new Error(dash.error);
        setDashboard(dash);
        setProfiles(bp.profiles || []);
        setHeatmap(hm.points || []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0" />
        {error || "Failed to load dashboard data."}
      </div>
    );
  }

  const topProfiles = [...profiles]
    .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0))
    .slice(0, 8);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dealer Dashboard</h1>
          {(dashboard.dealership_name || dashboard.metro) && (
            <p className="text-sm text-white/40 mt-0.5 flex items-center gap-1">
              {dashboard.dealership_name && <span>{dashboard.dealership_name}</span>}
              {dashboard.dealership_name && dashboard.metro && <span className="text-white/20">·</span>}
              {dashboard.metro && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  {dashboard.metro}
                </span>
              )}
            </p>
          )}
        </div>
        <PlanBadge
          tier={dashboard.subscription_tier}
          status={dashboard.subscription_status}
        />
      </div>

      {/* Onboarding checklist — only shown when inventory is empty */}
      {dashboard.inventory_match_count === 0 && dashboard.weekly_high_intent === 0 && (
        <OnboardingChecklist
          hasInventory={dashboard.inventory_count > 0}
          dealershipName={dashboard.dealership_name}
        />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="High-Intent Buyers"
          value={dashboard.weekly_high_intent}
          delta={dashboard.delta_high_intent ?? undefined}
          deltaPositive={
            dashboard.delta_high_intent != null
              ? !dashboard.delta_high_intent.startsWith("-")
              : undefined
          }
          icon={Users}
          iconCls="bg-blue-500/15 text-blue-400"
        />
        <KpiCard
          label="Matched Inventory"
          value={dashboard.inventory_match_count}
          icon={Bookmark}
          iconCls="bg-[#00d97e]/15 text-[#00d97e]"
        />
        <KpiCard
          label="Listing Views 7d"
          value={dashboard.funnel.views.toLocaleString()}
          delta={dashboard.delta_views_pct ?? undefined}
          deltaPositive={
            dashboard.delta_views_pct != null
              ? !dashboard.delta_views_pct.startsWith("-")
              : undefined
          }
          icon={Eye}
          iconCls="bg-purple-500/15 text-purple-400"
        />
        <KpiCard
          label="Avg Days on Lot"
          value={dashboard.avg_days_on_lot != null ? `${dashboard.avg_days_on_lot}d` : "—"}
          icon={Car}
          iconCls="bg-amber-500/15 text-amber-400"
        />
      </div>

      {/* Heat map + Buyers panel side by side on large screens */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Buyer Location Heat Map */}
        <section className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08]">
            <h2 className="font-semibold text-white/80 text-sm">Buyer Location Heat Map</h2>
            <p className="text-xs text-white/30 mt-0.5">30-day demand by metro</p>
          </div>
          <div className="p-4">
            <GeoHeatMap points={heatmap} />
          </div>
        </section>

        {/* High-Intent Buyers */}
        <section className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white/80 text-sm">High-Intent Buyers</h2>
              <p className="text-xs text-white/30 mt-0.5">Matched to your inventory · 60d</p>
            </div>
            {topProfiles.length > 0 && (
              <span className="text-xs text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded">
                {topProfiles.length}
              </span>
            )}
          </div>

          {topProfiles.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Users className="w-7 h-7 mx-auto mb-2 text-white/10" />
              <p className="text-sm text-white/30">No matched buyers yet.</p>
              <p className="text-xs text-white/20 mt-1">Profiles appear when buyers research vehicles you stock.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {topProfiles.map((p) => (
                <li key={p.profile_id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#00d97e]">{avatarInitials(p.profile_id)}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white/70">Buyer {buyerTag(p.profile_id)}</span>
                      {p.fit_score != null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreBadgeCls(p.fit_score)}`}>
                          {p.fit_score}
                        </span>
                      )}
                      <SignalBadge strength={p.signal_strength} />
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 truncate">
                      {p.vehicle_year ? `${p.vehicle_year} ` : ""}{p.vehicle_make} {p.vehicle_model}
                      {p.geo_metro ? ` · ${p.geo_metro}` : ""}
                    </p>
                  </div>

                  {/* Match score */}
                  {p.inventory_match_score != null && (
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-white/30">match</p>
                      <p className={`text-xs font-bold ${p.inventory_match_score >= 75 ? "text-[#00d97e]" : p.inventory_match_score >= 50 ? "text-blue-400" : "text-white/40"}`}>
                        {p.inventory_match_score}%
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Updated at */}
      <p className="text-[11px] text-white/20 text-right">
        Updated {new Date(dashboard.computed_at).toLocaleString()}
      </p>
    </div>
  );
}
