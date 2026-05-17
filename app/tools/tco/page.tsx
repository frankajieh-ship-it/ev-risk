"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Header from "@/components/landing/Header";
import { useEventTracking } from "@/hooks/useEventTracking";
import { computeGasTCO, computeBreakevenYear } from "@/lib/gas-tco";
import { ChevronRight, TrendingDown, DollarSign, ChevronDown, ChevronUp } from "lucide-react";

const EV_MAINTENANCE_PER_YEAR  = 600;
const INSURANCE_PER_YEAR       = 1_800;
const EV_DEPRECIATION_RATE_5Y  = 0.45;

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDollar(n: number) {
  return `$${fmt(n)}`;
}

function computeEV5Y(
  purchasePrice: number,
  annualMiles: number,
  batteryKwh: number,
  realWorldRange: number,
  electricityRate: number,
  federalIncentive: number
) {
  const effectivePrice = Math.max(0, purchasePrice - federalIncentive);
  const efficiency = batteryKwh > 0 ? realWorldRange / batteryKwh : 3.5;
  const annualKwh = annualMiles / efficiency;
  const charging5y = Math.round(annualKwh * electricityRate * 5);
  const maintenance5y = EV_MAINTENANCE_PER_YEAR * 5;
  const insurance5y = INSURANCE_PER_YEAR * 5;
  const depreciation5y = Math.round(effectivePrice * EV_DEPRECIATION_RATE_5Y);
  const total5y = charging5y + maintenance5y + insurance5y + depreciation5y;
  return { effectivePrice, charging5y, maintenance5y, insurance5y, depreciation5y, total5y };
}

function SliderRow({
  label, value, min, max, step = 1, prefix = "", suffix = "", onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  prefix?: string; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-white/50">{label}</label>
        <span className="text-sm font-semibold text-white">{prefix}{value.toLocaleString()}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00d97e]"
      />
      <div className="flex justify-between text-xs text-white/20 mt-0.5">
        <span>{prefix}{min.toLocaleString()}{suffix}</span>
        <span>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>
    </div>
  );
}

function CostBar({
  label, amount, total, color,
}: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-xs text-white/40">{label}</div>
      <div className="flex-1 bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 text-right text-xs text-white/70 font-medium">{fmtDollar(amount)}</div>
    </div>
  );
}

