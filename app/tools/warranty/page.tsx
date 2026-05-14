"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/landing/Header";
import { CheckCircle, AlertTriangle, XCircle, ChevronRight } from "lucide-react";

// Popular EV makes and their common models
const MAKE_MODEL_MAP: Record<string, string[]> = {
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  "Hyundai": ["IONIQ 5", "IONIQ 6", "Kona Electric"],
  "Kia": ["EV6", "EV9", "Niro EV"],
  "Ford": ["F-150 Lightning", "Mustang Mach-E"],
  "Chevrolet": ["Bolt EV", "Bolt EUV", "Silverado EV", "Equinox EV"],
  "Rivian": ["R1T", "R1S"],
  "BMW": ["iX", "i4", "i5", "i7", "iX3"],
  "Volkswagen": ["ID.4", "ID.Buzz"],
  "Audi": ["Q4 e-tron", "e-tron GT", "Q8 e-tron"],
  "Mercedes-Benz": ["EQS", "EQE", "EQB", "EQS SUV"],
  "Polestar": ["Polestar 2", "Polestar 3"],
  "Volvo": ["XC40 Recharge", "C40 Recharge", "EX30", "EX90"],
  "Lucid": ["Air"],
  "Nissan": ["Leaf", "Ariya"],
  "GMC": ["Hummer EV", "Sierra EV"],
  "Genesis": ["GV60", "GV70 Electrified", "G80 Electrified"],
  "Toyota": ["bZ4X", "Prius Prime"],
  "Honda": ["Prologue"],
  "Subaru": ["Solterra"],
  "Jeep": ["Wrangler 4xe", "Grand Cherokee 4xe"],
  "Fisker": ["Ocean"],
};

const MAKES = Object.keys(MAKE_MODEL_MAP).sort();
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2010 + 1 }, (_, i) => CURRENT_YEAR - i);

