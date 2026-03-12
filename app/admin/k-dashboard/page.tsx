"use client";

/**
 * K-Factor Dashboard
 *
 * /admin/k-dashboard
 *
 * Tracks viral loop metrics: share links, co-shopper invites, K_buyer.
 * Protected by ADMIN_API_KEY bearer token (shared with /admin).
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

interface KSummary {
  active_users: number;
  share_links_created: number;
  shares_per_user: number;
  invites_created: number;
  invites_opened: number;
  invites_converted: number;
  invites_per_user: number;
  open_rate_pct: number;
  conversion_rate_pct: number;
  k_buyer: number;
}

interface KData {
  period: string;
  window_start: string;
  summary: KSummary;
  daily: {
    shares: Record<string, number>;
    invites: Record<string, number>;
  };
}

type Period = "last_7_days" | "last_30_days";

function StatCard({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${highlight ? "text-blue-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function FunnelRow({ label, value, pct, color }: { label: string; value: number; pct?: number; color: string }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="w-32 text-sm text-gray-600 font-medium">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
      {pct !== undefined && (
        <div className="ml-auto text-sm text-gray-400">{pct.toFixed(1)}%</div>
      )}
    </div>
  );
}

export default function KDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("last_7_days");
  const [data, setData] = useState<KData | null>(null);

  const fetchMetrics = useCallback(async (key: string, selectedPeriod: Period = period) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/k-metrics?period=${selectedPeriod}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 401) {
        setError("Invalid admin key");
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch metrics");
      const json = await res.json();
      setData(json);
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_api_key", key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_api_key");
    if (stored) {
      setApiKey(stored);
      fetchMetrics(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMetrics(apiKey);
  };

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    const stored = sessionStorage.getItem("admin_api_key");
    if (stored) fetchMetrics(stored, p);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">K-Factor Dashboard</h1>
          <p className="text-gray-500 text-sm mb-6">Viral loop metrics — share, invite, convert</p>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admin key..."
                required
              />
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400">
              {loading ? "Loading..." : "Access Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Admin
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">K-Factor Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
              {(["last_7_days", "last_30_days"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${period === p ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {p === "last_7_days" ? "7 days" : "30 days"}
                </button>
              ))}
            </div>
            <button
              onClick={() => { const k = sessionStorage.getItem("admin_api_key"); if (k) fetchMetrics(k); }}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        {s && (
          <>
            {/* K_buyer highlight */}
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white">
              <p className="text-blue-200 text-sm font-medium mb-1">K_buyer (viral coefficient)</p>
              <p className="text-5xl font-bold">{s.k_buyer.toFixed(3)}</p>
              <p className="text-blue-200 text-xs mt-2">= {s.invites_per_user} invites/user × {s.conversion_rate_pct}% conversion</p>
              <p className="text-blue-100 text-xs mt-1">Target: ≥ 0.3 to build viral growth loop</p>
            </div>

            {/* Top stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard label="Active Users" value={s.active_users.toLocaleString()} sub="fit completions" />
              <StatCard label="Share Links" value={s.share_links_created.toLocaleString()} sub={`${s.shares_per_user} per user`} />
              <StatCard label="Invites Sent" value={s.invites_created.toLocaleString()} sub={`${s.invites_per_user} per user`} />
              <StatCard label="Conversions" value={s.invites_converted.toLocaleString()} sub="invite → fit" highlight />
            </div>

            {/* Invite funnel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Invite Funnel</h2>
              <FunnelRow label="Invites Created" value={s.invites_created} color="text-gray-900" />
              <FunnelRow
                label="Opened"
                value={s.invites_opened}
                pct={s.invites_created > 0 ? (s.invites_opened / s.invites_created) * 100 : 0}
                color="text-blue-700"
              />
              <FunnelRow
                label="Converted"
                value={s.invites_converted}
                pct={s.invites_opened > 0 ? (s.invites_converted / s.invites_opened) * 100 : 0}
                color="text-green-700"
              />
              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Open rate: </span>
                  <span className="font-semibold text-gray-800">{s.open_rate_pct}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Conv. rate: </span>
                  <span className="font-semibold text-gray-800">{s.conversion_rate_pct}%</span>
                </div>
              </div>
            </div>

            {/* Daily activity */}
            {data?.daily && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Daily Activity</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium text-right">Shares</th>
                        <th className="pb-2 font-medium text-right">Invites</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set([
                        ...Object.keys(data.daily.shares),
                        ...Object.keys(data.daily.invites),
                      ])).sort().reverse().slice(0, 30).map((day) => (
                        <tr key={day} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 text-gray-600">{day}</td>
                          <td className="py-2 text-right font-medium text-blue-700">{data.daily.shares[day] || 0}</td>
                          <td className="py-2 text-right font-medium text-indigo-700">{data.daily.invites[day] || 0}</td>
                        </tr>
                      ))}
                      {Object.keys(data.daily.shares).length === 0 && Object.keys(data.daily.invites).length === 0 && (
                        <tr><td colSpan={3} className="py-6 text-center text-gray-400 text-sm">No activity yet in this window</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
