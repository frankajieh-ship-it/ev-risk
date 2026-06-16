"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ShieldCheck, Zap, DollarSign, CheckCircle, AlertTriangle, XCircle, ChevronRight, Loader2 } from "lucide-react";
import { computeChargingTimes, formatHours } from "@/lib/charging-time";
import type { ChargingCurve } from "@/lib/charging-time";
import { computeGasTCO } from "@/lib/gas-tco";

// ── Vehicle presets matching charging-time page ──────────────────────────────
interface VehiclePreset {
  label: string;
  battery_kwh: number;
  real_world_range_mi: number;
  onboard_ac_kw: number;
  dc_fast_kw: number;
  charging_curve: ChargingCurve;
}

const VEHICLE_PRESETS: VehiclePreset[] = [
  { label: "Tesla Model Y (LR)",    battery_kwh: 82,  real_world_range_mi: 310, onboard_ac_kw: 11.5, dc_fast_kw: 250, charging_curve: "flat" },
  { label: "Tesla Model 3 (LR)",    battery_kwh: 82,  real_world_range_mi: 333, onboard_ac_kw: 11.5, dc_fast_kw: 250, charging_curve: "flat" },
  { label: "Hyundai IONIQ 5 (LR)",  battery_kwh: 77,  real_world_range_mi: 266, onboard_ac_kw: 11,   dc_fast_kw: 230, charging_curve: "flat" },
  { label: "Hyundai IONIQ 6 (LR)",  battery_kwh: 77,  real_world_range_mi: 310, onboard_ac_kw: 11,   dc_fast_kw: 230, charging_curve: "flat" },
  { label: "Kia EV6 (LR AWD)",      battery_kwh: 77,  real_world_range_mi: 270, onboard_ac_kw: 11,   dc_fast_kw: 230, charging_curve: "flat" },
  { label: "Ford F-150 Lightning",   battery_kwh: 131, real_world_range_mi: 230, onboard_ac_kw: 19.2, dc_fast_kw: 150, charging_curve: "tapered" },
  { label: "Ford Mustang Mach-E",    battery_kwh: 91,  real_world_range_mi: 270, onboard_ac_kw: 11.5, dc_fast_kw: 150, charging_curve: "tapered" },
  { label: "Chevrolet Bolt EV",      battery_kwh: 65,  real_world_range_mi: 259, onboard_ac_kw: 11.5, dc_fast_kw: 55,  charging_curve: "steep_taper" },
  { label: "Chevy Equinox EV",       battery_kwh: 82,  real_world_range_mi: 280, onboard_ac_kw: 11.5, dc_fast_kw: 150, charging_curve: "tapered" },
  { label: "Rivian R1T (LR+)",       battery_kwh: 135, real_world_range_mi: 314, onboard_ac_kw: 11.5, dc_fast_kw: 200, charging_curve: "tapered" },
  { label: "BMW iX xDrive50",        battery_kwh: 111, real_world_range_mi: 305, onboard_ac_kw: 11,   dc_fast_kw: 200, charging_curve: "tapered" },
  { label: "Volkswagen ID.4 (LR)",   battery_kwh: 82,  real_world_range_mi: 275, onboard_ac_kw: 11,   dc_fast_kw: 135, charging_curve: "tapered" },
  { label: "Audi e-tron 55 quattro", battery_kwh: 86.5, real_world_range_mi: 222, onboard_ac_kw: 11, dc_fast_kw: 150, charging_curve: "tapered" },
  { label: "Audi Q8 e-tron",         battery_kwh: 106, real_world_range_mi: 285, onboard_ac_kw: 11,   dc_fast_kw: 160, charging_curve: "tapered" },
  { label: "Nissan Leaf (40 kWh)",   battery_kwh: 40,  real_world_range_mi: 149, onboard_ac_kw: 6.6,  dc_fast_kw: 50,  charging_curve: "steep_taper" },
  { label: "Lucid Air (Grand Touring)", battery_kwh: 112, real_world_range_mi: 516, onboard_ac_kw: 19.2, dc_fast_kw: 300, charging_curve: "flat" },
  { label: "Cadillac Lyriq",         battery_kwh: 102, real_world_range_mi: 314, onboard_ac_kw: 19.2, dc_fast_kw: 190, charging_curve: "tapered" },
  { label: "Mercedes-Benz EQE",      battery_kwh: 90.6, real_world_range_mi: 305, onboard_ac_kw: 11,  dc_fast_kw: 170, charging_curve: "tapered" },
  { label: "Mercedes-Benz EQS",      battery_kwh: 107.8, real_world_range_mi: 350, onboard_ac_kw: 11, dc_fast_kw: 200, charging_curve: "tapered" },
  { label: "Polestar 2 (LR)",        battery_kwh: 82,  real_world_range_mi: 270, onboard_ac_kw: 11,   dc_fast_kw: 205, charging_curve: "flat" },
];

