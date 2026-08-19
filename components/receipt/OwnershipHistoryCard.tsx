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
    open_lien?: boolean | null;
    odometer_rollback?: boolean;
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
  listingAccidentsReported?: "yes" | "no" | "unknown";
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
  listingAccidentsReported,
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

  // Auto-fetch as soon as receiptToken is ready
  useEffect(() => {
    if (!receiptToken) return;
    fetch_history(true); // autoFetch=true: skips if not idle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin, receiptToken]);

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

  // Build unified chronological event timeline from all record types
  type TimelineEvent = { date: string; ts: number; icon: "sale" | "accident" | "salvage" | "theft"; label: string; detail?: string };
  const timelineEvents: TimelineEvent[] = [
    ...sales.map((r) => ({
      date: r.date || "",
      ts: r.date ? new Date(r.date).getTime() : 0,
      icon: "sale" as const,
      label: r.owner_type === "fleet_rental" ? "Fleet/Rental Sale" : r.owner_type === "private" ? "Private Sale" : "Dealer / Auction Sale",
      detail: [r.odometer ? `${Number(r.odometer).toLocaleString()} mi` : "", r.price ? `$${Number(r.price).toLocaleString()}` : "", r.seller || ""].filter(Boolean).join(" · ") || undefined,
    })),
    ...accidents.map((r) => ({
      date: r.date || "",
      ts: r.date ? new Date(r.date).getTime() : 0,
      icon: "accident" as const,
      label: `Accident${r.severity ? ` — ${r.severity}` : ""}`,
      detail: [r.damage_description, r.airbags_deployed ? `Airbags: ${r.airbags_deployed}` : ""].filter(Boolean).join(" · ") || undefined,
    })),
    ...salvage.map((r) => ({
      date: r.date || "",
      ts: r.date ? new Date(r.date).getTime() : 0,
      icon: "salvage" as const,
      label: `Salvage / Total Loss${r.disposition ? ` — ${r.disposition}` : ""}`,
      detail: r.source || undefined,
    })),
    ...theft.map((r) => ({
      date: r.date || "",
      ts: r.date ? new Date(r.date).getTime() : 0,
      icon: "theft" as const,
      label: `Theft Record${r.status ? ` — ${r.status}` : ""}`,
      detail: undefined,
    })),
  ].filter((e) => e.date).sort((a, b) => b.ts - a.ts); // newest first

  const TIMELINE_ICON = {
    sale:     { cls: "bg-blue-500/20 text-blue-400",   El: Car },
    accident: { cls: "bg-yellow-500/20 text-yellow-400", El: AlertTriangle },
    salvage:  { cls: "bg-orange-500/20 text-orange-400", El: AlertTriangle },
    theft:    { cls: "bg-red-500/20 text-red-400",      El: ShieldAlert },
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-blue-400" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Ownership & Accident History</h3>
        {allClear && <ShieldCheck className="w-4 h-4 text-[#00d97e] ml-auto" />}
      </div>

      <div className="p-5 space-y-4">
        {/* Critical alerts — shown before summary */}
        {summary.open_lien === true && (
          <div className="flex items-start gap-2.5 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Lien on file</p>
              <p className="text-xs text-amber-300/70 mt-0.5">Confirm the seller has paid off the existing loan before purchase. A lien means a lender still has a legal claim on this vehicle.</p>
            </div>
          </div>
        )}

        {summary.odometer_rollback === true && (
          <div className="flex items-start gap-2.5 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">Possible odometer rollback</p>
              <p className="text-xs text-red-300/70 mt-0.5">A later record shows a lower mileage reading than an earlier one. This is a serious red flag — do not purchase without a certified pre-purchase inspection.</p>
            </div>
          </div>
        )}

        {/* Summary pills */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Pill label="Theft" value={summary.theft_reported ? "Reported" : "None found"} bad={summary.theft_reported} />
          <Pill label="Salvage" value={summary.salvage_reported ? "Reported" : "None found"} bad={summary.salvage_reported} />
          <Pill label="Accidents" value={summary.accident_count > 0 ? `${summary.accident_count} found` : "None found"} bad={summary.accident_count > 0} />
          <Pill label="Ownership" value={ownerLabel ?? (summary.sale_count > 0 ? `${summary.sale_count} records` : "None")} bad={false} />
        </div>

        {/* Conflict note: listing says accident reported but NMVTIS shows none */}
        {listingAccidentsReported === "yes" && summary.accident_count === 0 && (
          <div className="flex items-start gap-2.5 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300/80">
              The listing discloses an accident, but no record appears in NMVTIS. This can happen when an incident wasn&apos;t reported to insurance. Ask the seller for the full CarFax or repair receipts.
            </p>
          </div>
        )}

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

        {/* Chronological event timeline */}
        {timelineEvents.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Event Timeline</p>
            <div className="relative pl-6 space-y-0">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-white/[0.08]" />
              {timelineEvents.map((ev, i) => {
                const { cls, El } = TIMELINE_ICON[ev.icon];
                return (
                  <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    <div className={`absolute -left-6 w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cls}`}>
                      <El className="w-2.5 h-2.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-white/30">{ev.date}</span>
                        <span className="text-sm font-medium text-white/70">{ev.label}</span>
                      </div>
                      {ev.detail && <p className="text-xs text-white/40 mt-0.5 truncate">{ev.detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Theft records (detail) */}
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

        {/* Salvage records (detail) */}
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

        {/* Accidents — collapsible detail */}
        {accidents.length > 0 && (
          <div className="border border-yellow-500/20 rounded-lg overflow-hidden">
            <button
              onClick={() => setAccidentsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-yellow-500/[0.06] text-left"
            >
              <span className="text-sm font-semibold text-yellow-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Accident Detail ({accidents.length})
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

        {/* Sales — collapsible detail */}
        {sales.length > 0 && (
          <div className="border border-white/[0.08] rounded-lg overflow-hidden">
            <button
              onClick={() => setSalesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] text-left"
            >
              <span className="text-sm font-semibold text-white/60 flex items-center gap-1.5">
                <Car className="w-4 h-4" /> Sale Detail ({sales.length})
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
