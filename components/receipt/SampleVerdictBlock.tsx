"use client";

/**
 * SampleVerdictBlock — Static marketing teaser
 *
 * Shows a mock YELLOW verdict for a 2013 Tesla Model S 60 RWD to
 * demonstrate what the receipt analysis looks like before the
 * user pastes their own listing. Matches the real receipt output format.
 */

import { AlertTriangle, CheckCircle, XCircle, Zap, DollarSign, Building2 } from "lucide-react";

export default function SampleVerdictBlock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] overflow-hidden">
      {/* Verdict header */}
      <div className="px-5 py-4 border-b border-white/10">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
          Overall Verdict
        </p>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-yellow-300">
              YELLOW{" "}
              <span className="font-normal text-white/70">— Proceed with Caution</span>
            </p>
            <p className="text-xs text-white/50 mt-0.5">
              2013 Tesla Model S 60 RWD · $12,995
            </p>
            <p className="text-xs text-white/60 mt-1">
              Worth verifying no battery health proof provided before committing.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Vehicle Facts */}
        <div>
          <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
            Vehicle Facts
          </h4>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Clean title", ok: true },
              { label: "86,574 mi", ok: true, neutral: true },
              { label: "No accidents (NMVTIS)", ok: true },
              { label: "No theft record", ok: true },
              { label: "Salvage on record", ok: false },
              { label: "No open recalls", ok: true },
            ].map(({ label, ok, neutral }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium
                  ${neutral
                    ? "bg-white/10 text-white/60"
                    : ok
                    ? "bg-[#00d97e]/10 text-[#00d97e]"
                    : "bg-red-500/10 text-red-400"
                  }`}
              >
                {!neutral && (
                  ok
                    ? <CheckCircle className="w-3 h-3 flex-shrink-0" />
                    : <XCircle className="w-3 h-3 flex-shrink-0" />
                )}
                {label}
              </span>
            ))}
          </div>

          {/* Battery estimate */}
          <div className="mt-3 flex items-start gap-2 text-xs text-white/60">
            <Zap className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold text-white/80">Battery est.</span>{" "}
              ~82% health · ~332 mi range{" "}
              <span className="text-white/40">(listed 86,574 mi · confirm with seller)</span>
            </span>
          </div>
        </div>

        {/* Why not green */}
        <div>
          <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
            Why Not Green?
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
              Proof
            </span>
            <span className="text-xs text-white/70">No battery health proof provided</span>
          </div>
        </div>

        {/* Fair Price */}
        <div className="rounded-xl bg-[#00d97e]/5 border border-[#00d97e]/15 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e]">Fair Price</span>
            <span className="text-[10px] text-white/40">(85% confidence)</span>
          </div>
          <p className="text-xs text-white/70">
            $12,995 appears within typical market range for this vehicle{" "}
            <span className="text-white/50">(market range $12,500–$13,500)</span>.
          </p>
        </div>

        {/* Dealer note */}
        <div className="flex items-start gap-2 text-xs text-white/40">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-white/30" />
          <span>
            <span className="font-medium">Dealer</span> · 90045 — Dealers have more room on
            add-ons and fees than the sticker price.
          </span>
        </div>
      </div>
    </div>
  );
}
