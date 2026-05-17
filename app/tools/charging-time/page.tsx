"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Header from "@/components/landing/Header";
import { useEventTracking } from "@/hooks/useEventTracking";
import { computeChargingTimes, formatHours } from "@/lib/charging-time";
import type { ChargingCurve, ChargerResult } from "@/lib/charging-time";
import { CheckCircle, AlertTriangle, ChevronRight, Zap } from "lucide-react";

// Hand-picked popular EVs with accurate specs
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
  { label: "Nissan Leaf (40 kWh)",   battery_kwh: 40,  real_world_range_mi: 149, onboard_ac_kw: 6.6,  dc_fast_kw: 50,  charging_curve: "steep_taper" },
  { label: "Lucid Air (Grand Touring)", battery_kwh: 112, real_world_range_mi: 516, onboard_ac_kw: 19.2, dc_fast_kw: 300, charging_curve: "flat" },
];


function ChargerRow({ r, highlight }: { r: ChargerResult; highlight?: boolean }) {
  return (
    <tr className={`border-b border-white/[0.05] ${highlight ? "bg-[#00d97e]/5" : ""}`}>
      <td className="py-3 pr-4 text-sm text-white/70 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {highlight && <Zap className="w-3 h-3 text-[#00d97e] shrink-0" />}
          {r.label}
        </div>
      </td>
      <td className="py-3 pr-4 text-sm text-white font-medium text-right">{r.miles_per_hour} mi/hr</td>
      <td className="py-3 pr-4 text-sm text-white/80 text-right">{formatHours(r.hours_to_80)}</td>
      <td className="py-3 text-sm text-white/60 text-right">{formatHours(r.hours_to_100)}</td>
    </tr>
  );
}

export default function ChargingTimeCalculatorPage() {
  const { trackEvent } = useEventTracking();
  const [mode, setMode] = useState<"preset" | "manual">("preset");
  const [selectedPreset, setSelectedPreset] = useState<VehiclePreset | null>(null);
  const [batteryKwh, setBatteryKwh] = useState(75);
  const [rangeKwh, setRangeKwh] = useState(270);
  const [onboardAc, setOnboardAc] = useState(11.5);
  const [dcFast, setDcFast] = useState(150);
  const [dailyMiles, setDailyMiles] = useState(40);
  const resultFiredRef = useRef(false);

  useEffect(() => { trackEvent("charging_tool_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (p: VehiclePreset) => {
    setSelectedPreset(p);
    setBatteryKwh(p.battery_kwh);
    setRangeKwh(p.real_world_range_mi);
    setOnboardAc(p.onboard_ac_kw);
    setDcFast(p.dc_fast_kw);
  };

  const result = useMemo(() => {
    const curve: ChargingCurve = selectedPreset?.charging_curve ?? "tapered";
    return computeChargingTimes(batteryKwh, rangeKwh, onboardAc, dcFast, curve, dailyMiles);
  }, [batteryKwh, rangeKwh, onboardAc, dcFast, dailyMiles, selectedPreset]);

  useEffect(() => {
    if (resultFiredRef.current) return;
    resultFiredRef.current = true;
    trackEvent("charging_tool_result_viewed", {
      vehicle: selectedPreset?.label ?? "manual",
      morning_readiness: result.morning_readiness.l1_sufficient,
    });
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const { l1, l2_720, l2_1150, l2_192, dcfc, morning_readiness } = result;

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
            Charging Time Calculator
          </h1>
          <p className="text-white/50 text-base leading-relaxed">
            See how long it really takes to charge any EV on your home setup — before you switch.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-[#161b22] rounded-xl border border-white/[0.08] mb-6 w-fit">
          {(["preset", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); trackEvent("charging_tool_mode_switched", { mode: m }); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? "bg-[#00d97e] text-black" : "text-white/50 hover:text-white"
              }`}
            >
              {m === "preset" ? "Pick a vehicle" : "Enter specs manually"}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] p-6 mb-6">
          {mode === "preset" ? (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Select vehicle</label>
              <select
                value={selectedPreset?.label ?? ""}
                onChange={(e) => {
                  const p = VEHICLE_PRESETS.find((v) => v.label === e.target.value);
                  if (p) { applyPreset(p); trackEvent("charging_tool_preset_selected", { vehicle: p.label }); }
                  else setSelectedPreset(null);
                }}
                className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50 mb-4"
              >
                <option value="">Choose a vehicle…</option>
                {VEHICLE_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>{p.label}</option>
                ))}
              </select>
              {selectedPreset && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Battery", value: `${selectedPreset.battery_kwh} kWh` },
                    { label: "Real-world range", value: `${selectedPreset.real_world_range_mi} mi` },
                    { label: "Max DCFC", value: `${selectedPreset.dc_fast_kw} kW` },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#0d1117] rounded-lg p-3 border border-white/[0.06]">
                      <p className="text-white font-semibold text-sm">{s.value}</p>
                      <p className="text-white/30 text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Battery size (kWh)</label>
                  <input type="number" min={10} max={200} value={batteryKwh}
                    onChange={(e) => { setBatteryKwh(Number(e.target.value)); setSelectedPreset(null); }}
                    className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Real-world range (mi)</label>
                  <input type="number" min={50} max={600} value={rangeKwh}
                    onChange={(e) => { setRangeKwh(Number(e.target.value)); setSelectedPreset(null); }}
                    className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Onboard AC charger (kW)</label>
                  <input type="number" min={1} max={22} step={0.1} value={onboardAc}
                    onChange={(e) => { setOnboardAc(Number(e.target.value)); setSelectedPreset(null); }}
                    className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Max DC fast charge (kW)</label>
                  <input type="number" min={20} max={400} value={dcFast}
                    onChange={(e) => { setDcFast(Number(e.target.value)); setSelectedPreset(null); }}
                    className="w-full bg-[#0d1117] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#00d97e]/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Daily miles — always shown */}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-white/50">Your daily miles needed</label>
              <span className="text-sm font-semibold text-white">{dailyMiles} mi</span>
            </div>
            <input
              type="range" min={5} max={200} step={5} value={dailyMiles}
              onChange={(e) => setDailyMiles(Number(e.target.value))}
              onMouseUp={(e) => trackEvent("charging_tool_daily_miles_set", { miles: Number((e.target as HTMLInputElement).value) })}
              onTouchEnd={(e) => trackEvent("charging_tool_daily_miles_set", { miles: Number((e.target as HTMLInputElement).value) })}
              className="w-full accent-[#00d97e]"
            />
            <div className="flex justify-between text-xs text-white/20 mt-0.5">
              <span>5 mi</span><span>200 mi</span>
            </div>
          </div>
        </div>

        {/* Results table */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white">Charging times</h2>
            <p className="text-xs text-white/40 mt-0.5">From 10% to 80% and 10% to 100%</p>
          </div>
          <div className="px-5 pb-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-2.5 pr-4 text-xs font-medium text-white/30 text-left">Charger</th>
                  <th className="py-2.5 pr-4 text-xs font-medium text-white/30 text-right">Mi / hr</th>
                  <th className="py-2.5 pr-4 text-xs font-medium text-white/30 text-right">10→80%</th>
                  <th className="py-2.5 text-xs font-medium text-white/30 text-right">10→100%</th>
                </tr>
              </thead>
              <tbody>
                <ChargerRow r={l1} />
                <ChargerRow r={l2_720} />
                <ChargerRow r={l2_1150} highlight={onboardAc >= 11} />
                <ChargerRow r={l2_192} highlight={onboardAc >= 19} />
                <ChargerRow r={dcfc} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Morning readiness */}
        <div className={`rounded-xl border p-5 mb-6 ${
          morning_readiness.l1_sufficient
            ? "border-[#00d97e]/30 bg-[#00d97e]/5"
            : "border-red-400/30 bg-red-400/5"
        }`}>
          <div className="flex items-start gap-3">
            {morning_readiness.l1_sufficient
              ? <CheckCircle className="w-5 h-5 text-[#00d97e] shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            }
            <div>
              <p className={`text-sm font-semibold mb-1 ${morning_readiness.l1_sufficient ? "text-[#00d97e]" : "text-red-400"}`}>
                Morning readiness — L1 overnight check
              </p>
              {morning_readiness.l1_sufficient ? (
                <p className="text-white/70 text-sm">
                  8 hours on a standard outlet recovers <strong className="text-white">{morning_readiness.miles_recovered_l1} miles</strong>.
                  {" "}Your {dailyMiles}-mile day? <strong className="text-white">Covered.</strong>
                </p>
              ) : (
                <p className="text-white/70 text-sm">
                  8 hours on a standard outlet only recovers <strong className="text-white">{morning_readiness.miles_recovered_l1} miles</strong>.
                  {" "}For {dailyMiles} miles/day you&apos;ll need <strong className="text-white">Level 2 charging</strong> or a top-up stop.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/routine"
          onClick={() => trackEvent("charging_tool_cta_clicked", {})}
          className="flex items-center justify-center gap-2 bg-[#00d97e] hover:bg-[#00c070] text-black font-semibold py-3.5 px-6 rounded-xl transition-colors w-full"
        >
          See which EVs work best for your setup
          <ChevronRight className="w-4 h-4" />
        </Link>

        <p className="text-center text-white/20 text-xs mt-6">
          Charging times are estimates. Real-world speeds vary with temperature, state of charge, and charger conditions.
        </p>
      </main>
    </div>
  );
}
