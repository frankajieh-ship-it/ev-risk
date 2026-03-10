/**
 * HowWeDecidedBlock - Explainability Component
 *
 * Transparent decision-making explanation.
 * Shows: decision rules, assumptions made, and unknowns (with "Not shown yet" language).
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MATCHMAKER_COPY } from "@/lib/copy/matchmaker";
import type { MinimumViableRoutine } from "@/types/v2";

interface HowWeDecidedBlockProps {
  routine: MinimumViableRoutine;
  hasVehicleData: boolean;
}

export default function HowWeDecidedBlock({ routine, hasVehicleData }: HowWeDecidedBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Build assumptions based on routine
  const assumptions: string[] = [];

  if (routine.charging_access === "home") {
    assumptions.push("Assumes you can charge at home on most nights");
  } else if (routine.charging_access === "work") {
    assumptions.push("Assumes you have reliable access to workplace charging");
  } else {
    assumptions.push("Assumes you're comfortable using public charging networks");
  }

  if (routine.climate) {
    const climateLabel =
      routine.climate === "winter"
        ? "cold winters"
        : routine.climate === "hot"
        ? "hot summers"
        : "mild weather";
    assumptions.push(`Assumes ${climateLabel} climate year-round`);
  }

  if (routine.longest_day_pattern) {
    assumptions.push("Assumes your longest day happens occasionally (not daily)");
  }

  // Build unknowns (things we DON'T know yet)
  const unknowns: string[] = [];

  if (!hasVehicleData) {
    unknowns.push(
      "Battery degradation — we don't have this vehicle's specific health data"
    );
  }

  unknowns.push("Your specific commute route elevation and terrain");
  unknowns.push("Your driving style (highway speed vs city, aggressive vs gentle)");
  unknowns.push("Whether you pre-condition the cabin (can impact range)");

  if (routine.charging_access === "public") {
    unknowns.push("Charger availability and wait times in your area");
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      {/* Collapsible Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {MATCHMAKER_COPY.howWeDecided.title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        )}
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-5 space-y-5 pt-5 border-t border-gray-100">
          {/* Decision Rules */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 text-sm">
              {MATCHMAKER_COPY.howWeDecided.subtitle}
            </h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span>
                  <strong>Daily range need:</strong> Weekly miles ÷ 7, with buffer for variations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span>
                  <strong>Longest day requirement:</strong> Peak usage days need extra buffer
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span>
                  <strong>Charging access type:</strong> Home/work/public affects stress level
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span>
                  <strong>Climate impact:</strong> Cold weather reduces range by 20-40%, hot by 10-20%
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span>
                  <strong>Real-world vs EPA:</strong> We use real-world range (typically 5-15% lower)
                </span>
              </li>
            </ul>
          </div>

          {/* Assumptions */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 text-sm">
              {MATCHMAKER_COPY.howWeDecided.assumptionsLabel}
            </h4>
            <ul className="space-y-2 text-sm text-gray-600">
              {assumptions.map((assumption, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Unknowns */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 text-sm">
              {MATCHMAKER_COPY.howWeDecided.unknownsLabel}
            </h4>
            <ul className="space-y-2 text-sm text-gray-400 italic">
              {unknowns.map((unknown, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-gray-300 font-bold mt-0.5">?</span>
                  <span>{unknown}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3 italic">
              We never imply defects without evidence. These are simply factors
              we can't measure from your routine alone.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
