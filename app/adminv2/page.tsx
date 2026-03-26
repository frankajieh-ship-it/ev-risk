"use client";

/**
 * Admin V2 — Unified Tracking Dashboard
 *
 * Pulls from /api/admin/summary (same API as /admin) with a cleaner layout:
 * — KPI row (receipts, reports, purchases, revenue)
 * — Funnel (views → routines → receipts → purchases)
 * — Top events table
 * — Dealer signups
 * — Extraction success/failure breakdown
 * — Recent live events feed
 * — Bot / human session breakdown
 *
 * Auth: ADMIN_API_KEY in localStorage "adminv2_key"
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, AlertCircle, TrendingUp, ShoppingCart,
  FileText, Users, Zap, Eye, BarChart2, Activity, ChevronDown, ChevronUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (subset of /api/admin/summary response)
// ---------------------------------------------------------------------------

interface SummaryData {
  window: { start: string; end: string; period: string };
  totals: {
    receipts: number;
    reports: number;
    purchases: number;
    revenue_cents: number;
    unique_visitors: number;
    human_sessions: number;
    bot_sessions: number;
  };
  funnel: {
    landing_views: number;
    routine_completions: number;
    report_views: number;
    receipt_generates: number;
    checkouts_started: number;
    purchases: number;
  };
  top_events: { name: string; count: number; unique_visitors: number }[];
  recent_events: {
    event_name: string;
    page_path: string | null;
    visitor_id: string | null;
    timestamp: string;
    event_data?: any;
  }[];
  extraction: {
    total: number;
    success: number;
    failure: number;
    top_domains: { domain: string; count: number; success_rate: number }[];
  };
  dealers: {
    total: number;
    new_this_period: number;
  };
  purchases_detail: {
    status: string;
    amount: number;
    currency: string;
    scenario_type: string;
    created_at: string;
  }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIODS = [
  { label: "Today", value: "day" },
  { label: "7 Days", value: "week" },
  { label: "30 Days", value: "last_30_days" },
  { label: "Month to Date", value: "month_to_date" },
];

function fmt(n: number) { return n?.toLocaleString() ?? "—"; }
function fmtDollars(cents: number) {
  return cents ? `$${(cents / 100).toFixed(2)}` : "$0";
}
function pct(num: number, den: number) {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}
function ago(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function KpiCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pctWidth = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-36 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${pctWidth}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-12 text-right shrink-0">{fmt(value)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminV2Page() {
  const [apiKey, setApiKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [period, setPeriod] = useState("last_30_days");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRawEvents, setShowRawEvents] = useState(false);

  // Persist key in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("adminv2_key");
    if (stored) setApiKey(stored);
  }, []);

  const fetchData = useCallback(async (key: string, p: string) => {
    if (!key) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/summary?period=${p}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 401) {
        setError("Invalid API key.");
        setLoading(false);
        return;
      }
      const raw = await res.json();
      if (!raw.success) { setError(raw.error || "Failed"); setLoading(false); return; }

      // Map raw summary → SummaryData shape
      // API returns: overview, revenue, evfit_funnel, session_classification,
      // extraction_health, extraction_domains, recent_events, dealers, purchases
      const r = raw;
      const paidPurchases: any[] = r.revenue?.buyer_pass
        ? Array.from({ length: r.revenue.buyer_pass.paid }, (_, i) => ({
            status: "paid",
            amount: 0,
            scenario_type: "evroutine",
            created_at: new Date().toISOString(),
          }))
        : [];
      const revenueCents = Math.round((r.revenue?.total_revenue ?? 0) * 100);

      // Build top_events from event name counts if available
      const topEvents: SummaryData["top_events"] = [];
      if (r.routine_engagement) {
        const emap: Record<string, number> = {
          "routine_result_viewed": r.evfit_funnel?.evfit_completed ?? 0,
          "receipt_generate": r.overview?.total_receipts ?? 0,
          "report_view": r.report_funnel?.form_submissions ?? 0,
          "checkout_started": r.revenue?.buyer_pass?.paid ?? 0,
          "shortlist_saved": r.evfit_funnel?.shortlist_saved ?? 0,
          "compare_started": r.evfit_funnel?.compare_started ?? 0,
          "garage_created": r.evfit_funnel?.garage_created ?? 0,
        };
        for (const [name, count] of Object.entries(emap)) {
          if (count > 0) topEvents.push({ name, count: count as number, unique_visitors: 0 });
        }
        topEvents.sort((a, b) => b.count - a.count);
      }

      const sc = r.session_classification || {};
      const exh = r.extraction_health || {};

      const mapped: SummaryData = {
        window: r.window || {},
        totals: {
          receipts: r.overview?.total_receipts ?? 0,
          reports: r.evfit_funnel?.evfit_completed ?? r.overview?.total_reports ?? 0,
          purchases: r.revenue?.buyer_pass?.paid ?? 0,
          revenue_cents: revenueCents,
          unique_visitors: r.visitors?.unique_visitors ?? 0,
          human_sessions: (sc.human ?? 0) + (sc.likely_human ?? 0),
          bot_sessions: (sc.suspicious ?? 0) + (sc.likely_bot ?? 0),
        },
        funnel: {
          landing_views: r.routine_engagement?.landing_view ?? 0,
          routine_completions: r.evfit_funnel?.evfit_completed ?? 0,
          report_views: r.report_funnel?.form_submissions ?? 0,
          receipt_generates: r.overview?.total_receipts ?? 0,
          checkouts_started: r.revenue?.buyer_pass?.paid ?? 0,
          purchases: r.revenue?.buyer_pass?.paid ?? 0,
        },
        top_events: topEvents,
        recent_events: r.recent_events ?? [],
        extraction: {
          total: exh.total_attempts ?? 0,
          success: exh.successful_extractions ?? 0,
          failure: (exh.total_attempts ?? 0) - (exh.successful_extractions ?? 0),
          top_domains: r.extraction_domains ?? [],
        },
        dealers: {
          total: r.dealers?.total ?? 0,
          new_this_period: r.dealers?.new_this_period ?? 0,
        },
        purchases_detail: paidPurchases,
      };

      setData(mapped);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) fetchData(apiKey, period);
  }, [apiKey, period, fetchData]);

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("adminv2_key", keyInput);
    setApiKey(keyInput);
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Admin Dashboard V2</h1>
          <p className="text-sm text-gray-500 mb-5">Enter your admin API key to continue.</p>
          <form onSubmit={handleKeySubmit} className="space-y-3">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk_admin_..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!keyInput}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-base font-bold text-gray-900">Admin V2</h1>
          {data?.window && (
            <span className="text-xs text-gray-400">
              {new Date(data.window.start).toLocaleDateString()} – {new Date(data.window.end).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchData(apiKey, period)}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => { localStorage.removeItem("adminv2_key"); setApiKey(""); }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
        )}

        {data && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Receipts" value={fmt(data.totals.receipts)} icon={FileText} color="bg-blue-500" sub="Analyses generated" />
              <KpiCard label="Routines / Reports" value={fmt(data.totals.reports)} icon={TrendingUp} color="bg-green-500" sub="EV fit checks" />
              <KpiCard label="Purchases" value={fmt(data.totals.purchases)} icon={ShoppingCart} color="bg-purple-500" sub={fmtDollars(data.totals.revenue_cents) + " revenue"} />
              <KpiCard label="Unique Visitors" value={fmt(data.totals.unique_visitors)} icon={Users} color="bg-amber-500" sub={`${fmt(data.totals.human_sessions)} human sessions`} />
            </div>

            {/* Funnel + Sessions */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Conversion Funnel */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" /> Conversion Funnel
                </h2>
                <div className="space-y-3">
                  {[
                    { label: "Landing Views", value: data.funnel.landing_views, color: "bg-blue-400" },
                    { label: "Routine Completions", value: data.funnel.routine_completions, color: "bg-blue-500" },
                    { label: "Report Views", value: data.funnel.report_views, color: "bg-indigo-400" },
                    { label: "Receipt Analyses", value: data.funnel.receipt_generates, color: "bg-purple-400" },
                    { label: "Checkouts Started", value: data.funnel.checkouts_started, color: "bg-amber-400" },
                    { label: "Purchases", value: data.funnel.purchases, color: "bg-green-500" },
                  ].map((step) => (
                    <FunnelBar
                      key={step.label}
                      label={step.label}
                      value={step.value}
                      max={data.funnel.landing_views || data.funnel.routine_completions || 1}
                      color={step.color}
                    />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <span>Routine → Report: {pct(data.funnel.report_views, data.funnel.routine_completions)}</span>
                  <span>Receipt → Purchase: {pct(data.funnel.purchases, data.funnel.receipt_generates)}</span>
                </div>
              </div>

              {/* Session Quality */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-500" /> Session Quality
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      label: "Human Sessions",
                      value: data.totals.human_sessions,
                      max: data.totals.human_sessions + data.totals.bot_sessions,
                      color: "bg-green-400",
                    },
                    {
                      label: "Bot / Suspicious",
                      value: data.totals.bot_sessions,
                      max: data.totals.human_sessions + data.totals.bot_sessions,
                      color: "bg-red-400",
                    },
                  ].map((s) => (
                    <FunnelBar key={s.label} label={s.label} value={s.value} max={s.max} color={s.color} />
                  ))}
                </div>

                {/* Extraction breakdown */}
                {data.extraction.total > 0 && (
                  <>
                    <div className="mt-5 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-600 mb-3">URL Extraction</p>
                      <div className="space-y-2">
                        <FunnelBar label="Total Attempts" value={data.extraction.total} max={data.extraction.total} color="bg-blue-300" />
                        <FunnelBar label="Succeeded" value={data.extraction.success} max={data.extraction.total} color="bg-green-400" />
                        <FunnelBar label="Failed" value={data.extraction.failure} max={data.extraction.total} color="bg-red-400" />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Success rate: {pct(data.extraction.success, data.extraction.total)}
                      </p>
                    </div>
                    {data.extraction.top_domains.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-medium text-gray-500">Top Domains</p>
                        {data.extraction.top_domains.slice(0, 5).map((d) => (
                          <div key={d.domain} className="flex justify-between text-xs text-gray-600">
                            <span className="truncate">{d.domain}</span>
                            <span className="text-gray-400 ml-2">{fmt(d.count)} · {pct(d.success_rate * d.count, d.count)} ok</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Top Events + Dealer Signups */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Events */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Top Events
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.top_events.slice(0, 12).map((ev) => (
                    <div key={ev.name} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-xs font-mono text-gray-700 truncate">{ev.name}</span>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-xs text-gray-400">{fmt(ev.unique_visitors)} uniq</span>
                        <span className="text-xs font-semibold text-gray-800 w-10 text-right">{fmt(ev.count)}</span>
                      </div>
                    </div>
                  ))}
                  {data.top_events.length === 0 && (
                    <p className="px-5 py-6 text-sm text-gray-400 text-center">No events in period.</p>
                  )}
                </div>
              </div>

              {/* Purchases + Dealers */}
              <div className="space-y-4">
                {/* Purchases */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-purple-500" /> Purchases
                    </h2>
                  </div>
                  {data.purchases_detail.filter((p) => p.status === "paid").length === 0 ? (
                    <p className="px-5 py-6 text-sm text-gray-400 text-center">No paid purchases in period.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {data.purchases_detail
                        .filter((p) => p.status === "paid")
                        .slice(0, 8)
                        .map((p, i) => (
                          <div key={i} className="flex items-center justify-between px-5 py-2.5">
                            <div>
                              <span className="text-xs font-medium text-gray-700">{p.scenario_type}</span>
                              <span className="text-xs text-gray-400 ml-2">{ago(p.created_at)}</span>
                            </div>
                            <span className="text-xs font-semibold text-green-700">
                              {fmtDollars(p.amount)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Dealer signups */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" /> Dealers
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{fmt(data.dealers.total)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Total dealerships</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{fmt(data.dealers.new_this_period)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">New this period</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Events Feed */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowRawEvents(!showRawEvents)}
                className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" /> Recent Live Events (last 50)
                </h2>
                {showRawEvents ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showRawEvents && (
                <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                  {data.recent_events.length === 0 && (
                    <p className="px-5 py-6 text-sm text-gray-400 text-center">No recent events.</p>
                  )}
                  {data.recent_events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-2.5">
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                        {ev.event_name}
                      </span>
                      <div className="flex-1 min-w-0">
                        {ev.page_path && (
                          <span className="text-xs text-gray-400 truncate block">{ev.page_path}</span>
                        )}
                        {ev.event_data && Object.keys(ev.event_data).filter(k => !k.startsWith("_")).length > 0 && (
                          <span className="text-xs text-gray-300 font-mono truncate block">
                            {JSON.stringify(
                              Object.fromEntries(
                                Object.entries(ev.event_data).filter(([k]) => !k.startsWith("_"))
                              )
                            ).slice(0, 80)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{ago(ev.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
