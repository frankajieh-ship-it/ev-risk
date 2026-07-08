"use client";

import { useState, useEffect, useRef } from "react";
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
export interface HistoryResult {
  success: boolean;
  summary: {
    theft_reported: boolean;
    salvage_reported: boolean;
    accident_count: number;
    sale_count: number;
    owner_type_breakdown?: { dealer: number; fleet_rental: number; private: number; unknown: number };
    possible_fleet_history?: boolean;
  };
  theft: Array<{ date?: string; status?: string }>;
  salvage: Array<{ date?: string; source?: string; disposition?: string }>;
  accidents: Array<{ date?: string; severity?: string; airbags_deployed?: string; damage_description?: string; source?: string }>;
  sales: Array<{ date?: string; price?: string; odometer?: string; seller?: string; owner_type?: "dealer" | "fleet_rental" | "private" | "unknown" }>;
}

interface OwnershipHistoryCardProps {
  vin: string;
  receiptToken: string;
  isUnlocked: boolean;
  paymentsEnabled: boolean;
  onPaywallClick?: () => void;
  trackEvent: (name: string, data?: Record<string, unknown>) => void;
  onHistoryLoaded?: (result: HistoryResult) => void;
}

type FetchState = "idle" | "loading" | "done" | "error";

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
  const fetchStateRef = useRef<FetchState>("idle");
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [accidentsOpen, setAccidentsOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const setFetchStateSync = (s: FetchState) => {
    fetchStateRef.current = s;
    setFetchState(s);
  };

  const fetch_history = async (autoFetch = false) => {
    if (fetchStateRef.current === "loading") return;
    if (autoFetch && fetchStateRef.current !== "idle") return;
    setFetchStateSync("loading");
    trackEvent("ownership_history_requested", { vin });

    try {
      const res = await fetch("/api/vin/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin, receipt_token: receiptToken }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // 403 unpaid = server confirmed not paid — show paywall, not error
        if (res.status === 403 && data.code === "unpaid") {
          setFetchStateSync("idle");
          return;
        }
        setFetchStateSync("error");
        trackEvent("ownership_history_failed", { vin, error: data.error });
        return;
      }

      const historyResult = data as HistoryResult;
      setResult(historyResult);
      setFetchStateSync("done");
      onHistoryLoaded?.(historyResult);
      trackEvent("ownership_history_loaded", {
        vin,
        theft: data.summary.theft_reported,
        salvage: data.summary.salvage_reported,
        accidents: data.summary.accident_count,
        sales: data.summary.sale_count,
      });
    } catch {
      setFetchStateSync("error");
    }
  };

  // Auto-fetch when unlocked or payments are off — but only once receiptToken is ready.
  // autoFetch=true means the call is skipped if already loading/done/errored.
  useEffect(() => {
    if (!receiptToken || (!isUnlocked && paymentsEnabled)) return;
    fetch_history(true); // autoFetch=true: skips if not idle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin, receiptToken, isUnlocked, paymentsEnabled]);

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

  // Build human-readable owner breakdown string e.g. "3 owners (1 dealer, 2 private)"
  function ownerBreakdownLabel(): string | null {
    const b = summary.owner_type_breakdown;
    if (!b) return null;
    const total = b.dealer + b.fleet_rental + b.private + b.unknown;
    if (total === 0) return null;
    const parts: string[] = [];
    if (b.dealer > 0) parts.push(`${b.dealer} dealer`);
    if (b.fleet_rental > 0) parts.push(`${b.fleet_rental} fleet/rental`);
    if (b.private > 0) parts.push(`${b.private} private`);
    if (parts.length === 0) return null;
    return `${total} owner${total !== 1 ? "s" : ""} (${parts.join(", ")})`;
  }
  const ownerLabel = ownerBreakdownLabel();

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
          <Pill label="Ownership" value={ownerLabel ?? (summary.sale_count > 0 ? `${summary.sale_count} records` : "None")} bad={false} />
        </div>

        {/* Fleet/rental pattern flag */}
        {summary.possible_fleet_history && (
          <div className="flex items-start gap-2.5 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Possible fleet or rental history</p>
              <p className="text-xs text-amber-300/60 mt-0.5">Multiple ownership transfers in quick succession — typical of rental fleet, dealer rotation, or commercial vehicle disposal.</p>
            </div>
          </div>
        )}

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
                  <li key={i} className="px-4 py-3 text-sm text-white/60 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.date && <p className="font-medium text-white/80">{r.date}</p>}
                      {r.owner_type && r.owner_type !== "unknown" && (
                        <OwnerTypePill type={r.owner_type} />
                      )}
                    </div>
                    {r.price && <p>Price: <span className="font-semibold text-white/80">${Number(r.price).toLocaleString()}</span></p>}
                    {r.odometer && <p>Odometer: {Number(r.odometer).toLocaleString()} mi</p>}
                    {r.seller && <p className="text-white/30 text-xs">Seller: {r.seller}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-xs text-white/20">Data sourced from NMVTIS via VehicleDatabases. Records may not capture all incidents.</p>
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

function OwnerTypePill({ type }: { type: "dealer" | "fleet_rental" | "private" }) {
  const config = {
    dealer: { label: "Dealer sale", className: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
    fleet_rental: { label: "Fleet/Rental", className: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
    private: { label: "Private", className: "bg-white/[0.06] text-white/40 border-white/10" },
  };
  const { label, className } = config[type];
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${className}`}>
      {label}
    </span>
  );
}
