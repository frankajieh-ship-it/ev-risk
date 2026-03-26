"use client";

/**
 * Dealer Demand Analytics Dashboard
 *
 * Shows high-intent buyer demand signals, top researched models,
 * inventory match counts, conversion funnel, anonymized buyer profiles,
 * and a geo heat map — all scoped to the authenticated dealer.
 */

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Car, MapPin, Users, AlertCircle } from "lucide-react";
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function FitBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-400 text-xs">—</span>;
  const label =
    score >= 80 ? "Great Fit" : score >= 65 ? "Good Fit" : score >= 45 ? "Mixed Fit" : "Low Fit";
  const color =
    score >= 80
      ? "bg-green-100 text-green-700"
      : score >= 65
        ? "bg-blue-100 text-blue-700"
        : score >= 45
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700";
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
        <Loader2 className="w-7 h-7 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl text-red-700 text-sm">
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
        <h1 className="text-2xl font-bold text-gray-900">Demand Analytics</h1>
        {dashboard.metro && (
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Scoped to {dashboard.metro}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
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
          accent="bg-green-500"
        />
        <KpiCard
          label="Inventory Matches"
          value={dashboard.inventory_match_count}
          sub="Models researched that you stock"
          icon={Car}
          accent="bg-blue-500"
        />
        <KpiCard
          label="Avg Days on Lot"
          value={dashboard.avg_days_on_lot != null ? `${dashboard.avg_days_on_lot}d` : "—"}
          sub="Active inventory"
          icon={Car}
          accent="bg-amber-500"
        />
        <KpiCard
          label="Buyer Profiles"
          value={profiles.length}
          sub="Matched to your inventory (60d)"
          icon={Users}
          accent="bg-purple-500"
        />
      </div>

      {/* Top Models + Funnel */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Models */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Top Models Researched (30d)
          </h2>
          {dashboard.top_models.length === 0 ? (
            <p className="text-sm text-gray-400">
              No data yet — geo enrichment activates for new events.
            </p>
          ) : (
            <ol className="space-y-3">
              {dashboard.top_models.map((tm, i) => (
                <li key={`${tm.make}-${tm.model}`} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {tm.make} {tm.model}
                    </p>
                    <p className="text-xs text-gray-400">{tm.count} research events</p>
                  </div>
                  {tm.in_inventory && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium shrink-0">
                      In stock
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Buyer Funnel (30d · all markets)
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "Report Views",
                value: dashboard.funnel.views,
                pct: 100,
                color: "bg-blue-400",
              },
              {
                label: "Routine Completions",
                value: dashboard.funnel.reports,
                pct: Math.round((dashboard.funnel.reports / funnelTotal) * 100),
                color: "bg-green-400",
              },
              {
                label: "Receipt Analyses",
                value: dashboard.funnel.receipts,
                pct: Math.round((dashboard.funnel.receipts / funnelTotal) * 100),
                color: "bg-purple-400",
              },
            ].map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{step.label}</span>
                  <span className="font-medium">{step.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Demand by Metro (30d · top {Math.min(heatmap.length, 20)} markets)
          </h2>
          <div className="space-y-2">
            {heatmap.slice(0, 20).map((pt) => {
              const maxCount = heatmap[0].count || 1;
              const pct = Math.round((pt.count / maxCount) * 100);
              return (
                <div key={pt.metro} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-40 truncate shrink-0">{pt.metro}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-green-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right shrink-0">{pt.count}</span>
                </div>
              );
            })}
          </div>
          {heatmap.length === 0 && (
            <p className="text-sm text-gray-400">
              Geo data populates as new events are tracked.
            </p>
          )}
        </div>
      )}

      {/* Anonymized Buyer Profiles */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Matched Buyer Profiles (60d)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Anonymized — no personal information is shown
          </p>
        </div>
        {profiles.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No buyer profiles matched your inventory yet.
            <br />
            Profiles appear when buyers research vehicles you stock.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Vehicle</th>
                  <th className="px-5 py-3 text-left">Year</th>
                  <th className="px-5 py-3 text-left">Fit Score</th>
                  <th className="px-5 py-3 text-left">Charging</th>
                  <th className="px-5 py-3 text-left">Weekly Miles</th>
                  <th className="px-5 py-3 text-left">Metro</th>
                  <th className="px-5 py-3 text-left">Researched</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.profile_id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {p.vehicle_make} {p.vehicle_model}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.vehicle_year || "—"}</td>
                    <td className="px-5 py-3">
                      <FitBadge score={p.fit_score} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.home_charging == null
                        ? "—"
                        : p.home_charging
                          ? "Home"
                          : "Public"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.weekly_miles != null ? `${p.weekly_miles} mi` : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.geo_metro || "—"}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
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
