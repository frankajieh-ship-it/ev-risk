"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Car,
  Lock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { VinAuditLiteResult } from "@/lib/vinaudit-client";

interface OwnershipHistoryCardProps {
  vin: string;
  receiptToken: string;
  isUnlocked: boolean;
  paymentsEnabled: boolean;
  onPaywallClick?: () => void;
  trackEvent: (name: string, data?: Record<string, unknown>) => void;
}

type FetchState = "idle" | "loading" | "done" | "error" | "not_configured";

export default function OwnershipHistoryCard({
  vin,
  receiptToken,
  isUnlocked,
  paymentsEnabled,
  onPaywallClick,
  trackEvent,
}: OwnershipHistoryCardProps) {
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [result, setResult] = useState<VinAuditLiteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accidentsOpen, setAccidentsOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const fetch_history = async () => {
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

      setResult(data as VinAuditLiteResult);
      setFetchState("done");
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

  // Paywall gate — shown for locked users when payments are enabled
  if (!isUnlocked && paymentsEnabled) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Ownership & Accident History</h3>
          <Lock className="w-3.5 h-3.5 text-gray-400 ml-auto" />
        </div>
        <div className="p-5">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center space-y-3">
            <div className="flex justify-center gap-3 text-sm font-medium text-gray-700">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" /> Theft records
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Accident history
              </span>
              <span className="flex items-center gap-1.5">
                <Car className="w-4 h-4 text-blue-500" /> Sale records
              </span>
            </div>
            <p className="text-xs text-gray-500">
              NMVTIS-sourced ownership history — the same data used by dealers and insurers.
            </p>
            <button
              onClick={onPaywallClick}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Unlock Full Report · $9.99
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not configured — coming soon state (no key yet)
  if (fetchState === "not_configured") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Ownership & Accident History</h3>
        </div>
        <div className="p-5">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-500">History lookup coming soon.</p>
          </div>
        </div>
      </div>
    );
  }

  // Idle — show fetch button
  if (fetchState === "idle") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Ownership & Accident History</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">
            Check NMVTIS records for theft, salvage title, accident history, and previous sale prices.
          </p>
          <button
            onClick={fetch_history}
            className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Ownership & Accident History</h3>
        </div>
        <div className="p-5 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking records…
        </div>
      </div>
    );
  }

  // Error
  if (fetchState === "error") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Ownership & Accident History</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={fetch_history}
            className="text-sm text-blue-600 hover:underline"
          >
            Try again
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-900">Ownership & Accident History</h3>
        {allClear && <ShieldCheck className="w-4 h-4 text-green-500 ml-auto" />}
      </div>

      <div className="p-5 space-y-4">
        {/* Summary pills */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Pill
            label="Theft"
            value={summary.theft_reported ? "Reported" : "None found"}
            bad={summary.theft_reported}
          />
          <Pill
            label="Salvage"
            value={summary.salvage_reported ? "Reported" : "None found"}
            bad={summary.salvage_reported}
          />
          <Pill
            label="Accidents"
            value={summary.accident_count > 0 ? `${summary.accident_count} found` : "None found"}
            bad={summary.accident_count > 0}
          />
          <Pill
            label="Sale records"
            value={summary.sale_count > 0 ? `${summary.sale_count} found` : "None"}
            bad={false}
          />
        </div>

        {/* All clear message */}
        {allClear && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>No theft, salvage, or accident records found for this VIN.</span>
          </div>
        )}

        {/* Theft records */}
        {theft.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Theft Records ({theft.length})
            </p>
            <ul className="space-y-1">
              {theft.map((r, i) => (
                <li key={i} className="text-sm text-red-700">
                  {[r.date, r.status].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Salvage records */}
        {salvage.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Salvage Records ({salvage.length})
            </p>
            <ul className="space-y-1">
              {salvage.map((r, i) => (
                <li key={i} className="text-sm text-orange-700">
                  {[r.date, r.source, r.disposition].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Accidents — collapsible */}
        {accidents.length > 0 && (
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setAccidentsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 text-left"
            >
              <span className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Accident Records ({accidents.length})
              </span>
              {accidentsOpen ? (
                <ChevronUp className="w-4 h-4 text-amber-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-amber-600" />
              )}
            </button>
            {accidentsOpen && (
              <ul className="divide-y divide-amber-100">
                {accidents.map((r, i) => (
                  <li key={i} className="px-4 py-3 text-sm text-amber-900 space-y-0.5">
                    {r.date && <p className="font-medium">{r.date}</p>}
                    {r.severity && <p>Severity: {r.severity}</p>}
                    {r.airbags_deployed && <p>Airbags deployed: {r.airbags_deployed}</p>}
                    {r.damage_description && <p>{r.damage_description}</p>}
                    {r.source && <p className="text-amber-600 text-xs">Source: {r.source}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Sales — collapsible */}
        {sales.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setSalesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
            >
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Car className="w-4 h-4" /> Previous Sales ({sales.length})
              </span>
              {salesOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {salesOpen && (
              <ul className="divide-y divide-gray-100">
                {sales.map((r, i) => (
                  <li key={i} className="px-4 py-3 text-sm text-gray-700 space-y-0.5">
                    {r.date && <p className="font-medium">{r.date}</p>}
                    {r.price && <p>Price: <span className="font-semibold">${Number(r.price).toLocaleString()}</span></p>}
                    {r.odometer && <p>Odometer: {Number(r.odometer).toLocaleString()} mi</p>}
                    {r.seller && <p className="text-gray-500 text-xs">Seller: {r.seller}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Data sourced from NMVTIS via VinAudit. Records may not capture all incidents.
        </p>
      </div>
    </div>
  );
}

function Pill({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 border ${bad ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${bad ? "text-red-700" : "text-gray-700"}`}>{value}</p>
    </div>
  );
}
