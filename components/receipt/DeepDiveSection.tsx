/**
 * DeepDiveSection — Renders the Buyer Pass deep dive content
 *
 * Market comparison, negotiation scripts, cost of ownership,
 * extended inspection, model-specific issues, and deep verdict.
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  MessageSquare,
  DollarSign,
  Search,
  AlertTriangle,
  CheckCircle,
  Copy,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { formatPrice, type Region } from "@/lib/region";
import type { DeepDiveContent } from "@/types/receipt";

interface DeepDiveSectionProps {
  deepDive: DeepDiveContent;
  receiptId?: string;
  region?: Region;
}

/** Build a search URL for a comparable listing given source name + vehicle title. */
function buildSourceUrl(source: string, title: string, price: number): string | null {
  const q = encodeURIComponent(title);
  const s = source.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("cargurus")) return `https://www.cargurus.com/Cars/new/nl_cars_d0#listing=searchResults;zip=;kw=${q}`;
  if (s.includes("autotrader")) return `https://www.autotrader.com/cars-for-sale/all-cars?searchRadius=0&keywords=${q}`;
  if (s.includes("carcom") || s === "carscom") return `https://www.cars.com/shopping/results/?keyword=${q}`;
  if (s.includes("edmunds")) return `https://www.edmunds.com/used-cars/search/?q=${q}`;
  if (s.includes("carmax")) return `https://www.carmax.com/cars/all?search=${q}`;
  if (s.includes("kbb") || s.includes("kelley")) return `https://www.kbb.com/cars-for-sale/all/?search=${q}`;
  if (s.includes("truecar")) return `https://www.truecar.com/used-cars-for-sale/listings/?search%5Bkeyword%5D=${q}`;
  if (s.includes("facebook") || s.includes("marketplace")) return `https://www.facebook.com/marketplace/search?query=${q}`;
  if (s.includes("craigslist")) return `https://craigslist.org/search/cta?query=${q}`;
  if (s.includes("vroom")) return `https://www.vroom.com/cars?search=${q}`;
  if (s.includes("carvana")) return `https://www.carvana.com/cars?search=${q}`;
  // Fallback: Google search scoped to source
  const domain = source.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.]/g, "") + ".com";
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} $${price} site:${domain}`)}`;
}

