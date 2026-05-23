"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, ArrowRight } from "lucide-react";

interface FunnelData {
  period: string;
  period_start: string;
  current: {
    receipts: number;
    dealer_views: number;
    inquiries: number;
    attributed_inquiries: number;
    new_subscriptions: number;
  };
  previous: {
    receipts: number;
    inquiries: number;
    new_subscriptions: number;
  };
}

type Period = "day" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  day: "24 hours",
  week: "7 days",
  month: "30 days",
};

function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "—";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function deltaColor(current: number, previous: number): string {
  if (previous === 0) return "text-white/30";
  return current >= previous ? "text-[#00d97e]" : "text-red-400";
}

function convRate(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

interface StatCardProps {
  label: string;
  value: number;
  prevValue?: number;
  sub?: string;
}

function StatCard({ label, value, prevValue, sub }: StatCardProps) {
  return (
    <div className="bg-[#161b22] rounded-xl border border-white/[0.08] px-5 py-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider truncate">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value.toLocaleString()}</p>
      {prevValue !== undefined && (
        <p className={`text-xs ${deltaColor(value, prevValue)}`}>
          {delta(value, prevValue)} vs prev period
        </p>
      )}
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminFunnelPage() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchFunnel = useCallback(async (key: string, p: Period) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/funnel?period=${p}`, {
        headers: { "x-api-key": key },
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Invalid API key" : "Failed to load funnel data");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setAuthed(true);
    fetchFunnel(apiKey, period);
  };

  useEffect(() => {
    if (authed) fetchFunnel(apiKey, period);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <form onSubmit={handleAuth} className="w-full max-w-xs space-y-3">
          <h1 className="text-lg font-bold text-white text-center mb-4">Funnel Dashboard</h1>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Admin API key"
            className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00d97e]/40"
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors"
          >
            View dashboard
          </button>
        </form>
      </div>
    );
  }

  const c = data?.current;

  return (
    <div className="min-h-screen bg-[#0d1117] px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Conversion Funnel</h1>
            <p className="text-xs text-white/40 mt-0.5">Receipts → Dealer views → Inquiries → Subscriptions</p>
          </div>
          <div className="flex items-center gap-2">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  period === p
                    ? "bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/30"
                    : "text-white/50 hover:text-white/80 border border-white/[0.08]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
            <button
              onClick={() => fetchFunnel(apiKey, period)}
              disabled={loading}
              className="p-1.5 text-white/40 hover:text-white/80 border border-white/[0.08] rounded-lg transition-colors"
              title="Refresh"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
          </div>
        )}

        {c && (
          <>
            {/* Funnel flow */}
            <div className="flex items-stretch gap-2 mb-8 overflow-x-auto pb-2">
              <StatCard
                label="Receipts"
                value={c.receipts}
                prevValue={data?.previous.receipts}
                sub="Analyses run"
              />
              <div className="flex items-center flex-shrink-0 px-1">
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="w-4 h-4 text-white/20" />
                  <span className="text-[10px] text-white/30">{convRate(c.dealer_views, c.receipts)}</span>
                </div>
              </div>
              <StatCard
                label="Dealer Views"
                value={c.dealer_views}
                sub="Profile page opens"
              />
              <div className="flex items-center flex-shrink-0 px-1">
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="w-4 h-4 text-white/20" />
                  <span className="text-[10px] text-white/30">{convRate(c.inquiries, c.dealer_views)}</span>
                </div>
              </div>
              <StatCard
                label="Inquiries"
                value={c.inquiries}
                prevValue={data?.previous.inquiries}
                sub="Buyers contacted dealers"
              />
              <div className="flex items-center flex-shrink-0 px-1">
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="w-4 h-4 text-white/20" />
                  <span className="text-[10px] text-white/30">{convRate(c.attributed_inquiries, c.inquiries)}</span>
                </div>
              </div>
              <StatCard
                label="Attributed"
                value={c.attributed_inquiries}
                sub="Inquiries with receipt source"
              />
              <div className="flex items-center flex-shrink-0 px-1">
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="w-4 h-4 text-white/20" />
                  <span className="text-[10px] text-white/30">{convRate(c.new_subscriptions, c.inquiries)}</span>
                </div>
              </div>
              <StatCard
                label="Subscriptions"
                value={c.new_subscriptions}
                prevValue={data?.previous.new_subscriptions}
                sub="New active dealers"
              />
            </div>

            {/* Summary row */}
            <div className="bg-[#161b22] rounded-xl border border-white/[0.08] px-5 py-4">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Funnel summary</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-white/40 text-xs">Receipt → Inquiry rate</p>
                  <p className="font-semibold text-white">{convRate(c.inquiries, c.receipts)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Inquiry → Subscription rate</p>
                  <p className="font-semibold text-white">{convRate(c.new_subscriptions, c.inquiries)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Attribution coverage</p>
                  <p className="font-semibold text-white">{convRate(c.attributed_inquiries, c.inquiries)}</p>
                  <p className="text-xs text-white/30">inquiries with receipt source</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
