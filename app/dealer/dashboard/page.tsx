"use client";

/**
 * Dealer Demand Analytics Dashboard
 *
 * Shows high-intent buyer demand signals, top researched models,
 * inventory match counts, conversion funnel, anonymized buyer profiles,
 * and a geo heat map — all scoped to the authenticated dealer.
 */

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Car, MapPin, Users, AlertCircle, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopModel {
  make: string;
  model: string;
  count: number;
  in_inventory: boolean;
}

interface Funnel {
  views: number;
  reports: number;
  receipts: number;
}

interface DashboardData {
  dealership_name: string | null;
  metro: string | null;
  weekly_high_intent: number;
  top_models: TopModel[];
  inventory_match_count: number;
  avg_days_on_lot: number | null;
  funnel: Funnel;
  computed_at: string;
}

interface ChatSignal {
  text: string;
  confidence: number;
  category: string;
  count_mentions: number;
}

interface BuyerProfile {
  profile_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  home_charging: boolean | null;
  weekly_miles: number | null;
  fit_score: number | null;
  geo_metro: string | null;
  researched_at: string;
  // Phase 6
  inventory_match_score: number | null;
  signal_strength: "high" | "medium" | "low" | "none" | null;
  ai_chat_signals: ChatSignal[];
  buyer_type_tags: string[];
  anonymized_summary: string | null;
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

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-sm text-white/50 mt-1">{label}</p>
        {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SignalBadge({ strength }: { strength: "high" | "medium" | "low" | "none" | null }) {
  if (!strength || strength === "none") return <span className="text-white/30 text-xs">—</span>;
  const config = {
    high: { label: "High", color: "bg-purple-500/15 text-purple-400" },
    medium: { label: "Med", color: "bg-blue-500/15 text-blue-400" },
    low: { label: "Low", color: "bg-white/[0.08] text-white/40" },
  }[strength];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 w-fit ${config.color}`}>
      <Zap className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}

function MatchScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-white/30 text-xs">—</span>;
  const color =
    score >= 75
      ? "bg-[#00d97e]/15 text-[#00d97e]"
      : score >= 55
        ? "bg-blue-500/15 text-blue-400"
        : score >= 35
          ? "bg-amber-500/15 text-amber-400"
          : "bg-white/[0.08] text-white/40";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
      {score}
    </span>
  );
}

function SignalsDrawer({ signals, profileId }: { signals: ChatSignal[]; profileId: string }) {
  const [open, setOpen] = useState(false);
  if (!signals.length) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? "Hide" : "Show"} signals ({signals.length})
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {signals.map((sig, i) => (
            <li key={`${profileId}-sig-${i}`} className="text-xs text-white/50 flex items-start gap-1.5">
              <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>
                <span className="font-medium capitalize text-white/70">{sig.category}</span>
                {" · "}
                {sig.text}
                <span className="text-white/30 ml-1">({sig.confidence}%)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FitBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-white/30 text-xs">—</span>;
  const label =
    score >= 80 ? "Great Fit" : score >= 65 ? "Good Fit" : score >= 45 ? "Mixed Fit" : "Low Fit";
  const color =
    score >= 80
      ? "bg-[#00d97e]/15 text-[#00d97e]"
      : score >= 65
        ? "bg-blue-500/15 text-blue-400"
        : score >= 45
          ? "bg-amber-500/15 text-amber-400"
          : "bg-red-500/15 text-red-400";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
      {score} · {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DealerDemandDashboard() {
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
      fetch("/api/dealer/dashboard", { headers }).then((r) => r.json()),
      fetch("/api/dealer/buyer-profiles", { headers }).then((r) => r.json()),
      fetch("/api/dealer/geo-heatmap", { headers }).then((r) => r.json()),
    ])
      .then(([dash, bp, hm]) => {
        if (dash.error) throw new Error(dash.error);
        setDashboard(dash);
        setProfiles(bp.profiles || []);
        setHeatmap(hm.points || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
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

  const funnelTotal = dashboard.funnel.views || 1;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Demand Analytics</h1>
        {dashboard.metro && (
          <p className="text-sm text-white/50 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Scoped to {dashboard.metro}
          </p>
        )}
        <p className="text-xs text-white/30 mt-0.5">
          Updated {new Date(dashboard.computed_at).toLocaleString()}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="High-Intent Views (7d)"
          value={dashboard.weekly_high_intent}
          sub="Reports + receipts in your market"
          icon={TrendingUp}
          accent="bg-[#00d97e]/80"
        />
        <KpiCard
          label="Inventory Matches"
          value={dashboard.inventory_match_count}
          sub="Models researched that you stock"
          icon={Car}
          accent="bg-blue-500/80"
        />
        <KpiCard
          label="Avg Days on Lot"
          value={dashboard.avg_days_on_lot != null ? `${dashboard.avg_days_on_lot}d` : "—"}
          sub="Active inventory"
          icon={Car}
          accent="bg-amber-500/80"
        />
        <KpiCard
          label="Buyer Profiles"
          value={profiles.length}
          sub="Matched to your inventory (60d)"
          icon={Users}
          accent="bg-purple-500/80"
        />
      </div>

      {/* Top Models + Funnel */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Models */}
        <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-5">
          <h2 className="text-base font-semibold text-white mb-4">
            Top Models Researched (30d)
          </h2>
          {dashboard.top_models.length === 0 ? (
            <p className="text-sm text-white/30">
              No data yet — geo enrichment activates for new events.
            </p>
          ) : (
            <ol className="space-y-3">
              {dashboard.top_models.map((tm, i) => (
                <li key={`${tm.make}-${tm.model}`} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/[0.08] text-xs font-semibold text-white/40 flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {tm.make} {tm.model}
                    </p>
                    <p className="text-xs text-white/30">{tm.count} research events</p>
                  </div>
                  {tm.in_inventory && (
                    <span className="text-xs px-1.5 py-0.5 bg-[#00d97e]/15 text-[#00d97e] rounded font-medium shrink-0">
                      In stock
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-5">
          <h2 className="text-base font-semibold text-white mb-4">
            Buyer Funnel (30d · all markets)
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "Report Views",
                value: dashboard.funnel.views,
                pct: 100,
                color: "bg-blue-500",
              },
              {
                label: "Routine Completions",
                value: dashboard.funnel.reports,
                pct: Math.round((dashboard.funnel.reports / funnelTotal) * 100),
                color: "bg-[#00d97e]",
              },
              {
                label: "Receipt Analyses",
                value: dashboard.funnel.receipts,
                pct: Math.round((dashboard.funnel.receipts / funnelTotal) * 100),
                color: "bg-purple-500",
              },
            ].map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>{step.label}</span>
                  <span className="font-medium text-white/70">{step.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-white/[0.08] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${step.color} transition-all`}
                    style={{ width: `${Math.min(step.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Geo Heat Map */}
      {heatmap.length > 0 && (
        <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-5">
          <h2 className="text-base font-semibold text-white mb-4">
            Demand by Metro (30d · top {Math.min(heatmap.length, 20)} markets)
          </h2>
          <div className="space-y-2">
            {heatmap.slice(0, 20).map((pt) => {
              const maxCount = heatmap[0].count || 1;
              const pct = Math.round((pt.count / maxCount) * 100);
              return (
                <div key={pt.metro} className="flex items-center gap-3">
                  <span className="text-sm text-white/70 w-40 truncate shrink-0">{pt.metro}</span>
                  <div className="flex-1 bg-white/[0.08] rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-[#00d97e]/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/30 w-8 text-right shrink-0">{pt.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Anonymized Buyer Profiles */}
      <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-base font-semibold text-white">
            Matched Buyer Profiles (60d)
          </h2>
          <p className="text-xs text-white/30 mt-0.5">
            Anonymized — no personal information is shown
          </p>
        </div>
        {profiles.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-white/30">
            No buyer profiles matched your inventory yet.
            <br />
            Profiles appear when buyers research vehicles you stock.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03] text-xs text-white/40 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Vehicle</th>
                  <th className="px-5 py-3 text-left">Match</th>
                  <th className="px-5 py-3 text-left">AI Signals</th>
                  <th className="px-5 py-3 text-left">Fit Score</th>
                  <th className="px-5 py-3 text-left">Charging</th>
                  <th className="px-5 py-3 text-left hidden md:table-cell">Weekly Miles</th>
                  <th className="px-5 py-3 text-left hidden lg:table-cell">Researched</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.profile_id}
                    className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-white">
                          {p.vehicle_year ? `${p.vehicle_year} ` : ""}{p.vehicle_make} {p.vehicle_model}
                        </p>
                        {p.anonymized_summary && (
                          <p className="text-xs text-white/30 mt-0.5 max-w-xs truncate">{p.anonymized_summary}</p>
                        )}
                        {p.buyer_type_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.buyer_type_tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs px-1 py-0.5 bg-white/[0.08] text-white/40 rounded">
                                {tag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <MatchScoreBadge score={p.inventory_match_score} />
                    </td>
                    <td className="px-5 py-3">
                      <div>
                        <SignalBadge strength={p.signal_strength} />
                        <SignalsDrawer signals={p.ai_chat_signals} profileId={p.profile_id} />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <FitBadge score={p.fit_score} />
                    </td>
                    <td className="px-5 py-3 text-white/50">
                      {p.home_charging == null
                        ? "—"
                        : p.home_charging
                          ? "Home"
                          : "Public"}
                    </td>
                    <td className="px-5 py-3 text-white/50 hidden md:table-cell">
                      {p.weekly_miles != null ? `${p.weekly_miles} mi` : "—"}
                    </td>
                    <td className="px-5 py-3 text-white/30 text-xs hidden lg:table-cell">
                      {new Date(p.researched_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
