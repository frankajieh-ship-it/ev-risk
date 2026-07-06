"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Car,
  Lock,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import type { VinAuditLiteResult } from "@/lib/vinaudit-client";

interface OwnershipHistoryCardProps {
  vin: string;
  receiptToken: string;
  isUnlocked: boolean;
  paymentsEnabled: boolean;
  onPaywallClick?: () => void;
  trackEvent: (name: string, data?: Record<string, unknown>) => void;
  onHistoryLoaded?: (result: VinAuditLiteResult) => void;
}

type FetchState = "idle" | "loading" | "done" | "error" | "not_configured";

export default function OwnershipHistoryCard({
  vin,
  receiptToken,
  isUnlocked,
  paymentsEnabled,
  onPaywallClick,
  trackEvent,
  onHistoryLoaded,
}: OwnershipHistoryCardProps) {
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [result, setResult] = useState<VinAuditLiteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accidentsOpen, setAccidentsOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const fetch_history = async (skipLoadingGuard = false) => {
    if (!skipLoadingGuard && fetchState === "loading") return;
    setFetchState("loading");
    trackEvent("ownership_history_requested", { vin });

    try {
      const res = await fetch("/api/vin/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin, receipt_token: receiptToken }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "not_configured") {
          setFetchState("not_configured");
          return;
        }
        setErrorMsg(data.error || "History lookup failed.");
        setFetchState("error");
        trackEvent("ownership_history_failed", { vin, error: data.error });
        return;
      }

      const historyResult = data as VinAuditLiteResult;
      setResult(historyResult);
      setFetchState("done");
      onHistoryLoaded?.(historyResult);
      trackEvent("ownership_history_loaded", {
        vin,
        theft: data.summary.theft_reported,
        salvage: data.summary.salvage_reported,
        accidents: data.summary.accident_count,
        sales: data.summary.sale_count,
      });
    } catch {
      setErrorMsg("Network error. Please try again.");
      setFetchState("error");
    }
  };

  // Auto-fetch when unlocked or payments are off — but only once receiptToken is ready.
  useEffect(() => {
    if (!receiptToken || (!isUnlocked && paymentsEnabled)) return;
    fetch_history(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin, receiptToken, isUnlocked, paymentsEnabled]);

  // Not configured — hide entirely, nothing useful to show
  if (fetchState === "not_configured") return null;

  // Paywall gate
  if (!isUnlocked && paymentsEnabled) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Ownership & Accident History</h3>
          <Lock className="w-3.5 h-3.5 text-white/30 ml-auto" />
        </div>
        <div className="p-5">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4 text-center space-y-3">
            <div className="flex justify-center gap-4 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Theft records</span>
              <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Accidents</span>
              <span className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-blue-400" /> Sale history</span>
            </div>
            <p className="text-xs text-white/30">NMVTIS-sourced — same data used by dealers and insurers.</p>
            <button
              onClick={onPaywallClick}
              className="w-full py-2.5 rounded-lg bg-[#00d97e] text-black text-sm font-semibold hover:bg-[#00c070] transition-colors"
            >
              Unlock everything · $9.99
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Idle — show fetch button
  if (fetchState === "idle") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Ownership & Accident History</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-white/50">
            Check NMVTIS records for theft, salvage title, accident history, and previous sale prices.
          </p>
          <button
            onClick={() => fetch_history()}
            className="w-full py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 hover:text-white text-sm font-medium transition-colors"
          >
            Run History Check
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (fetchState === "loading") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Ownership & Accident History</h3>
        </div>
        <div className="p-5 flex items-center justify-center gap-2 text-sm text-white/40">
          <Loader2 className="w-4 h-4 animate-spin text-[#00d97e]" />
          Checking records…
        </div>
      </div>
    );
  }

  // Error
  if (fetchState === "error") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Ownership & Accident History</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-white/40 italic">History lookup unavailable — try again later.</p>
          <button
            onClick={() => fetch_history()}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        </div>
      </div>
    );
  }

  // Done — show results
  if (!result) return null;
  const { summary, theft, salvage, accidents, sales } = result;
  const allClear = !summary.theft_reported && !summary.salvage_reported && summary.accident_count === 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-blue-400" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Ownership & Accident History</h3>
        {allClear && <ShieldCheck className="w-4 h-4 text-[#00d97e] ml-auto" />}
      </div>

      <div className="p-5 space-y-4">
        {/* Summary pills */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Pill label="Theft" value={summary.theft_reported ? "Reported" : "None found"} bad={summary.theft_reported} />
          <Pill label="Salvage" value={summary.salvage_reported ? "Reported" : "None found"} bad={summary.salvage_reported} />
          <Pill label="Accidents" value={summary.accident_count > 0 ? `${summary.accident_count} found` : "None found"} bad={summary.accident_count > 0} />
          <Pill label="Sale records" value={summary.sale_count > 0 ? `${summary.sale_count} found` : "None"} bad={false} />
        </div>

        {/* All clear */}
        {allClear && (
          <div className="flex items-center gap-2 text-sm text-[#00d97e]/80 bg-[#00d97e]/[0.06] border border-[#00d97e]/20 rounded-lg p-3">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            No theft, salvage, or accident records found for this VIN.
          </div>
        )}

        {/* Theft */}
        {theft.length > 0 && (
          <div className="bg-red-500/[0.08] border border-red-500/20 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Theft Records ({theft.length})
            </p>
            <ul className="space-y-1">
              {theft.map((r, i) => (
                <li key={i} className="text-sm text-red-300/80">
                  {[r.date, r.status].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Salvage */}
        {salvage.length > 0 && (
          <div className="bg-orange-500/[0.08] border border-orange-500/20 rounded-lg p-4">
            <p className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Salvage Records ({salvage.length})
            </p>
            <ul className="space-y-1">
              {salvage.map((r, i) => (
                <li key={i} className="text-sm text-orange-300/80">
                  {[r.date, r.source, r.disposition].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Accidents — collapsible */}
        {accidents.length > 0 && (
          <div className="border border-yellow-500/20 rounded-lg overflow-hidden">
            <button
              onClick={() => setAccidentsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-yellow-500/[0.06] text-left"
            >
              <span className="text-sm font-semibold text-yellow-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Accident Records ({accidents.length})
              </span>
              {accidentsOpen ? <ChevronUp className="w-4 h-4 text-yellow-500/60" /> : <ChevronDown className="w-4 h-4 text-yellow-500/60" />}
            </button>
            {accidentsOpen && (
              <ul className="divide-y divide-white/[0.05]">
                {accidents.map((r, i) => (
                  <li key={i} className="px-4 py-3 text-sm text-white/60 space-y-0.5">
                    {r.date && <p className="font-medium text-white/80">{r.date}</p>}
                    {r.severity && <p>Severity: <span className="text-yellow-400">{r.severity}</span></p>}
                    {r.airbags_deployed && <p>Airbags deployed: {r.airbags_deployed}</p>}
                    {r.damage_description && <p>{r.damage_description}</p>}
                    {r.source && <p className="text-white/30 text-xs">Source: {r.source}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Sales — collapsible */}
        {sales.length > 0 && (
          <div className="border border-white/[0.08] rounded-lg overflow-hidden">
            <button
              onClick={() => setSalesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] text-left"
            >
              <span className="text-sm font-semibold text-white/60 flex items-center gap-1.5">
                <Car className="w-4 h-4" /> Previous Sales ({sales.length})
              </span>
              {salesOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>
            {salesOpen && (
              <ul className="divide-y divide-white/[0.05]">
                {sales.map((r, i) => (
                  <li key={i} className="px-4 py-3 text-sm text-white/60 space-y-0.5">
                    {r.date && <p className="font-medium text-white/80">{r.date}</p>}
                    {r.price && <p>Price: <span className="font-semibold text-white/80">${Number(r.price).toLocaleString()}</span></p>}
                    {r.odometer && <p>Odometer: {Number(r.odometer).toLocaleString()} mi</p>}
                    {r.seller && <p className="text-white/30 text-xs">Seller: {r.seller}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-xs text-white/20">Data sourced from NMVTIS via VinAudit. Records may not capture all incidents.</p>
      </div>
    </div>
  );
}

function Pill({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 border ${bad ? "bg-red-500/[0.08] border-red-500/20" : "bg-white/[0.04] border-white/[0.08]"}`}>
      <p className="text-xs text-white/30 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${bad ? "text-red-400" : "text-white/70"}`}>{value}</p>
    </div>
  );
}
