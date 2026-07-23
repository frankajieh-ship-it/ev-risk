"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Car, Plus, ArrowRight, Loader2, Zap, GitCompare,
  TrendingUp, TrendingDown, Minus, FileText, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import VehicleImage from "@/components/VehicleImage";

interface GarageVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  nickname: string | null;
  trim: string | null;
  classification: { category?: string } | null;
  created_at: string;
  mileage?: number | null;
  location?: string | null;
  impact_score?: number | null;
  verdict?: string | null;
  listed_price?: number | null;
  market_avg?: number | null;
  vs_market?: number | null;
}

interface PaidReport {
  purchase_id: string;
  receipt_id: string;
  purchased_at: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  verdict: string | null;
}

interface ComparisonRecord {
  id: string;
  vehicle_a: string;
  vehicle_b: string;
  score_a?: number | null;
  score_b?: number | null;
  price_a?: number | null;
  price_b?: number | null;
  vs_market_a?: number | null;
  verdict_a?: string | null;
  created_at: string;
}

function vehicleLabel(v: GarageVehicle): string {
  return `${v.year || ""} ${v.make} ${v.model}`.trim();
}

function verdictBadge(verdict: string | null | undefined) {
  switch (verdict?.toLowerCase()) {
    case "good deal":  return { text: "Good Deal",  cls: "bg-[#00d97e]/15 text-[#00d97e] border-[#00d97e]/30" };
    case "fair":       return { text: "Fair",       cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
    case "overpriced": return { text: "Overpriced", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
    default:           return { text: verdict ?? "—", cls: "bg-white/[0.06] text-white/40 border-white/[0.10]" };
  }
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-[#00d97e]" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-white/40">{score}/100</span>
    </div>
  );
}

export default function WorkspaceDashboard() {
  const { session } = useAuth();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonRecord[]>([]);
  const [reports, setReports] = useState<PaidReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    Promise.all([
      fetch("/api/workspace/garage", { headers }).then((r) => r.json()),
      fetch("/api/workspace/comparisons?limit=7", { headers }).then((r) => r.json()).catch(() => ({ success: false })),
      fetch("/api/workspace/receipts", { headers }).then((r) => r.json()).catch(() => ({ success: false })),
    ])
      .then(([garageRes, compRes, receiptsRes]) => {
        if (garageRes.success) setVehicles(garageRes.vehicles.slice(0, 6));
        if (compRes.success && compRes.comparisons) setComparisons(compRes.comparisons);
        if (receiptsRes.success && receiptsRes.reports) setReports(receiptsRes.reports.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm text-white/40 mt-0.5">Your EV analysis dashboard</p>
        </div>
        <Link
          href="/receipt"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00c970] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Analysis
        </Link>
      </div>

      {/* ── Vehicle list ─────────────────────────────────────── */}
      <section className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold text-white/80">Garage</h2>
            <span className="text-xs text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded">{vehicles.length}</span>
          </div>
          <Link href="/workspace/garage" className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {vehicles.length === 0 ? (
          <div className="p-10 text-center">
            <Car className="w-8 h-8 mx-auto mb-2 text-white/10" />
            <p className="text-sm text-white/30">No vehicles yet.</p>
            <Link href="/workspace/garage" className="inline-block mt-3 text-xs text-[#00d97e] hover:underline">Add your first vehicle →</Link>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {vehicles.map((v) => {
              const badge = verdictBadge(v.verdict);
              return (
                <Link
                  key={v.id}
                  href="/workspace/garage"
                  className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.05]">
                    <VehicleImage
                      make={v.make} model={v.model} year={v.year ?? undefined}
                      className="w-full h-full" imgClassName="w-full h-full object-cover"
                    />
                  </div>

                  {/* Vehicle info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{v.nickname || vehicleLabel(v)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.impact_score != null && <ScoreBar score={v.impact_score} />}
                      {v.mileage != null && (
                        <span className="text-xs text-white/30">{v.mileage.toLocaleString()} mi</span>
                      )}
                      {v.location && <span className="text-xs text-white/30">· {v.location}</span>}
                    </div>
                  </div>

                  {/* Price + verdict */}
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    {v.listed_price != null && (
                      <p className="text-sm font-bold text-white">${v.listed_price.toLocaleString()}</p>
                    )}
                    {v.market_avg != null && (
                      <p className="text-xs text-white/30">${v.market_avg.toLocaleString()}</p>
                    )}
                    {v.vs_market != null && (
                      <p className={`text-xs font-semibold ${v.vs_market < 0 ? "text-[#00d97e]" : "text-red-400"}`}>
                        {v.vs_market < 0 ? "-" : "+"}${Math.abs(v.vs_market).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Verdict badge */}
                  <div className="flex-shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>
                      {badge.text}
                    </span>
                    {v.vs_market != null && (
                      <p className={`text-[10px] text-center mt-1 font-semibold ${v.vs_market < 0 ? "text-[#00d97e]" : "text-red-400"}`}>
                        {v.vs_market < 0
                          ? <span className="flex items-center justify-center gap-0.5"><TrendingDown className="w-3 h-3 inline" />${Math.abs(v.vs_market).toLocaleString()}</span>
                          : <span className="flex items-center justify-center gap-0.5"><TrendingUp className="w-3 h-3 inline" />${Math.abs(v.vs_market).toLocaleString()}</span>
                        }
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── My Reports ──────────────────────────────────────── */}
      {reports.length > 0 && (
        <section className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-white/40" />
              <h2 className="font-semibold text-white/80">My Reports</h2>
              <span className="text-xs text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded">{reports.length}</span>
            </div>
            <Link href="/workspace/receipts" className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {reports.map((r) => {
              const label = [r.year, r.make, r.model].filter(Boolean).join(" ") || "Unknown Vehicle";
              const badge = verdictBadge(r.verdict);
              return (
                <Link
                  key={r.purchase_id}
                  href={`/receipt?id=${r.receipt_id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-white/20" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white/80 truncate">{label}</p>
                      {r.price != null && (
                        <p className="text-xs text-white/30">${r.price.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.verdict && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>
                    )}
                    <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-[#00d97e] transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recent Comparisons ───────────────────────────────── */}
      <section className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold text-white/80">Recent Comparisons</h2>
            {comparisons.length > 0 && (
              <span className="text-xs text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded">{comparisons.length}</span>
            )}
          </div>
          <button className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
            <Zap className="w-3 h-3" /> Export
          </button>
        </div>

        {comparisons.length === 0 ? (
          <div className="p-10 text-center">
            <GitCompare className="w-8 h-8 mx-auto mb-2 text-white/10" />
            <p className="text-sm text-white/30">No comparisons yet.</p>
            <Link href="/compare" className="inline-block mt-3 text-xs text-[#00d97e] hover:underline">Compare vehicles →</Link>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-2 border-b border-white/[0.05]">
              {["Vehicle", "Date", "Price", "Score", "vs Market", "Verdict"].map((h) => (
                <span key={h} className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {comparisons.map((c) => {
                const badge = verdictBadge(c.verdict_a);
                const date = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                return (
                  <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-white/[0.03] transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm text-white/80 truncate">{c.vehicle_a}</p>
                      {c.vehicle_b && <p className="text-xs text-white/30 truncate">vs {c.vehicle_b}</p>}
                    </div>
                    <span className="text-xs text-white/40 whitespace-nowrap">{date}</span>
                    <span className="text-sm font-medium text-white/70">
                      {c.price_a != null ? `$${c.price_a.toLocaleString()}` : "—"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {c.score_a != null && (
                        <>
                          <div className="w-8 h-1 rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-[#00d97e]" style={{ width: `${c.score_a}%` }} />
                          </div>
                          <span className="text-xs text-white/50">{c.score_a}</span>
                        </>
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${
                      c.vs_market_a == null ? "text-white/30"
                      : c.vs_market_a < 0 ? "text-[#00d97e]"
                      : "text-red-400"
                    }`}>
                      {c.vs_market_a != null
                        ? `${c.vs_market_a < 0 ? "-" : "+"}$${Math.abs(c.vs_market_a).toLocaleString()}`
                        : "—"}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Quick actions ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/workspace/garage"
          className="flex items-center gap-3 p-4 bg-[#161b22] rounded-2xl border border-white/[0.08] hover:border-white/[0.18] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Plus className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-white/80">Add a Vehicle</p>
            <p className="text-xs text-white/40">Add by URL, VIN or make/model</p>
          </div>
        </Link>

        <Link
          href="/compare"
          className="flex items-center gap-3 p-4 bg-[#161b22] rounded-2xl border border-white/[0.08] hover:border-white/[0.18] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="font-medium text-white/80">Compare Vehicles</p>
            <p className="text-xs text-white/40">Side-by-side EV comparison</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
