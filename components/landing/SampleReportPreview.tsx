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
        className="w-full flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
      >
        {open ? (
          <>Hide example result <ChevronUp className="w-3.5 h-3.5" /></>
        ) : (
          <>See example result <ChevronDown className="w-3.5 h-3.5" /></>
        )}
      </button>

      {open && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
          {/* Label */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">
              Example output — your result is based on your listing
            </p>
          </div>

          {/* Verdict */}
          <div className="px-5 pb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-yellow-400/30 bg-yellow-400/10 text-yellow-300 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              Conditional Buy
            </span>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Top risks */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Top risks</p>
            </div>
            <ul className="space-y-2">
              {SAMPLE_RISKS.map((r) => (
                <li key={r.label} className="flex gap-2.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white/80">{r.label}</p>
                    <p className="text-xs text-white/50">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Questions */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Questions to ask</p>
            </div>
            <ul className="space-y-1.5">
              {SAMPLE_QUESTIONS.map((q) => (
                <li key={q} className="flex gap-2 text-sm text-white/60">
                  <span className="shrink-0 text-blue-400 font-bold">→</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Locked row */}
          <Link
            href="/receipt"
            className="flex items-center justify-between px-5 py-3 bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
          >
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Full breakdown · Negotiation script · Checklist · PDF export</span>
            </div>
            <span className="text-xs font-semibold text-[#00d97e] whitespace-nowrap group-hover:text-[#00f090] ml-3">
              Analyze a listing →
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
