"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, AlertTriangle, MessageSquare, Lock } from "lucide-react";

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

export default function SampleReportPreview() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-2"
      >
        {open ? (
          <>Hide example result <ChevronUp className="w-3.5 h-3.5" /></>
        ) : (
          <>See example result <ChevronDown className="w-3.5 h-3.5" /></>
        )}
      </button>

      {open && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {/* Label */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Example output — your result is based on your listing
            </p>
          </div>

          {/* Verdict */}
          <div className="px-5 pb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-yellow-300 bg-yellow-100 text-yellow-800 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              Conditional Buy
            </span>
          </div>

          <div className="border-t border-gray-100" />

          {/* Top risks */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top risks</p>
            </div>
            <ul className="space-y-2">
              {SAMPLE_RISKS.map((r) => (
                <li key={r.label} className="flex gap-2.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.label}</p>
                    <p className="text-xs text-gray-500">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-100" />

          {/* Questions */}
          <div className="px-5 py-3">
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

          <div className="border-t border-gray-100" />

          {/* Locked row */}
          <Link
            href="/receipt"
            className="flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Full breakdown · Negotiation script · Checklist · PDF export</span>
            </div>
            <span className="text-xs font-semibold text-blue-600 whitespace-nowrap group-hover:text-blue-700 ml-3">
              Analyze a listing →
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