const MAKE_MODEL_MAP: Record<string, string[]> = {
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  "Hyundai": ["IONIQ 5", "IONIQ 6", "Kona Electric"],
  "Kia": ["EV6", "EV9", "Niro EV"],
  "Ford": ["Focus Electric", "F-150 Lightning", "Mustang Mach-E"],
  "Chevrolet": ["Bolt EV", "Bolt EUV", "Silverado EV", "Equinox EV"],
  "Rivian": ["R1T", "R1S"],
  "BMW": ["iX", "i4", "i5", "i7", "iX3", "X5 xDrive50e", "330e", "745e"],
  "Volkswagen": ["ID.4", "ID.Buzz"],
  "Audi": ["Q4 e-tron", "e-tron GT", "Q8 e-tron"],
  "Mercedes-Benz": ["EQS", "EQE", "EQB", "EQS SUV"],
  "Polestar": ["Polestar 2", "Polestar 3"],
  "Lucid": ["Air"],
  "Nissan": ["Leaf", "Ariya"],
  "GMC": ["Hummer EV", "Sierra EV"],
  "Genesis": ["GV60", "GV70 Electrified", "G80 Electrified"],
  "Toyota": ["bZ4X", "Prius Prime", "RAV4 Prime"],
  "Cadillac": ["Lyriq", "Optiq", "Escalade IQ"],
  "Ram": ["1500 REV"],
  "Dodge": ["Charger Daytona"],
  "Porsche": ["Taycan", "Cayenne E-Hybrid", "Panamera E-Hybrid"],
};

const MAKES = Object.keys(MAKE_MODEL_MAP).sort();
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2010 + 1 }, (_, i) => CURRENT_YEAR - i);

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ── Warranty Widget ───────────────────────────────────────────────────────────

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

