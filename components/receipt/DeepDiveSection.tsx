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
} from "lucide-react";
import { formatPrice, type Region } from "@/lib/region";
import type { DeepDiveContent } from "@/types/receipt";

interface DeepDiveSectionProps {
  deepDive: DeepDiveContent;
  receiptId: string;
  region?: Region;
}

export default function DeepDiveSection({
  deepDive,
  receiptId,
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
        <Sparkles className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">
          Buyer Pass — Deep Dive
        </h2>
      </div>

      {/* Deep Verdict */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wider">
            Deep Analysis
          </h3>
        </div>
        <p className="text-sm text-gray-800 leading-relaxed">
          {deepDive.verdict_deep}
        </p>
      </div>

      {/* Market Comparison */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900">Market Comparison</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2 font-medium text-gray-600">Vehicle</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Price</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Mileage</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">vs. Yours</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Source</th>
              </tr>
            </thead>
            <tbody>
              {deepDive.market_comparison.map((comp, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5 text-gray-800">{comp.title}</td>
                  <td className="px-4 py-2.5 text-right text-gray-800 font-medium">
                    {formatPrice(comp.price, region)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {comp.mileage.toLocaleString()} mi
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-medium ${
                      comp.delta_pct < 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {comp.delta_pct > 0 ? "+" : ""}
                    {comp.delta_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{comp.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extended Inspection */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-gray-900">Extended Inspection Checklist</h3>
        </div>
        <ol className="space-y-2">
          {deepDive.extended_inspection.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
              <span className="text-blue-500 font-bold flex-shrink-0 w-5 text-right">
                {i + 1}.
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Negotiation Scripts */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold text-gray-900">Negotiation Scripts</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {deepDive.negotiation_scripts.map((script, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenScript(openScript === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800">
                  {script.scenario}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    openScript === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openScript === i && (
                <div className="px-5 pb-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                    <p className="text-sm font-medium text-gray-800 italic">
                      {script.opening}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">
                    {script.body}
                  </p>
                  <button
                    onClick={() =>
                      copyScript(`${script.opening}\n\n${script.body}`, i)
                    }
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {copiedScript === i ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-600">Copied!</span>
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">3-Year Cost of Ownership</h3>
        </div>
        <div className="space-y-2">
          <CostRow label="Insurance" value={deepDive.cost_of_ownership.insurance_yr} region={region} />
          <CostRow label="Maintenance" value={deepDive.cost_of_ownership.maintenance_yr} region={region} />
          <CostRow label="Fuel / Charging" value={deepDive.cost_of_ownership.fuel_or_charging_yr} region={region} />
          <CostRow label="Depreciation" value={deepDive.cost_of_ownership.depreciation_yr} region={region} />
          <div className="border-t-2 border-gray-300 pt-2 mt-3">
            <div className="flex justify-between">
              <span className="text-sm font-bold text-gray-900">3-Year Total</span>
              <span className="text-sm font-bold text-gray-900">
                {formatPrice(deepDive.cost_of_ownership.total_3yr, region)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Model Known Issues */}
      {deepDive.model_known_issues.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Model-Specific Known Issues
            </h3>
          </div>
          <ul className="space-y-2">
            {deepDive.model_known_issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
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
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-800 font-medium">
        {formatPrice(value, region)}/yr
      </span>
    </div>
  );
}
