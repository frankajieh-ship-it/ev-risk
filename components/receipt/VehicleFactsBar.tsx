"use client";

/**
 * VehicleFactsBar — compact inline row of key vehicle facts
 *
 * Always shown in free tier, below the verdict banner.
 * Surfaces: title status, accident history, NHTSA recalls, battery health estimate (EVs).
 */

import { useState, useEffect } from "react";
import { Shield, ShieldAlert, AlertTriangle, CheckCircle, Zap, ExternalLink, Loader2 } from "lucide-react";
import type { ListingReceipt } from "@/types/receipt";

interface VehicleFactsBarProps {
  receipt: ListingReceipt;
}

// EV makes that have a battery range we can estimate
const EV_MAKES = ["tesla", "rivian", "lucid", "polestar", "hyundai", "kia", "chevrolet", "ford", "volkswagen", "bmw", "audi", "mercedes", "nio", "byd"];
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

export default function VehicleFactsBar({ receipt }: VehicleFactsBarProps) {
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

  // Live NHTSA recall fetch
  useEffect(() => {
    if (!make || !model || !year) return;
    setRecallStatus("loading");
    fetch(`/api/recalls/nhtsa?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(String(year))}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRecalls(data.recalls || []);
          setRecallStatus("done");
        } else {
          setRecallStatus("error");
        }
      })
      .catch(() => setRecallStatus("error"));
  }, [make, model, year]);

  const ev = isEv(make, model);
  const currentYear = new Date().getFullYear();
  const yearDiff = year ? currentYear - year : 0;
  const degradation = ev ? estimateDegradation(mileage, yearDiff) : 0;
  const originalRange = ev ? getOriginalRange(make, model) : 0;
  const estimatedRange = ev && originalRange > 0 ? Math.round(originalRange * (1 - degradation / 100)) : 0;

  // Title status pill config
  const titleConfig = {
    clean: { label: "Clean title", icon: CheckCircle, cls: "text-green-700 bg-green-50 border-green-200" },
    rebuilt: { label: "Rebuilt title", icon: ShieldAlert, cls: "text-amber-700 bg-amber-50 border-amber-200" },
    salvage: { label: "Salvage title", icon: ShieldAlert, cls: "text-red-700 bg-red-50 border-red-200" },
    unknown: { label: "Title unknown", icon: Shield, cls: "text-gray-600 bg-gray-50 border-gray-200" },
  };
  const tc = titleConfig[titleStatus as keyof typeof titleConfig] || titleConfig.unknown;
  const TitleIcon = tc.icon;

  // Accident pill config
  const accidentConfig = {
    yes: { label: "Accidents reported", cls: "text-red-700 bg-red-50 border-red-200", icon: AlertTriangle },
    no: { label: "No accidents reported", cls: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle },
    unknown: { label: "Accident history unknown", cls: "text-gray-600 bg-gray-50 border-gray-200", icon: AlertTriangle },
  };
  const ac = accidentConfig[accidents as keyof typeof accidentConfig] || accidentConfig.unknown;
  const AccidentIcon = ac.icon;

  const nhtsaUrl = make && model && year
    ? `https://www.nhtsa.gov/recalls?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
    : "https://www.nhtsa.gov/vehicle-safety/recalls";

  return (
    <div className="px-5 py-3 border-b border-gray-100 bg-white space-y-2.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle Facts</p>

      {/* Pill row */}
      <div className="flex flex-wrap gap-1.5">
        {/* Title status */}
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${tc.cls}`}>
          <TitleIcon className="w-3 h-3" />
          {tc.label}
        </span>

        {/* Accidents */}
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ac.cls}`}>
          <AccidentIcon className="w-3 h-3" />
          {ac.label}
        </span>

        {/* Recalls */}
        {recallStatus === "loading" && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 px-2 py-0.5 rounded-full border border-gray-100">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking recalls…
          </span>
        )}
        {recallStatus === "done" && recalls.length === 0 && (
          <a
            href={nhtsaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border text-green-700 bg-green-50 border-green-200 hover:underline"
          >
            <CheckCircle className="w-3 h-3" />
            No open recalls
            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
          </a>
        )}
        {recallStatus === "done" && recalls.length > 0 && (
          <button
            onClick={() => setRecallExpanded((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border text-red-700 bg-red-50 border-red-200"
          >
            <AlertTriangle className="w-3 h-3" />
            {recalls.length} open recall{recalls.length !== 1 ? "s" : ""}
            <span className="ml-0.5 text-red-400">{recallExpanded ? "▲" : "▼"}</span>
          </button>
        )}
        {recallStatus === "error" && (
          <a
            href={nhtsaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 hover:underline"
          >
            Check NHTSA recalls
            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
          </a>
        )}
      </div>

      {/* Recall expansion */}
      {recallExpanded && recalls.length > 0 && (
        <div className="space-y-1.5 pl-1">
          {recalls.slice(0, 4).map((r) => (
            <div key={r.NHTSACampaignNumber} className="text-xs text-gray-700 flex items-start gap-1.5">
              <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>
              <span>
                <span className="font-medium">{r.Component}</span>
                {r.Summary ? ` — ${r.Summary.slice(0, 120)}${r.Summary.length > 120 ? "…" : ""}` : ""}
              </span>
            </div>
          ))}
          {recalls.length > 4 && (
            <a href={nhtsaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              +{recalls.length - 4} more on NHTSA <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Battery health estimate (EVs only) */}
      {ev && degradation > 0 && estimatedRange > 0 && (
        <div className="flex items-start gap-2 text-xs text-gray-600 pt-0.5">
          <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-gray-800">Battery est.</span>{" "}
            ~{100 - degradation}% health · ~{estimatedRange} mi range
            <span className="text-gray-400 ml-1">(mileage/age proxy · confirm with seller)</span>
          </span>
        </div>
      )}
    </div>
  );
}