function WarrantyWidget({ make: initMake, model: initModel, year: initYear, mileage: initMileage }: {
  make?: string; model?: string; year?: number; mileage?: number;
}) {
  const matchedMake = MAKES.includes(initMake ?? "") ? (initMake ?? "") : "";
  const matchedModel = matchedMake && (MAKE_MODEL_MAP[matchedMake] ?? []).includes(initModel ?? "")
    ? (initModel ?? "") : "";

  const [make, setMake] = useState(matchedMake);
  const [model, setModel] = useState(matchedModel);
  const [year, setYear] = useState<number | "">(
    initYear && initYear >= 2010 && initYear <= CURRENT_YEAR ? initYear : ""
  );
  const [mileage, setMileage] = useState(initMileage && initMileage > 0 ? String(initMileage) : "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = make ? (MAKE_MODEL_MAP[make] ?? []) : [];
  const canSubmit = make && model && year !== "" && mileage && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({
        make, model, year: String(year),
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

  if (result) {
    const statusColor = result.status === "covered"
      ? "text-[#00d97e]"
      : result.status === "expiring_soon"
      ? "text-yellow-400"
      : "text-red-400";
    const StatusIcon = result.status === "covered"
      ? CheckCircle
      : result.status === "expiring_soon"
      ? AlertTriangle
      : XCircle;
    const worstPct = Math.max(result.pct_time_used, result.pct_miles_used);
    const barColor = result.status === "covered"
      ? "bg-[#00d97e]"
      : result.status === "expiring_soon"
      ? "bg-yellow-400"
      : "bg-red-400";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${statusColor}`}>
            <StatusIcon className="w-5 h-5" />
            <span className="font-semibold text-base capitalize">{result.status.replace("_", " ")}</span>
          </div>
          <button onClick={() => setResult(null)} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Check again
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Coverage used</span>
            <span>{Math.round(worstPct)}%</span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(100, worstPct)}%` }} />
          </div>
        </div>

        {result.status !== "expired" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.04] rounded-lg p-3">
              <p className="text-xs text-white/30 mb-0.5">Years left</p>
              <p className="text-sm font-semibold text-white">{result.years_remaining} yr{result.years_remaining !== 1 ? "s" : ""}</p>
            </div>
            <div className="bg-white/[0.04] rounded-lg p-3">
              <p className="text-xs text-white/30 mb-0.5">Miles left</p>
              <p className="text-sm font-semibold text-white">{fmt(result.miles_remaining)} mi</p>
            </div>
          </div>
        )}

        {result.status === "expired" && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-3">
            <p className="text-xs text-red-300">Battery warranty expired. Replacement cost estimate:</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              ${fmt(result.replacement_cost_low)}–${fmt(result.replacement_cost_high)}
            </p>
          </div>
        )}

        <Link
          href={`/tools/warranty?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}&mileage=${mileage}`}
          className="flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          target="_blank"
        >
          Full warranty details <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-white/40 mb-1">Make</label>
          <select
            value={make}
            onChange={(e) => { setMake(e.target.value); setModel(""); setResult(null); }}
            className="w-full bg-[#0d1117] border border-white/[0.10] rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#00d97e]/50"
          >
            <option value="">Select make</option>
            {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => { setModel(e.target.value); setResult(null); }}
            disabled={!make}
            className="w-full bg-[#0d1117] border border-white/[0.10] rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#00d97e]/50 disabled:opacity-40"
          >
            <option value="">Select model</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-white/40 mb-1">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
            className="w-full bg-[#0d1117] border border-white/[0.10] rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#00d97e]/50"
          >
            <option value="">Year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Current mileage</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 35,000"
            value={mileage}
            onChange={(e) => setMileage(e.target.value.replace(/[^0-9,]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
            className="w-full bg-[#0d1117] border border-white/[0.10] rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#00d97e]/50 placeholder:text-white/20"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00d97e] text-black text-sm font-semibold hover:bg-[#00c070] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check Warranty"}
      </button>
    </div>
  );
}

// ── Charging Time Widget ──────────────────────────────────────────────────────

function ChargingWidget({ make, model, batteryKwh: initBatteryKwh, rangeMi: initRangeMi, dcFastKw: initDcFastKw }: {
  make?: string; model?: string; batteryKwh?: number; rangeMi?: number; dcFastKw?: number;
}) {
  const vehicleLabel = [make, model].filter(Boolean).join(" ");
  const autoPreset = VEHICLE_PRESETS.find((p) => {
    if (!make || !model) return false;
    const lbl = p.label.toLowerCase();
    return lbl.includes(make.toLowerCase()) && lbl.includes(model.toLowerCase().split(" ")[0]);
  }) ?? null;

  // Use extracted EV specs first, then preset match, then defaults
  const [preset, setPreset] = useState<VehiclePreset | null>(initBatteryKwh ? null : autoPreset);
  const [batteryKwh, setBatteryKwh] = useState(initBatteryKwh ?? autoPreset?.battery_kwh ?? 75);
  const [rangeKwh, setRangeKwh] = useState(initRangeMi ?? autoPreset?.real_world_range_mi ?? 270);
  const [onboardAc, setOnboardAc] = useState(autoPreset?.onboard_ac_kw ?? 11.5);
  const [dcFast, setDcFast] = useState(initDcFastKw ?? autoPreset?.dc_fast_kw ?? 150);
  const [dailyMiles, setDailyMiles] = useState(40);

  const result = useMemo(() => {
    const curve: ChargingCurve = preset?.charging_curve ?? "tapered";
    return computeChargingTimes(batteryKwh, rangeKwh, onboardAc, dcFast, curve, dailyMiles);
  }, [batteryKwh, rangeKwh, onboardAc, dcFast, dailyMiles, preset]);

  const { l1, l2_1150, dcfc, morning_readiness } = result;

  const applyPreset = (p: VehiclePreset) => {
    setPreset(p);
    setBatteryKwh(p.battery_kwh);
    setRangeKwh(p.real_world_range_mi);
    setOnboardAc(p.onboard_ac_kw);
    setDcFast(p.dc_fast_kw);
  };

  return (
    <div className="space-y-4">
      {/* Vehicle selector */}
      <div>
        <label className="block text-xs text-white/40 mb-1">
          {vehicleLabel
            ? initBatteryKwh
              ? `Specs extracted from listing · change if needed`
              : autoPreset
              ? `Matched from listing · change if needed`
              : "Select vehicle for accurate results"
            : "Select vehicle"}
        </label>
        <select
          value={preset?.label ?? ""}
          onChange={(e) => {
            const p = VEHICLE_PRESETS.find((v) => v.label === e.target.value);
            if (p) applyPreset(p);
            else setPreset(null);
          }}
          className="w-full bg-[#0d1117] border border-white/[0.10] rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#00d97e]/50"
        >
          <option value="">{initBatteryKwh ? `Using extracted specs (${batteryKwh} kWh · ${rangeKwh} mi)` : "Choose vehicle…"}</option>
          {VEHICLE_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
        </select>
      </div>

      {/* Daily miles */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white/40">Daily miles</span>
          <span className="text-white font-medium">{dailyMiles} mi</span>
        </div>
        <input
          type="range" min={5} max={200} step={5} value={dailyMiles}
          onChange={(e) => setDailyMiles(Number(e.target.value))}
          className="w-full accent-[#00d97e]"
        />
      </div>

      {/* Key charger rows */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="py-2 px-3 text-xs font-medium text-white/30 text-left">Charger</th>
              <th className="py-2 px-3 text-xs font-medium text-white/30 text-right">Mi/hr</th>
              <th className="py-2 px-3 text-xs font-medium text-white/30 text-right">10→80%</th>
            </tr>
          </thead>
          <tbody>
            {[l1, l2_1150, dcfc].map((r, i) => (
              <tr key={i} className="border-t border-white/[0.04]">
                <td className="py-2.5 px-3 text-xs text-white/60">{r.label}</td>
                <td className="py-2.5 px-3 text-xs text-white text-right font-medium">{r.miles_per_hour}</td>
                <td className="py-2.5 px-3 text-xs text-white/70 text-right">{formatHours(r.hours_to_80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Morning readiness */}
      <div className={`rounded-lg p-3 flex items-start gap-2 ${
        morning_readiness.l1_sufficient ? "bg-[#00d97e]/5 border border-[#00d97e]/20" : "bg-red-400/5 border border-red-400/20"
      }`}>
        {morning_readiness.l1_sufficient
          ? <CheckCircle className="w-4 h-4 text-[#00d97e] shrink-0 mt-0.5" />
          : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        }
        <p className="text-xs text-white/60 leading-relaxed">
          {morning_readiness.l1_sufficient
            ? `8 hrs on a standard outlet recovers ${morning_readiness.miles_recovered_l1} mi — covers your ${dailyMiles}-mi day.`
            : `Standard outlet only recovers ${morning_readiness.miles_recovered_l1} mi overnight. For ${dailyMiles} mi/day you'll need Level 2.`}
        </p>
      </div>

      <Link
        href={`/tools/charging-time`}
        className="flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        target="_blank"
      >
        Full charging calculator <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── TCO Widget ────────────────────────────────────────────────────────────────

const EV_MAINTENANCE_PER_YEAR = 700;
const EV_DEPRECIATION_RATE_5Y = 0.52;

function evInsurancePerYear(price: number): number {
  if (price < 25_000) return 1_600;
  if (price < 40_000) return 2_000;
  if (price < 60_000) return 2_400;
  return 2_800;
}

function computeEV5Y(purchasePrice: number, annualMiles: number, batteryKwh: number, realRange: number, electricityRate: number, federalIncentive: number) {
  const effectivePrice = Math.max(0, purchasePrice - federalIncentive);
  const efficiency = batteryKwh > 0 ? realRange / batteryKwh : 3.5;
  const annualKwh = annualMiles / efficiency;
  const charging5y = Math.round(annualKwh * electricityRate * 5);
  const maintenance5y = EV_MAINTENANCE_PER_YEAR * 5;
  const insurance5y = evInsurancePerYear(purchasePrice) * 5;
  const depreciation5y = Math.round(effectivePrice * EV_DEPRECIATION_RATE_5Y);
  return { effectivePrice, charging5y, maintenance5y, insurance5y, depreciation5y, total5y: charging5y + maintenance5y + insurance5y + depreciation5y };
}

function TcoWidget({ price: initPrice, batteryKwh: initBatteryKwh, rangeMi: initRangeMi }: {
  price?: number; batteryKwh?: number; rangeMi?: number;
}) {
  const defaultPrice = initPrice && initPrice > 5000 ? Math.round(initPrice / 500) * 500 : 35_000;
  const [evPrice, setEvPrice] = useState(defaultPrice);
  const [batteryKwh, setBatteryKwh] = useState(initBatteryKwh ?? 75);
  const [realRange, setRealRange] = useState(initRangeMi ?? 270);
  const [weeklyMiles, setWeeklyMiles] = useState(250);
  const [electricityRate, setElectricityRate] = useState(16);
  const [federalIncentive, setFederalIncentive] = useState(7_500);
  const [gasComparatorPrice, setGasComparatorPrice] = useState(35_000);
  const [gasMpg] = useState(28);
  const [gasPricePerGal] = useState(350);

  const annualMiles = weeklyMiles * 52;

  const ev = useMemo(
    () => computeEV5Y(evPrice, annualMiles, batteryKwh, realRange, electricityRate / 100, federalIncentive),
    [evPrice, annualMiles, batteryKwh, realRange, electricityRate, federalIncentive]
  );

  const gas = useMemo(
    () => computeGasTCO({ purchase_price: gasComparatorPrice, annual_miles: annualMiles, gas_price_per_gallon: gasPricePerGal / 100, mpg: gasMpg }),
    [gasComparatorPrice, annualMiles, gasPricePerGal, gasMpg]
  );

  const savings = gas.total_5y - ev.total5y;
  const savesColor = savings >= 0 ? "text-[#00d97e]" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Price controls */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">EV asking price</span>
            <span className="text-white font-medium">${fmt(evPrice)}</span>
          </div>
          <input type="range" min={15_000} max={100_000} step={500} value={evPrice}
            onChange={(e) => setEvPrice(Number(e.target.value))}
            className="w-full accent-[#00d97e]" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">Gas car to compare</span>
            <span className="text-white font-medium">${fmt(gasComparatorPrice)}</span>
          </div>
          <input type="range" min={15_000} max={80_000} step={500} value={gasComparatorPrice}
            onChange={(e) => setGasComparatorPrice(Number(e.target.value))}
            className="w-full accent-[#00d97e]" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">Weekly miles</span>
            <span className="text-white font-medium">{weeklyMiles} mi</span>
          </div>
          <input type="range" min={50} max={800} step={25} value={weeklyMiles}
            onChange={(e) => setWeeklyMiles(Number(e.target.value))}
            className="w-full accent-[#00d97e]" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">Electricity rate</span>
            <span className="text-white font-medium">$0.{electricityRate}/kWh</span>
          </div>
          <input type="range" min={8} max={40} step={1} value={electricityRate}
            onChange={(e) => setElectricityRate(Number(e.target.value))}
            className="w-full accent-[#00d97e]" />
        </div>
      </div>

      {/* Incentive */}
      <div>
        <p className="text-xs text-white/40 mb-1.5">Federal EV incentive</p>
        <div className="grid grid-cols-3 gap-2">
          {[7_500, 3_750, 0].map((v) => (
            <button
              key={v}
              onClick={() => setFederalIncentive(v)}
              className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${
                federalIncentive === v
                  ? "border-[#00d97e] bg-[#00d97e]/10 text-white"
                  : "border-white/[0.08] text-white/50 hover:border-white/20"
              }`}
            >
              {v === 0 ? "None" : `$${(v / 1000).toFixed(1)}k`}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">5-year EV total</span>
          <span className="text-sm font-semibold text-white">${fmt(ev.total5y)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">5-year gas total</span>
          <span className="text-sm font-semibold text-white">${fmt(gas.total_5y)}</span>
        </div>
        <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">You {savings >= 0 ? "save" : "spend extra"}</span>
          <span className={`text-base font-bold ${savesColor}`}>
            {savings >= 0 ? "+" : "-"}${fmt(Math.abs(savings))}
          </span>
        </div>
      </div>

      <Link
        href="/tools/tco"
        className="flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        target="_blank"
      >
        Full 5-year cost breakdown <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface ReceiptToolsSectionProps {
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  batteryKwh?: number;
  rangeMi?: number;
  dcFastKw?: number;
}

export default function ReceiptToolsSection({ make, model, year, mileage, price, batteryKwh, rangeMi, dcFastKw }: ReceiptToolsSectionProps) {
  const [activeTab, setActiveTab] = useState<"warranty" | "charging" | "tco">("warranty");

  const tabs = [
    { id: "warranty" as const, label: "Warranty", icon: ShieldCheck },
    { id: "charging" as const, label: "Charging", icon: Zap },
    { id: "tco" as const, label: "Cost Calc", icon: DollarSign },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#00d97e] mb-1">Tools</p>
        <h3 className="text-sm font-semibold text-white mb-3">Run the numbers on this EV</h3>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-white/[0.06]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                activeTab === id
                  ? "border-[#00d97e] text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "warranty" && (
          <WarrantyWidget make={make} model={model} year={year} mileage={mileage} />
        )}
        {activeTab === "charging" && (
          <ChargingWidget make={make} model={model} batteryKwh={batteryKwh} rangeMi={rangeMi} dcFastKw={dcFastKw} />
        )}
        {activeTab === "tco" && (
          <TcoWidget price={price} batteryKwh={batteryKwh} rangeMi={rangeMi} />
        )}
      </div>
    </div>
  );
}
