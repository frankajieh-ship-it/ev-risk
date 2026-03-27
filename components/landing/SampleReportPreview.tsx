"use client";

import { useState } from "react";
import { Lock, ChevronDown, ChevronUp, AlertTriangle, MessageSquare } from "lucide-react";

const SAMPLE_RISKS = [
  { label: "Battery at 81% health", detail: "Below average for mileage — factor in future replacement cost" },
  { label: "No service history on record", detail: "Ask seller for full maintenance documentation" },
  { label: "Priced 8% above comparable listings", detail: "Similar vehicles in your area are selling for less" },
];

const SAMPLE_QUESTIONS = [
  "Can you share the full service history?",
  "Has the battery been tested or inspected recently?",
  "Is there flexibility on the asking price?",
];

const VERDICT_CONFIG = {
  label: "Conditional buy",
  color: "bg-yellow-100 text-yellow-800 border-yellow-300",
  dot: "bg-yellow-400",
};

export default function SampleReportPreview() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      {/* Toggle — mobile primary, desktop hidden */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors sm:hidden mb-2"
      >
        {open ? (
          <>Hide example result <ChevronUp className="w-3.5 h-3.5" /></>
        ) : (
          <>See example result <ChevronDown className="w-3.5 h-3.5" /></>
        )}
      </button>

      <div className={`${open ? "block" : "hidden"} sm:block`}>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          {/* Label */}
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Example output — your result is based on your listing
          </p>

          {/* Verdict badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${VERDICT_CONFIG.color}`}>
              <span className={`w-2 h-2 rounded-full ${VERDICT_CONFIG.dot}`} />
              {VERDICT_CONFIG.label}
            </span>
          </div>

          {/* Top 3 risks */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top risks</p>
            </div>
            <ul className="space-y-2">
              {SAMPLE_RISKS.map((r) => (
                <li key={r.label} className="flex gap-2.5">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.label}</p>
                    <p className="text-xs text-gray-500">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* 3 seller questions */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions to ask</p>
            </div>
            <ul className="space-y-1.5">
              {SAMPLE_QUESTIONS.map((q) => (
                <li key={q} className="flex gap-2 text-sm text-gray-700">
                  <span className="shrink-0 text-blue-400 font-bold">→</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>

          {/* Locked teaser */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 opacity-50 select-none">
              <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-500 blur-[2px]">Negotiation script · Checklist · PDF export</p>
            </div>
            <a
              href="#pricing"
              className="shrink-0 text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              Unlock full analysis →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