export default function DeepDiveSection({
  deepDive,
  region = "US",
}: DeepDiveSectionProps) {
  const [copiedScript, setCopiedScript] = useState<number | null>(null);
  const [openScript, setOpenScript] = useState<number | null>(0);

  const copyScript = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedScript(index);
      setTimeout(() => setCopiedScript(null), 2000);
    } catch {
      // Silently fail
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#00d97e]" />
        <h2 className="text-lg font-bold text-white">
          Buyer Pass — Deep Dive
        </h2>
      </div>

      {/* Deep Verdict */}
      <div className="bg-[#00d97e]/[0.08] rounded-2xl border border-[#00d97e]/20 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#00d97e]" />
          <h3 className="text-sm font-semibold text-[#00d97e] uppercase tracking-wider">
            Deep Analysis
          </h3>
        </div>
        <p className="text-sm text-white leading-relaxed">
          {deepDive.verdict_deep}
        </p>
      </div>

      {/* Market Comparison */}
      {deepDive.market_comparison.length > 0 && (() => {
        const comps = deepDive.market_comparison;
        const avgDelta = comps.reduce((sum, c) => sum + c.delta_pct, 0) / comps.length;
        const cheaperCount = comps.filter((c) => c.delta_pct > 0).length; // comps cost MORE = yours is cheaper
        const summary = avgDelta > 15
          ? { text: `Comparables average ${avgDelta.toFixed(0)}% more than yours — this listing is priced well below market.`, color: "text-[#00d97e]", bg: "bg-[#00d97e]/[0.08] border-[#00d97e]/20" }
          : avgDelta > 5
          ? { text: `${cheaperCount} of ${comps.length} comparable${comps.length !== 1 ? "s" : ""} cost more — yours is moderately below market.`, color: "text-blue-300", bg: "bg-blue-500/[0.08] border-blue-500/20" }
          : avgDelta > -5
          ? { text: `Comparables are priced similarly — this listing is in line with the market.`, color: "text-white/60", bg: "bg-white/[0.06] border-white/[0.08]" }
          : { text: `Most comparables are priced lower — this listing may be above market. Ask for justification.`, color: "text-red-400", bg: "bg-red-500/[0.08] border-red-500/20" };
        return (
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Market Comparison</h3>
              </div>
            </div>
            {/* Summary callout */}
            <div className={`mx-4 mt-4 mb-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${summary.bg} ${summary.color}`}>
              {summary.text}
            </div>
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                    <th className="text-left px-4 py-2 font-medium text-white/60">Vehicle</th>
                    <th className="text-right px-4 py-2 font-medium text-white/60">Price</th>
                    <th className="text-right px-4 py-2 font-medium text-white/60">Mileage</th>
                    <th className="text-right px-4 py-2 font-medium text-white/60">vs. Yours</th>
                    <th className="text-left px-4 py-2 font-medium text-white/60">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {comps.map((comp, i) => (
                    <tr key={i} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-4 py-2.5 text-white">{comp.title}</td>
                      <td className="px-4 py-2.5 text-right text-white font-medium">
                        {formatPrice(comp.price, region)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white/60">
                        {comp.mileage.toLocaleString()} mi
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-medium ${
                          comp.delta_pct < 0 ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {comp.delta_pct > 0 ? "+" : ""}
                        {comp.delta_pct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {(() => {
                          const url = comp.source_url ?? buildSourceUrl(comp.source, comp.title, comp.price);
                          return url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/50 hover:text-[#00d97e] transition-colors">
                              {comp.source}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="text-white/50">{comp.source}</span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Extended Inspection */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Extended Inspection Checklist</h3>
        </div>
        <ol className="space-y-2">
          {deepDive.extended_inspection.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
              <span className="text-[#00d97e] font-bold flex-shrink-0 w-5 text-right">
                {i + 1}.
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Negotiation Scripts */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Negotiation Scripts</h3>
          </div>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {deepDive.negotiation_scripts.map((script, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenScript(openScript === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-sm font-medium text-white">
                  {script.scenario}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-white/40 transition-transform ${
                    openScript === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openScript === i && (
                <div className="px-5 pb-4">
                  <div className="bg-[#00d97e]/[0.08] border border-[#00d97e]/20 rounded-lg p-3 mb-2">
                    <p className="text-sm font-medium text-white italic">
                      {script.opening}
                    </p>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed mb-2">
                    {script.body}
                  </p>
                  <button
                    onClick={() =>
                      copyScript(`${script.opening}\n\n${script.body}`, i)
                    }
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition-colors"
                  >
                    {copiedScript === i ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-[#00d97e]" />
                        <span className="text-[#00d97e]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy script</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cost of Ownership */}
      <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-[#00d97e]" />
          <h3 className="text-sm font-semibold text-white">3-Year Cost of Ownership</h3>
        </div>
        <div className="space-y-2">
          <CostRow label="Insurance" value={deepDive.cost_of_ownership.insurance_yr} region={region} />
          <CostRow label="Maintenance" value={deepDive.cost_of_ownership.maintenance_yr} region={region} />
          <CostRow label="Fuel / Charging" value={deepDive.cost_of_ownership.fuel_or_charging_yr} region={region} />
          <CostRow label="Depreciation" value={deepDive.cost_of_ownership.depreciation_yr} region={region} />
          <div className="border-t-2 border-white/[0.10] pt-2 mt-3">
            <div className="flex justify-between">
              <span className="text-sm font-bold text-white">3-Year Total</span>
              <span className="text-sm font-bold text-white">
                {formatPrice(deepDive.cost_of_ownership.total_3yr, region)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Model Known Issues */}
      {deepDive.model_known_issues.length > 0 && (
        <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">
              Model-Specific Known Issues
            </h3>
          </div>
          <ul className="space-y-2">
            {deepDive.model_known_issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

function CostRow({ label, value, region = "US" }: { label: string; value: number; region?: Region }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/60">{label}</span>
      <span className="text-white font-medium">
        {formatPrice(value, region)}/yr
      </span>
    </div>
  );
}
