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
    assumptions.push("You're able to plug in at home most nights — that's your foundation");
  } else if (routine.charging_access === "work") {
    assumptions.push("Workplace charging is consistently available and not constantly taken");
  } else {
    assumptions.push("You're comfortable building a public charging routine and sticking to it");
  }

  if (routine.climate) {
    const climateLabel =
      routine.climate === "winter"
        ? "cold winters (which shrink real-world range)"
        : routine.climate === "hot"
        ? "hot summers (which stress the battery and cabin cooling)"
        : "mild weather without major range swings";
    assumptions.push(`You deal with ${climateLabel}`);
  }

  if (routine.longest_day_pattern) {
    assumptions.push("Your longest driving day is an occasional thing, not your daily commute");
  }

  // Build unknowns (things we DON'T know yet)
  const unknowns: string[] = [];

  if (!hasVehicleData) {
    unknowns.push(
      "This specific car's battery health — a used EV with degraded cells will have less range than the estimates here"
    );
  }

  unknowns.push("Your actual route — hills, highways, and stop-and-go all move the needle");
  unknowns.push("How you drive — consistent highway speeds use more range than mixed city driving");
  unknowns.push("Whether you pre-condition the cabin before long cold drives (it makes a real difference)");

  if (routine.charging_access === "public") {
    unknowns.push("How busy your go-to chargers actually get — wait times can add up");
  }

  return (
    <div className="bg-[#161b22] rounded-xl border border-white/[0.08] p-5 mb-6">
      {/* Collapsible Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white group-hover:text-[#00d97e] transition-colors">
            {MATCHMAKER_COPY.howWeDecided.title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-white/30 group-hover:text-[#00d97e] transition-colors" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/30 group-hover:text-[#00d97e] transition-colors" />
        )}
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-5 space-y-5 pt-5 border-t border-white/[0.08]">
          {/* Decision Rules */}
          <div>
            <h4 className="font-medium text-white mb-3 text-sm">
              {MATCHMAKER_COPY.howWeDecided.subtitle}
            </h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-start gap-2">
                <span className="text-[#00d97e] font-bold mt-0.5">•</span>
                <span>
                  <strong>Daily range need:</strong> Your weekly miles ÷ 7, plus a buffer so you&apos;re never scrambling
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00d97e] font-bold mt-0.5">•</span>
                <span>
                  <strong>Your longest day:</strong> That one big driving day every week or two is usually the stress test
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00d97e] font-bold mt-0.5">•</span>
                <span>
                  <strong>How you charge:</strong> Home charging is the low-stress baseline — public-only takes more planning
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00d97e] font-bold mt-0.5">•</span>
                <span>
                  <strong>Weather:</strong> Cold cuts real-world range 20–40%. We score against your actual climate, not ideal conditions
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00d97e] font-bold mt-0.5">•</span>
                <span>
                  <strong>Real-world range, not EPA:</strong> We use the numbers people actually see on the road — typically 5–15% lower than the sticker
                </span>
              </li>
            </ul>
          </div>

          {/* Assumptions */}
          <div>
            <h4 className="font-medium text-white mb-3 text-sm">
              {MATCHMAKER_COPY.howWeDecided.assumptionsLabel}
            </h4>
            <ul className="space-y-2 text-sm text-white/60">
              {assumptions.map((assumption, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#00d97e] font-bold mt-0.5">✓</span>
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Unknowns */}
          <div>
            <h4 className="font-medium text-white mb-3 text-sm">
              {MATCHMAKER_COPY.howWeDecided.unknownsLabel}
            </h4>
            <ul className="space-y-2 text-sm text-white/40 italic">
              {unknowns.map((unknown, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-white/20 font-bold mt-0.5">?</span>
                  <span>{unknown}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-white/30 mt-3 italic">
              None of these are red flags — just things we can&apos;t know from your routine alone. Add more detail and the score gets sharper.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
