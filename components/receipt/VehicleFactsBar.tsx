"use client";

/**
 * VehicleFactsBar — compact inline row of key vehicle facts
 *
 * Always shown in free tier, below the verdict banner.
 * Surfaces: title status, accident history, theft/salvage (VehicleDatabases),
 * NHTSA recalls, and battery health estimate (EVs).
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Zap, ExternalLink, Lock } from "lucide-react";
import type { ListingReceipt } from "@/types/receipt";

interface VehicleFactsBarProps {
  receipt: ListingReceipt;
  isUnlocked?: boolean;
  paymentsEnabled?: boolean;
  onPaywallClick?: () => void;
  serverRecalls?: import("@/lib/nhtsa-recalls").RecallResult | null;
  vinHistory?: import("@/components/receipt/OwnershipHistoryCard").HistoryResult | null;
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

export default function VehicleFactsBar({ receipt, isUnlocked = false, paymentsEnabled = false, serverRecalls, vinHistory }: VehicleFactsBarProps) {
  const ls = receipt.listing_summary;
  const make = ls?.make || "";
  const model = ls?.model || "";
  const year = ls?.year;
  const mileage = ls?.mileage || 0;
  const titleStatus = ls?.title_status || "unknown";
  const accidents = ls?.accidents_reported || "unknown";

  // When serverRecalls is provided, derive the display list directly (no state sync)
  const serverRecallList = useMemo<NhtsaRecall[]>(() =>
    serverRecalls ? serverRecalls.recalls.map(r => ({
      NHTSACampaignNumber: r.campaign_number,
      Component: r.component,
      Summary: r.summary,
    })) : []
  , [serverRecalls]);

  const [clientRecalls, setClientRecalls] = useState<NhtsaRecall[]>([]);
  const [recallStatus, setRecallStatus] = useState<RecallStatus>(serverRecalls ? "done" : "idle");
  const [recallExpanded, setRecallExpanded] = useState(false);

  const recalls = serverRecalls ? serverRecallList : clientRecalls;

  // Client-side NHTSA fetch — only runs when server didn't provide recall data
  useEffect(() => {
    if (serverRecalls) return;
    if (!make || !model || !year) return;
    setRecallStatus("loading"); // eslint-disable-line react-hooks/set-state-in-effect
    // NHTSA needs the base model name — strip battery/trim suffixes
    const nhtsaModel = model
      .replace(/\s+(p100d|p90d|p85d\+?|p85|100d|90d|85d|75d|70d|60d)\b.*/i, "")
      .replace(/\s+(long range|standard range plus|standard range|performance|plaid\+?|dual motor|tri motor|awd|rwd|fwd|4wd)\b.*/i, "")
      .trim();
    const recallUrl = `/api/recalls/nhtsa?make=${encodeURIComponent(make)}&model=${encodeURIComponent(nhtsaModel)}&year=${encodeURIComponent(String(year))}`;
    const tryFetch = (attempt: number): void => {
      fetch(recallUrl)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setClientRecalls(data.recalls || []);
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
  }, [make, model, year, serverRecalls]);

  const ev = isEv(make, model);
  const currentYear = new Date().getFullYear();
  const yearDiff = year ? currentYear - year : 0;
  const degradation = ev ? estimateDegradation(mileage, yearDiff) : 0;
  const originalRange = ev ? getOriginalRange(make, model) : 0;
  const estimatedRange = ev && originalRange > 0 ? Math.round(originalRange * (1 - degradation / 100)) : 0;

  const historyVerified = vinHistory?.success === true;


  const accidentsVerifiedClean = historyVerified && vinHistory!.summary.accident_count === 0;
  const accidentsVerifiedPresent = historyVerified && vinHistory!.summary.accident_count > 0;

  const nhtsaUrl = make && model && year
    ? `https://www.nhtsa.gov/recalls?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
    : "https://www.nhtsa.gov/vehicle-safety/recalls";

  const showFull = isUnlocked || !paymentsEnabled;

  // Derive At a Glance cell states
  const serviceHistory = (receipt.listing_summary as Record<string, unknown>)?.service_history as string | undefined;
  const owners = (receipt.listing_summary as Record<string, unknown>)?.owners as number | null | undefined;

  type CellStatus = "ok" | "issue" | "warn" | "unknown" | "locked";
  type Cell = { label: string; status: CellStatus; detail: string; free: boolean };

  const recallStatus_cell: CellStatus = recallStatus === "done"
    ? (recalls.length === 0 ? "ok" : (serverRecalls?.park_it ? "issue" : "warn"))
    : recallStatus === "loading" ? "unknown" : "unknown";

  const titleCell: Cell = {
    label: "State Title",
    status: titleStatus === "salvage" ? "issue" : titleStatus === "rebuilt" ? "warn" : "ok",
    detail: titleStatus === "salvage" ? "Salvage" : titleStatus === "rebuilt" ? "Rebuilt" : "Clean",
    free: true,
  };

  const accidentCell: Cell = {
    label: "Accidents",
    status: accidents === "yes" ? (accidentsVerifiedPresent ? "issue" : "warn")
      : accidentsVerifiedPresent ? "issue"
      : accidentsVerifiedClean ? "ok"
      : accidents === "no" ? "warn"
      : "unknown",
    detail: accidentsVerifiedPresent
      ? `${vinHistory!.summary.accident_count} found`
      : accidentsVerifiedClean ? "None (verified)"
      : accidents === "yes" ? "Reported"
      : accidents === "no" ? "None (unverified)"
      : "Unknown",
    free: true,
  };

  const recallCell: Cell = {
    label: "Open Recalls",
    status: recallStatus_cell,
    detail: recallStatus === "done"
      ? (recalls.length === 0 ? "No open recalls" : `${recalls.length} campaign${recalls.length !== 1 ? "s" : ""}`)
      : "Checking…",
    free: true,
  };

  const serviceCell: Cell = {
    label: "Service Records",
    status: serviceHistory === "yes" ? "ok" : serviceHistory === "no" ? "warn" : "unknown",
    detail: serviceHistory === "yes" ? "Records present" : serviceHistory === "no" ? "None disclosed" : "Not disclosed",
    free: true,
  };

  const ownersCell: Cell = {
    label: "Owners",
    status: "ok",
    detail: historyVerified
      ? (vinHistory!.summary.sale_count > 0 ? `${vinHistory!.summary.sale_count} owner${vinHistory!.summary.sale_count !== 1 ? "s" : ""}` : "1 owner")
      : (owners != null ? `${owners} owner${owners !== 1 ? "s" : ""} (listed)` : "Unknown"),
    free: true,
  };

  const theftCell: Cell = {
    label: "Theft Record",
    status: showFull ? (historyVerified ? (vinHistory!.summary.theft_reported ? "issue" : "ok") : "unknown") : "locked",
    detail: showFull ? (historyVerified ? (vinHistory!.summary.theft_reported ? "Reported" : "None found") : "Run history check") : "Unlock",
    free: false,
  };

  const salvageCell: Cell = {
    label: "Salvage / Loss",
    status: showFull ? (historyVerified ? (vinHistory!.summary.salvage_reported ? "issue" : "ok") : "unknown") : "locked",
    detail: showFull ? (historyVerified ? (vinHistory!.summary.salvage_reported ? "Reported" : "None found") : "Run history check") : "Unlock",
    free: false,
  };

  const lienCell: Cell = {
    label: "Open Lien",
    status: showFull ? (historyVerified
      ? ((vinHistory!.summary as Record<string, unknown>).open_lien === true ? "issue"
        : (vinHistory!.summary as Record<string, unknown>).open_lien === false ? "ok" : "unknown")
      : "unknown") : "locked",
    detail: showFull ? (historyVerified
      ? ((vinHistory!.summary as Record<string, unknown>).open_lien === true ? "Lien reported"
        : (vinHistory!.summary as Record<string, unknown>).open_lien === false ? "No lien" : "Unknown")
      : "Run history check") : "Unlock",
    free: false,
  };

  const odometerCell: Cell = {
    label: "Odometer Check",
    status: showFull ? (historyVerified
      ? ((vinHistory!.summary as Record<string, unknown>).odometer_rollback === true ? "issue" : "ok")
      : "unknown") : "locked",
    detail: showFull ? (historyVerified
      ? ((vinHistory!.summary as Record<string, unknown>).odometer_rollback === true ? "Rollback detected" : "No issues")
      : "Run history check") : "Unlock",
    free: false,
  };

  const cells: Cell[] = [titleCell, accidentCell, recallCell, theftCell, salvageCell, odometerCell, lienCell, serviceCell, ownersCell];

  const STATUS_STYLE: Record<CellStatus, { dot: string; text: string; badge: string }> = {
    ok:      { dot: "bg-[#00d97e]",   text: "text-[#00d97e]",    badge: "text-[#00d97e]/70 bg-[#00d97e]/[0.06] border-[#00d97e]/20" },
    warn:    { dot: "bg-amber-400",    text: "text-amber-400",    badge: "text-amber-400/70 bg-amber-500/[0.06] border-amber-500/20" },
    issue:   { dot: "bg-red-400",      text: "text-red-400",      badge: "text-red-400/70 bg-red-500/[0.06] border-red-500/20" },
    unknown: { dot: "bg-white/20",     text: "text-white/30",     badge: "text-white/30 bg-white/[0.04] border-white/[0.08]" },
    locked:  { dot: "bg-white/10",     text: "text-white/20",     badge: "text-white/20 bg-white/[0.03] border-white/[0.06]" },
  };

  return (
    <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.02] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Vehicle History at a Glance</p>
        {mileage > 0 && (
          <span className="text-xs text-white/30">{mileage.toLocaleString()} mi</span>
        )}
      </div>

      {/* 3×3 check grid */}
      <div className="grid grid-cols-3 gap-2">
        {cells.map((cell) => {
          const s = STATUS_STYLE[cell.status];
          const locked = cell.status === "locked";
          return (
            <div key={cell.label} className={`rounded-lg border p-2.5 ${locked ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.08] bg-white/[0.03]"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide leading-tight">{cell.label}</span>
                {locked && <Lock className="w-2.5 h-2.5 text-white/20 ml-auto" />}
              </div>
              <p className={`text-xs font-medium leading-tight ${s.text} ${locked ? "blur-[3px] select-none" : ""}`}>
                {locked ? "——" : cell.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recall detail expansion */}
      {recallStatus === "done" && recalls.length > 0 && (
        <div>
          <button onClick={() => setRecallExpanded((o) => !o)}
            className="text-xs text-red-400/70 hover:text-red-400 flex items-center gap-1 transition-colors"
          >
            <AlertTriangle className="w-3 h-3" />
            {recalls.length} recall campaign{recalls.length !== 1 ? "s" : ""} — see details
            <span>{recallExpanded ? "▲" : "▼"}</span>
          </button>
          {(serverRecalls?.park_it || serverRecalls?.park_outside) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-orange-400 bg-orange-500/[0.08] border border-orange-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {serverRecalls.park_it ? "Do not park indoors" : "Park outside only"} — fire risk recall
            </div>
          )}
          {recallExpanded && (
            <div className="mt-2 space-y-1.5 pl-1">
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
              <p className="text-xs text-white/30">
                Ask the seller if the remedy has been completed, or{" "}
                <a href="https://www.nhtsa.gov/vehicle-safety/recalls#vin-search" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50">check by VIN on NHTSA</a>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Battery health estimate (EVs only) */}
      {ev && degradation > 0 && estimatedRange > 0 && (
        <div className="flex items-start gap-2 text-xs text-white/50">
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
