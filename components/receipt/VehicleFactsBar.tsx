"use client";

/**
 * VehicleFactsBar — compact inline row of key vehicle facts
 *
 * Always shown in free tier, below the verdict banner.
 * Surfaces: title status, accident history, theft/salvage (VinAudit),
 * NHTSA recalls, and battery health estimate (EVs).
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, ShieldAlert, AlertTriangle, CheckCircle, Zap, ExternalLink, Loader2, Lock } from "lucide-react";
import type { ListingReceipt } from "@/types/receipt";
import type { VinAuditLiteResult } from "@/lib/vinaudit-client";
import { getOrCreateReceiptToken } from "@/lib/session-utils";

interface VehicleFactsBarProps {
  receipt: ListingReceipt;
  isUnlocked?: boolean;
  paymentsEnabled?: boolean;
  onPaywallClick?: () => void;
}


const EV_MODEL_KEYWORDS = ["model 3", "model s", "model x", "model y", "cybertruck", "ioniq", "ev6", "ev9", "bolt", "mach-e", "mustang mache", "id.4", "id.3", "r1t", "r1s", "air", "lightning", "hummer ev"];

// Rough original range by make/model keyword (miles)
function getOriginalRange(make: string, model: string): number {
  const m = model.toLowerCase();
  if (m.includes("model s")) return 405;
  if (m.includes("model x")) return 348;
  if (m.includes("model y")) return 330;
  if (m.includes("model 3")) return 272;
  if (m.includes("ioniq 6")) return 361;
  if (m.includes("ioniq 5")) return 303;
  if (m.includes("ev6")) return 310;
  if (m.includes("bolt")) return 259;
  if (m.includes("mach-e") || m.includes("mache")) return 312;
  if (m.includes("id.4")) return 275;
  if (m.includes("air")) return 520;
  if (m.includes("r1t") || m.includes("r1s")) return 314;
  return 260; // conservative default
}

// Mileage-based degradation heuristic: ~2% per 10k miles for most EVs, slowing after 50k
function estimateDegradation(mileage: number, yearDiff: number): number {
  if (!mileage || mileage <= 0) return 0;
  // Empirical: ~15% at 100k miles, ~20% at 150k
  const mileageFactor = Math.min(mileage / 1000 * 0.14, 25); // caps at 25%
  const ageFactor = Math.min(yearDiff * 0.5, 6); // calendar aging ~0.5%/yr, cap 6%
  return Math.round(Math.min(mileageFactor + ageFactor, 30));
}

function isEv(make: string, model: string, fuelNote?: string): boolean {
  const mk = make.toLowerCase();
  const mo = model.toLowerCase();
  if (fuelNote && (fuelNote.toLowerCase().includes("electric") || fuelNote.toLowerCase().includes("bev"))) return true;
  if (mk === "tesla" || mk === "rivian" || mk === "lucid") return true;
  return EV_MODEL_KEYWORDS.some((kw) => mo.includes(kw));
}

interface NhtsaRecall {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
}

type RecallStatus = "idle" | "loading" | "done" | "error";
type HistoryStatus = "idle" | "loading" | "done" | "error" | "unavailable";

export default function VehicleFactsBar({ receipt, isUnlocked = false, paymentsEnabled = false, onPaywallClick }: VehicleFactsBarProps) {
  const ls = receipt.listing_summary;
  const make = ls?.make || "";
  const model = ls?.model || "";
  const year = ls?.year;
  const mileage = ls?.mileage || 0;
  const titleStatus = ls?.title_status || "unknown";
  const accidents = ls?.accidents_reported || "unknown";

  const [recalls, setRecalls] = useState<NhtsaRecall[]>([]);
  const [recallStatus, setRecallStatus] = useState<RecallStatus>("idle");
  const [recallExpanded, setRecallExpanded] = useState(false);

  const [history, setHistory] = useState<VinAuditLiteResult | null>(null);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>("idle");

  // VinAudit history fetch — VIN lives on the Supabase row, not in the Receipt schema type.
  // listing_summary uses .passthrough() so extra fields exist at runtime; cast to access them.
  const receiptAny = receipt as Record<string, unknown>;
  const lsAny = receipt.listing_summary as Record<string, unknown> | undefined;
  const vin = (receiptAny.vin ?? lsAny?.vin) as string | undefined;

  useEffect(() => {
    if (!vin) return;
    const receiptToken = getOrCreateReceiptToken();
    if (!receiptToken) return;
    setHistoryStatus("loading"); // eslint-disable-line react-hooks/set-state-in-effect
    fetch("/api/vin/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin, receipt_token: receiptToken }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setHistory(data as VinAuditLiteResult);
          setHistoryStatus("done");
        } else if (data.code === "not_configured") {
          setHistoryStatus("unavailable");
        } else {
          setHistoryStatus("error");
        }
      })
      .catch(() => setHistoryStatus("error"));
  }, [vin]);

  // Live NHTSA recall fetch
  useEffect(() => {
    if (!make || !model || !year) return;
    setRecallStatus("loading"); // eslint-disable-line react-hooks/set-state-in-effect
    // NHTSA needs the base model name — strip battery/trim suffixes (e.g. "Model S 90D AWD" → "Model S")
    const nhtsaModel = model
      .replace(/\s+(p100d|p90d|p85d\+?|p85|100d|90d|85d|75d|70d|60d)\b.*/i, "")
      .replace(/\s+(long range|standard range plus|standard range|performance|plaid\+?|dual motor|tri motor|awd|rwd|fwd|4wd)\b.*/i, "")
      .trim();
    const recallUrl = `/api/recalls/nhtsa?make=${encodeURIComponent(make)}&model=${encodeURIComponent(nhtsaModel)}&year=${encodeURIComponent(String(year))}`;
    // Retry once on failure — NHTSA can be flaky
    const tryFetch = (attempt: number): void => {
      fetch(recallUrl)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setRecalls(data.recalls || []);
            setRecallStatus("done");
          } else if (attempt < 1) {
            setTimeout(() => tryFetch(attempt + 1), 2000);
          } else {
            setRecallStatus("error");
          }
        })
        .catch(() => {
          if (attempt < 1) {
            setTimeout(() => tryFetch(attempt + 1), 2000);
          } else {
            setRecallStatus("error");
          }
        });
    };
    tryFetch(0);
  }, [make, model, year]);

  const ev = isEv(make, model);
  const currentYear = new Date().getFullYear();
  const yearDiff = year ? currentYear - year : 0;
  const degradation = ev ? estimateDegradation(mileage, yearDiff) : 0;
  const originalRange = ev ? getOriginalRange(make, model) : 0;
  const estimatedRange = ev && originalRange > 0 ? Math.round(originalRange * (1 - degradation / 100)) : 0;

  // Title status pill config
  const titleConfig = {
    clean: { label: "Clean title", icon: CheckCircle, cls: "text-green-400 bg-green-500/10 border-green-500/20" },
    rebuilt: { label: "Rebuilt title", icon: ShieldAlert, cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    salvage: { label: "Salvage title", icon: ShieldAlert, cls: "text-red-400 bg-red-500/10 border-red-500/20" },
    unknown: { label: "Title unknown", icon: Shield, cls: "text-white/40 bg-white/[0.06] border-white/10" },
  };
  const tc = titleConfig[titleStatus as keyof typeof titleConfig] || titleConfig.unknown;
  const TitleIcon = tc.icon;

  // Accident pill config
  const accidentConfig = {
    yes: { label: "Accidents reported", cls: "text-red-400 bg-red-500/10 border-red-500/20", icon: AlertTriangle },
    no: { label: "No accidents reported", cls: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle },
    unknown: { label: "Accident history unknown", cls: "text-white/40 bg-white/[0.06] border-white/10", icon: AlertTriangle },
  };
  const ac = accidentConfig[accidents as keyof typeof accidentConfig] || accidentConfig.unknown;
  const AccidentIcon = ac.icon;

  const nhtsaUrl = make && model && year
    ? `https://www.nhtsa.gov/recalls?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
    : "https://www.nhtsa.gov/vehicle-safety/recalls";

  const showFull = isUnlocked || !paymentsEnabled;

  return (
    <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] space-y-2.5">
      <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Vehicle Facts</p>

      {/* Pill row */}
      <div className="flex flex-wrap gap-1.5">
        {/* Mileage — always visible */}
        {mileage > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border text-white/50 bg-white/[0.04] border-white/[0.08]">
            {mileage.toLocaleString()} mi
          </span>
        )}

        {showFull ? (
          <>
            {/* Title status */}
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${tc.cls}`}>
              <TitleIcon className="w-3 h-3" />
              {tc.label}
            </span>

            {/* Accidents — show listing-scraped pill only when VinAudit hasn't confirmed yet */}
            {historyStatus !== "done" && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ac.cls}`}>
                <AccidentIcon className="w-3 h-3" />
                {ac.label}
              </span>
            )}

            {/* VinAudit history pills */}
            {historyStatus === "loading" && (
              <span className="inline-flex items-center gap-1 text-xs text-white/30 px-2 py-0.5 rounded-full border border-white/[0.08]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking history…
              </span>
            )}
            {historyStatus === "done" && history && (
              <>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                  history.summary.accident_count > 0
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : "text-green-400 bg-green-500/10 border-green-500/20"
                }`}>
                  {history.summary.accident_count > 0
                    ? <><AlertTriangle className="w-3 h-3" />{history.summary.accident_count} accident record{history.summary.accident_count !== 1 ? "s" : ""} (NMVTIS)</>
                    : <><CheckCircle className="w-3 h-3" />No accidents (NMVTIS)</>
                  }
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                  history.summary.theft_reported
                    ? "text-red-400 bg-red-500/10 border-red-500/20"
                    : "text-green-400 bg-green-500/10 border-green-500/20"
                }`}>
                  {history.summary.theft_reported
                    ? <><Lock className="w-3 h-3" />Theft reported</>
                    : <><CheckCircle className="w-3 h-3" />No theft record</>
                  }
                </span>
                {history.summary.salvage_reported && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border text-red-400 bg-red-500/10 border-red-500/20">
                    <ShieldAlert className="w-3 h-3" />
                    Salvage on record
                  </span>
                )}
              </>
            )}

            {/* Recalls */}
            {recallStatus === "loading" && (
              <span className="inline-flex items-center gap-1 text-xs text-white/30 px-2 py-0.5 rounded-full border border-white/[0.08]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking recalls…
              </span>
            )}
            {recallStatus === "done" && recalls.length === 0 && (
              <a href={nhtsaUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border text-green-400 bg-green-500/10 border-green-500/20 hover:underline"
              >
                <CheckCircle className="w-3 h-3" />No open recalls
                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </a>
            )}
            {recallStatus === "done" && recalls.length > 0 && (
              <button onClick={() => setRecallExpanded((o) => !o)}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border text-red-400 bg-red-500/10 border-red-500/20"
              >
                <AlertTriangle className="w-3 h-3" />
                {recalls.length} open recall{recalls.length !== 1 ? "s" : ""}
                <span className="ml-0.5 text-red-400/70">{recallExpanded ? "▲" : "▼"}</span>
              </button>
            )}
            {recallStatus === "error" && (
              <a href={nhtsaUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-white/40 px-2 py-0.5 rounded-full border border-white/10 hover:underline"
              >
                Check NHTSA recalls <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </a>
            )}
          </>
        ) : (
          /* Locked state — blurred pills hinting at what's hidden */
          <>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-white/10 text-white/30 blur-[3px] select-none">
              <Shield className="w-3 h-3" />Title status
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-white/10 text-white/30 blur-[3px] select-none">
              <AlertTriangle className="w-3 h-3" />Accident history
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-white/10 text-white/30 blur-[3px] select-none">
              <AlertTriangle className="w-3 h-3" />Recall status
            </span>
            <button
              onClick={onPaywallClick}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-[#00d97e]/30 text-[#00d97e]/80 bg-[#00d97e]/[0.06] hover:bg-[#00d97e]/10 transition-colors"
            >
              <Lock className="w-3 h-3" />
              View full report
            </button>
          </>
        )}
      </div>

      {/* Recall expansion — only when unlocked */}
      {showFull && recallExpanded && recalls.length > 0 && (
        <div className="space-y-1.5 pl-1">
          {recalls.slice(0, 4).map((r) => (
            <div key={r.NHTSACampaignNumber} className="text-xs text-white/60 flex items-start gap-1.5">
              <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>
              <span>
                <span className="font-medium text-white/80">{r.Component}</span>
                {r.Summary ? ` — ${r.Summary.slice(0, 120)}${r.Summary.length > 120 ? "…" : ""}` : ""}
              </span>
            </div>
          ))}
          {recalls.length > 4 && (
            <a href={nhtsaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] hover:underline flex items-center gap-1">
              +{recalls.length - 4} more on NHTSA <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Battery health estimate (EVs only) — always visible */}
      {ev && degradation > 0 && estimatedRange > 0 && (
        <div className="flex items-start gap-2 text-xs text-white/50 pt-0.5">
          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-white/80">Battery est.</span>{" "}
            ~{100 - degradation}% health · ~{estimatedRange} mi range
            <span className="text-white/30 ml-1">(est. from mileage &amp; age · confirm with seller ·{" "}
              <Link href="/methodology#battery" className="underline hover:text-white/50 transition-colors">how?</Link>
            )</span>
          </span>
        </div>
      )}
    </div>
  );
}
