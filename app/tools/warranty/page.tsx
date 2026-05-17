"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/landing/Header";
import { CheckCircle, AlertTriangle, XCircle, ChevronRight, Copy, Check } from "lucide-react";

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

// Inline X logo SVG — no dependency
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.26 5.632 5.905-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

function WarrantyCheckerInner() {
  const searchParams = useSearchParams();

  const paramMake = searchParams.get("make") ?? "";
  const paramModel = searchParams.get("model") ?? "";
  const paramYear = parseInt(searchParams.get("year") ?? "");

  const [make, setMake] = useState(() => (MAKES.includes(paramMake) ? paramMake : ""));
  const [model, setModel] = useState(() => {
    if (!paramMake || !paramModel) return "";
    return (MAKE_MODEL_MAP[paramMake] ?? []).includes(paramModel) ? paramModel : "";
  });
  const [year, setYear] = useState<number | "">(() => (!isNaN(paramYear) && paramYear >= 2010 && paramYear <= CURRENT_YEAR ? paramYear : ""));
  const [mileage, setMileage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // VIN decode state
  const [vin, setVin] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);

  // Share state
  const [copied, setCopied] = useState(false);

  const models = make ? (MAKE_MODEL_MAP[make] ?? []) : [];

  const handleMakeChange = (v: string) => {
    setMake(v);
    setModel("");
    setResult(null);
    setError(null);
  };

  const handleVinChange = (v: string) => {
    setVin(v.toUpperCase());
    setVinError(null);
  };

  const handleVinDecode = useCallback(async () => {
    const clean = vin.replace(/\s/g, "");
    if (!VIN_REGEX.test(clean)) {
      setVinError("VINs are 17 characters (letters and numbers, no I/O/Q).");
      return;
    }
    setVinLoading(true);
    setVinError(null);
    try {
      const res = await fetch("/api/tools/vin-decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: clean }),
      });
      const json = await res.json();
      if (!json.success || !json.decoded) {
        setVinError("Couldn't decode that VIN — fill in the fields below.");
        return;
      }
      const d = json.decoded;
      const decodedMake = MAKES.find((m) => m.toLowerCase() === (d.make ?? "").toLowerCase()) ?? "";
      const decodedYear = parseInt(d.year ?? "");
      if (decodedMake) {
        setMake(decodedMake);
        const availableModels = MAKE_MODEL_MAP[decodedMake] ?? [];
        const decodedModel = availableModels.find((m) => m.toLowerCase().includes((d.model ?? "").toLowerCase())) ?? "";
        setModel(decodedModel);
      }
      if (!isNaN(decodedYear)) setYear(decodedYear);
      setResult(null);
      setError(null);
    } catch {
      setVinError("Couldn't decode that VIN — fill in the fields below.");
    } finally {
      setVinLoading(false);
    }
  }, [vin]);

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
    setVin("");
    setVinError(null);
  };

  const handleTweetShare = useCallback(() => {
    if (!result) return;
    const emoji = result.status === "covered" ? "✅" : result.status === "expiring_soon" ? "⚠️" : "❌";
    const statusLabel = result.status === "covered" ? "COVERED" : result.status === "expiring_soon" ? "EXPIRING SOON" : "EXPIRED";
    const remaining = result.status === "expired"
      ? "No coverage remaining"
      : `${result.years_remaining} yr${result.years_remaining !== 1 ? "s" : ""} / ${fmt(result.miles_remaining)} mi remaining`;
    const text = `Checked a ${result.year} ${result.make} ${result.model}'s battery warranty on @offolab — ${emoji} ${statusLabel}\n${remaining}\nFree check → offolab.com/tools/warranty #UsedEV #EVBuying`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [result]);

  const handleCopyLink = useCallback(async () => {
    const url = "https://offolab.com/tools/warranty?utm_source=twitter&utm_medium=share&utm_campaign=warranty_share";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

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
            {/* VIN input */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">VIN <span className="text-white/25 font-normal">(optional — auto-fills fields below)</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={17}
                  placeholder="e.g. 5YJ3E1EA1JF000001"
                  value={vin}
                  onChange={(e) => handleVinChange(e.target.value)}
                  className="flex-1 min-w-0 bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-[#00d97e]/50 placeholder:text-white/20"
                />
                <button
                  onClick={handleVinDecode}
                  disabled={vin.length < 17 || vinLoading}
                  className="px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.10] text-white/70 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {vinLoading ? "Decoding…" : "Decode"}
                </button>
              </div>
              {vinError && <p className="text-yellow-400/80 text-xs mt-1.5">{vinError}</p>}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-white/25">or enter manually</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

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

            {/* Share row */}
            <div className="flex gap-3">
              <button
                onClick={handleTweetShare}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-black text-white hover:bg-gray-900 transition-colors"
              >
                <XIcon />
                Post to X
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/[0.12] text-white/60 hover:text-white hover:border-white/20 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[#00d97e]" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy link"}
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

export default function WarrantyCheckerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00d97e]/30 border-t-[#00d97e] rounded-full animate-spin" />
      </div>
    }>
      <WarrantyCheckerInner />
    </Suspense>
  );
}