export default function TCOPage() {
  const { trackEvent } = useEventTracking();
  // EV inputs
  const [evPrice, setEvPrice] = useState(35_000);
  const [batteryKwh, setBatteryKwh] = useState(75);
  const [realRange, setRealRange] = useState(270);
  const [weeklyMiles, setWeeklyMiles] = useState(250);
  const [electricityRate, setElectricityRate] = useState(16); // stored as cents
  const [federalIncentive, setFederalIncentive] = useState(7_500);

  // Gas inputs
  const [gasPrice, setGasPrice] = useState(35_000);
  const [gasMpg, setGasMpg] = useState(28);
  const [gasPricePerGal, setGasPricePerGal] = useState(350); // stored as cents

  const [showBreakdown, setShowBreakdown] = useState(false);
  const resultFiredRef = useRef(false);

  useEffect(() => { trackEvent("tco_tool_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const annualMiles = weeklyMiles * 52;

  const ev = useMemo(
    () => computeEV5Y(evPrice, annualMiles, batteryKwh, realRange, electricityRate / 100, federalIncentive),
    [evPrice, annualMiles, batteryKwh, realRange, electricityRate, federalIncentive]
  );

  const gas = useMemo(
    () => computeGasTCO({ purchase_price: gasPrice, annual_miles: annualMiles, gas_price_per_gallon: gasPricePerGal / 100, mpg: gasMpg }),
    [gasPrice, annualMiles, gasPricePerGal, gasMpg]
  );

  const evTotal5y = ev.total5y;
  const gasTotal5y = gas.total_5y;
  const savings = gasTotal5y - evTotal5y;

  const purchasePremium = ev.effectivePrice - gasPrice;
  const annualEvCost = (ev.charging5y + ev.maintenance5y) / 5;
  const annualGasCost = (gas.fuel_5y + gas.maintenance_5y) / 5;

  const breakeven = useMemo(
    () => computeBreakevenYear(purchasePremium, annualEvCost, annualGasCost),
    [purchasePremium, annualEvCost, annualGasCost]
  );

  useEffect(() => {
    if (resultFiredRef.current) return;
    resultFiredRef.current = true;
    trackEvent("tco_tool_result_calculated", {
      ev_saves: savings >= 0,
      savings_abs: Math.abs(savings),
      breakeven_year: breakeven.never ? null : breakeven.year,
    });
  }, [savings, breakeven]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxBar = Math.max(...breakeven.cumulative_savings_by_year.map(Math.abs), 1);

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
            5-Year Cost of Ownership
          </h1>
          <p className="text-white/50 text-base leading-relaxed">
            See the real numbers — EV vs. gas over 5 years, adjusted for your area and habits.
          </p>
        </div>

        {/* Two-column inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* EV column */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00d97e]" />
              Your EV
            </h2>
            <SliderRow label="Purchase price" value={evPrice} min={15_000} max={100_000} step={500} prefix="$" onChange={setEvPrice} />
            <SliderRow label="Battery size" value={batteryKwh} min={20} max={150} step={5} suffix=" kWh" onChange={setBatteryKwh} />
            <SliderRow label="Real-world range" value={realRange} min={80} max={520} step={10} suffix=" mi" onChange={setRealRange} />
            <SliderRow label="Weekly miles" value={weeklyMiles} min={50} max={800} step={25} suffix=" mi" onChange={setWeeklyMiles} />
            <SliderRow label="Electricity rate" value={electricityRate} min={8} max={40} step={1} prefix="$0." suffix="/kWh" onChange={setElectricityRate} />
            <div>
              <p className="text-xs font-medium text-white/50 mb-2">Federal EV incentive</p>
              <div className="grid grid-cols-3 gap-2">
                {[7_500, 3_750, 0].map((v) => (
                  <button
                    key={v}
                    onClick={() => { setFederalIncentive(v); trackEvent("tco_incentive_changed", { incentive: v }); }}
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
          </div>

          {/* Gas column */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              Gas car comparison
            </h2>
            <SliderRow label="Gas car price" value={gasPrice} min={10_000} max={80_000} step={500} prefix="$" onChange={setGasPrice} />
            <SliderRow label="Fuel economy" value={gasMpg} min={10} max={60} step={1} suffix=" mpg" onChange={setGasMpg} />
            <SliderRow label="Gas price" value={gasPricePerGal} min={200} max={700} step={5} prefix="$" suffix="/gal" onChange={(v) => setGasPricePerGal(v)} />
            {/* display formatted */}
            <div className="bg-[#0d1117] rounded-lg p-3 border border-white/[0.06] space-y-1.5 text-xs">
              <div className="flex justify-between text-white/40">
                <span>Annual gas cost</span>
                <span className="text-white/70">{fmtDollar(gas.fuel_annual)}</span>
              </div>
              <div className="flex justify-between text-white/40">
                <span>Annual miles</span>
                <span className="text-white/70">{fmt(annualMiles)} mi</span>
              </div>
              <div className="flex justify-between text-white/40">
                <span>Gas per mile</span>
                <span className="text-white/70">${((gasPricePerGal / 100) / gasMpg).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary result */}
        <div className={`rounded-2xl border p-6 mb-5 ${
          savings >= 0
            ? "border-[#00d97e]/30 bg-[#00d97e]/5"
            : "border-orange-400/30 bg-orange-400/5"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/40 text-xs mb-1">5-year comparison</p>
              <div className="flex items-center gap-2">
                {savings >= 0
                  ? <TrendingDown className="w-5 h-5 text-[#00d97e]" />
                  : <DollarSign className="w-5 h-5 text-orange-400" />
                }
                <span className={`text-2xl font-bold ${savings >= 0 ? "text-[#00d97e]" : "text-orange-400"}`}>
                  {savings >= 0 ? `Save ${fmtDollar(savings)}` : `Pay ${fmtDollar(-savings)} more`}
                </span>
              </div>
              <p className="text-white/50 text-sm mt-1">
                {savings >= 0
                  ? "with the EV over 5 years vs. the gas car"
                  : "with the EV vs. the gas car over 5 years"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d1117]/60 rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">EV — 5-year total</p>
              <p className="text-xl font-bold text-white">{fmtDollar(evTotal5y)}</p>
              <p className="text-xs text-white/30 mt-0.5">
                {fmtDollar(ev.effectivePrice)} effective price
              </p>
            </div>
            <div className="bg-[#0d1117]/60 rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Gas — 5-year total</p>
              <p className="text-xl font-bold text-white">{fmtDollar(gasTotal5y)}</p>
              <p className="text-xs text-white/30 mt-0.5">
                {fmtDollar(gasPrice)} purchase price
              </p>
            </div>
          </div>
        </div>

        {/* Break-even callout */}
        <div className="rounded-xl border border-white/[0.08] bg-[#161b22] p-5 mb-5">
          <h3 className="text-sm font-semibold text-white mb-3">
            {breakeven.never
              ? "EV doesn't break even within 10 years at these numbers"
              : `EV breaks even vs. gas in Year ${breakeven.year}`}
          </h3>

          {/* Year-by-year chart */}
          <div className="flex items-end gap-1 h-24 mt-2">
            {breakeven.cumulative_savings_by_year.map((val, i) => {
              const pct = (Math.abs(val) / maxBar) * 100;
              const positive = val >= 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="flex-1 flex items-end w-full">
                    <div
                      className={`w-full rounded-t transition-all ${positive ? "bg-[#00d97e]/70" : "bg-orange-400/60"}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/25">Yr {i + 1}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-white/25 mt-2">
            Green bars = cumulative savings vs. gas. Orange = still recovering EV purchase premium.
          </p>
        </div>

        {/* Detailed breakdown toggle */}
        <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden mb-6">
          <button
            onClick={() => { setShowBreakdown((v) => { if (!v) trackEvent("tco_breakdown_expanded", {}); return !v; }); }}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            <span className="font-medium">Full cost breakdown</span>
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showBreakdown && (
            <div className="px-5 pb-5 border-t border-white/[0.06]">
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="pb-2 text-xs font-medium text-white/30 text-left">Category</th>
                      <th className="pb-2 text-xs font-medium text-white/30 text-right">EV</th>
                      <th className="pb-2 text-xs font-medium text-white/30 text-right">Gas car</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {[
                      { label: "Purchase price", ev: ev.effectivePrice, gas: gasPrice },
                      { label: "Fuel / Charging (5yr)", ev: ev.charging5y, gas: gas.fuel_5y },
                      { label: "Maintenance (5yr)", ev: ev.maintenance5y, gas: gas.maintenance_5y },
                      { label: "Insurance (5yr)", ev: ev.insurance5y, gas: gas.insurance_5y },
                      { label: "Depreciation (5yr)", ev: ev.depreciation5y, gas: gas.depreciation_5y },
                    ].map((row) => (
                      <tr key={row.label}>
                        <td className="py-2.5 text-white/50">{row.label}</td>
                        <td className="py-2.5 text-white text-right">{fmtDollar(row.ev)}</td>
                        <td className="py-2.5 text-white/60 text-right">{fmtDollar(row.gas)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-white/10">
                      <td className="pt-3 font-semibold text-white">Total (5yr)</td>
                      <td className="pt-3 font-bold text-[#00d97e] text-right">{fmtDollar(evTotal5y)}</td>
                      <td className="pt-3 font-semibold text-white/70 text-right">{fmtDollar(gasTotal5y)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* EV cost bar breakdown */}
              <div className="mt-5 space-y-2">
                <p className="text-xs text-white/30 mb-3">EV cost breakdown</p>
                {[
                  { label: "Purchase", amount: ev.effectivePrice, color: "bg-blue-400" },
                  { label: "Depreciation", amount: ev.depreciation5y, color: "bg-purple-400" },
                  { label: "Insurance", amount: ev.insurance5y, color: "bg-orange-400" },
                  { label: "Maintenance", amount: ev.maintenance5y, color: "bg-yellow-400" },
                  { label: "Charging", amount: ev.charging5y, color: "bg-[#00d97e]" },
                ].map((b) => (
                  <CostBar key={b.label} {...b} total={ev.effectivePrice + ev.depreciation5y + ev.insurance5y + ev.maintenance5y + ev.charging5y} />
                ))}
              </div>

              <p className="text-xs text-white/20 mt-4">
                Assumptions: EV maintenance $600/yr · Gas maintenance $1,200/yr · Insurance $1,800/yr (both) ·
                EV depreciation 45% · Gas depreciation 55%
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <Link
          href="/routine"
          onClick={() => trackEvent("tco_tool_cta_clicked", {})}
          className="flex items-center justify-center gap-2 bg-[#00d97e] hover:bg-[#00c070] text-black font-semibold py-3.5 px-6 rounded-xl transition-colors w-full"
        >
          Find EVs that fit your routine and budget
          <ChevronRight className="w-4 h-4" />
        </Link>

        <p className="text-center text-white/20 text-xs mt-6">
          Estimates only. Actual costs vary by region, driving habits, insurance provider, and vehicle depreciation.
        </p>
      </main>
    </div>
  );
}