interface WarrantyResult {
  make: string;
  model: string;
  year: number;
  warranty_years: number;
  warranty_miles: number;
  expiry_year: number;
  expiry_miles: number;
  current_mileage: number;
  years_remaining: number;
  miles_remaining: number;
  pct_time_used: number;
  pct_miles_used: number;
  status: "covered" | "expiring_soon" | "expired";
  replacement_cost_low: number;
  replacement_cost_high: number;
  battery_kwh?: number;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden">
      <div
        className={`h-2.5 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString();
}

export default function WarrantyCheckerPage() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [mileage, setMileage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = make ? (MAKE_MODEL_MAP[make] ?? []) : [];

  const handleMakeChange = (v: string) => {
    setMake(v);
    setModel("");
    setResult(null);
    setError(null);
  };

  const canSubmit = make && model && year !== "" && mileage && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({
        make,
        model,
        year: String(year),
        mileage: mileage.replace(/,/g, ""),
      });
      const res = await fetch(`/api/tools/warranty?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Unknown error");
      setResult(json.result as WarrantyResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  const StatusBadge = ({ status }: { status: WarrantyResult["status"] }) => {
    if (status === "covered")
      return (
        <div className="flex items-center gap-2 text-[#00d97e]">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold text-lg">Covered</span>
        </div>
      );
    if (status === "expiring_soon")
      return (
        <div className="flex items-center gap-2 text-yellow-400">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold text-lg">Expiring Soon</span>
        </div>
      );
    return (
      <div className="flex items-center gap-2 text-red-400">
        <XCircle className="w-5 h-5" />
        <span className="font-semibold text-lg">Expired</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="receipt" />

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-full px-3 py-1 text-xs text-[#00d97e] font-medium mb-4">
            Free Tool
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
            Battery Warranty Checker
          </h1>
          <p className="text-white/50 text-base leading-relaxed">
            Find out exactly how much coverage is left on any EV&apos;s battery — before you buy.
          </p>
        </div>

        {/* Input form */}
        {!result && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] p-6 space-y-5">
            {/* Make */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Make</label>
              <select
                value={make}
                onChange={(e) => handleMakeChange(e.target.value)}
                className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50"
              >
                <option value="">Select make…</option>
                {MAKES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Model</label>
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value); setResult(null); }}
                disabled={!make}
                className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50 disabled:opacity-40"
              >
                <option value="">Select model…</option>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year + Mileage */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">Model year</label>
                <select
                  value={year}
                  onChange={(e) => { setYear(e.target.value ? Number(e.target.value) : ""); setResult(null); }}
                  className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50"
                >
                  <option value="">Year…</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">Current mileage</label>
                <input
                  type="number"
                  min={0}
                  max={500000}
                  placeholder="e.g. 45000"
                  value={mileage}
                  onChange={(e) => { setMileage(e.target.value); setResult(null); }}
                  className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50 placeholder:text-white/20"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-[#00d97e] hover:bg-[#00c070] text-black font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Checking…
                </span>
              ) : (
                <>Check Warranty <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* Status card */}
            <div className={`rounded-2xl border p-6 ${
              result.status === "covered"
                ? "border-[#00d97e]/30 bg-[#00d97e]/5"
                : result.status === "expiring_soon"
                  ? "border-yellow-400/30 bg-yellow-400/5"
                  : "border-red-400/30 bg-red-400/5"
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white/40 text-xs mb-1">{result.year} {result.make} {result.model}</p>
                  <StatusBadge status={result.status} />
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-xs">Warranty</p>
                  <p className="text-white text-sm font-medium">{result.warranty_years}yr / {fmt(result.warranty_miles)} mi</p>
                </div>
              </div>

              {result.status !== "expired" && (
                <p className="text-white/70 text-sm mb-5">
                  Coverage expires around <strong className="text-white">{result.expiry_year}</strong> or at <strong className="text-white">{fmt(result.expiry_miles)} miles</strong> — whichever comes first.
                </p>
              )}

              {/* Progress bars */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-white/40 mb-1.5">
                    <span>Time used</span>
                    <span>
                      {result.pct_time_used >= 100
                        ? "Expired"
                        : `${result.years_remaining} yr${result.years_remaining !== 1 ? "s" : ""} remaining`}
                    </span>
                  </div>
                  <ProgressBar
                    pct={result.pct_time_used}
                    color={result.pct_time_used >= 100 ? "bg-red-400" : result.pct_time_used >= 80 ? "bg-yellow-400" : "bg-[#00d97e]"}
                  />
                  <div className="flex justify-between text-xs text-white/25 mt-1">
                    <span>0 years</span>
                    <span>{result.warranty_years} years</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-white/40 mb-1.5">
                    <span>Miles used</span>
                    <span>
                      {result.pct_miles_used >= 100
                        ? "Exceeded"
                        : `${fmt(result.miles_remaining)} mi remaining`}
                    </span>
                  </div>
                  <ProgressBar
                    pct={result.pct_miles_used}
                    color={result.pct_miles_used >= 100 ? "bg-red-400" : result.pct_miles_used >= 80 ? "bg-yellow-400" : "bg-[#00d97e]"}
                  />
                  <div className="flex justify-between text-xs text-white/25 mt-1">
                    <span>0 mi</span>
                    <span>{fmt(result.warranty_miles)} mi</span>
                  </div>
                </div>
              </div>

              {/* Current mileage note */}
              <p className="text-white/30 text-xs mt-3">
                Based on {fmt(result.current_mileage)} miles at time of check.
              </p>
            </div>

            {/* Replacement cost (if expired or expiring) */}
            {(result.status === "expired" || result.status === "expiring_soon") && (
              <div className="rounded-xl border border-white/[0.08] bg-[#161b22] p-5">
                <p className="text-xs text-white/40 mb-1">Battery replacement estimate</p>
                <p className="text-xl font-bold text-white">
                  ${fmt(result.replacement_cost_low)} – ${fmt(result.replacement_cost_high)}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  {result.battery_kwh ? `Based on ${result.battery_kwh} kWh battery` : "Based on estimated battery size"} at ~$130/kWh (2024 industry average).
                </p>
              </div>
            )}

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/routine"
                className="flex items-center justify-center gap-2 bg-[#00d97e] hover:bg-[#00c070] text-black font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
              >
                Run Full Routine Check
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 border border-white/[0.12] text-white/60 hover:text-white hover:border-white/20 font-medium py-3 px-4 rounded-xl transition-colors text-sm"
              >
                Check another vehicle
              </button>
            </div>
          </div>
        )}

        {/* Info footer */}
        <p className="text-center text-white/20 text-xs mt-8">
          Warranty terms are standard manufacturer coverage. Actual coverage may vary — verify with the selling dealer.
        </p>
      </main>
    </div>
  );
}
