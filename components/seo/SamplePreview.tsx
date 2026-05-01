/**
 * SamplePreview — Static mock verdict card (server component)
 *
 * Shows a YELLOW verdict example to demonstrate what the receipt
 * looks like. Matches the real receipt output format.
 */

import { AlertTriangle, CheckCircle, XCircle, Zap, DollarSign, Building2 } from "lucide-react";

export default function SamplePreview() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Verdict header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
          Overall Verdict
        </p>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center mt-0.5">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-yellow-700">
              YELLOW{" "}
              <span className="font-normal text-gray-600">— Proceed with Caution</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              2013 Tesla Model S 60 RWD · $12,995
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Worth verifying no battery health proof provided before committing.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Vehicle Facts */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
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
                    ? "bg-gray-100 text-gray-500"
                    : ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
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
          <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
            <Zap className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold text-gray-700">Battery est.</span>{" "}
              ~82% health · ~332 mi range{" "}
              <span className="text-gray-400">(listed 86,574 mi · confirm with seller)</span>
            </span>
          </div>
        </div>

        {/* Why not green */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Why Not Green?
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
              Proof
            </span>
            <span className="text-xs text-gray-600">No battery health proof provided</span>
          </div>
        </div>

        {/* Fair Price */}
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Fair Price</span>
            <span className="text-[10px] text-gray-400">(85% confidence)</span>
          </div>
          <p className="text-xs text-gray-600">
            $12,995 appears within typical market range for this vehicle{" "}
            <span className="text-gray-400">(market range $12,500–$13,500)</span>.
          </p>
        </div>

        {/* Dealer note */}
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-300" />
          <span>
            <span className="font-medium">Dealer</span> · 90045 — Dealers have more room on
            add-ons and fees than the sticker price.
          </span>
        </div>
      </div>
    </div>
  );
}
