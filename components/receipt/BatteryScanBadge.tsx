"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Zap, AlertTriangle } from "lucide-react";

interface BatteryScan {
  has_scan: boolean;
  soh_percent?: number;
  soh_quality?: string;
  soh_color?: "green" | "yellow" | "red";
  capacity_kwh?: number;
  capacity_nominal_kwh?: number;
  capacity_retention_pct?: number;
  cycle_count?: number;
  cell_balance?: { flagged: boolean; delta_mv: number; message: string } | null;
  odometer_miles?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  scanned_at?: string;
  days_since_scan?: number;
  dealer_verified?: boolean;
}

const SOH_COLOR_MAP = {
  green: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" },
  yellow: { bg: "bg-amber-500/10", border: "border-amber-500/25", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" },
  red: { bg: "bg-red-500/10", border: "border-red-500/25", text: "text-red-400", badge: "bg-red-500/20 text-red-300" },
};

export default function BatteryScanBadge({ vin }: { vin: string }) {
  const [scan, setScan] = useState<BatteryScan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vin || vin.length !== 17) { setLoading(false); return; }
    fetch(`/api/battery-scan/${encodeURIComponent(vin)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: BatteryScan | null) => { setScan(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [vin]);

  if (loading || !scan || !scan.has_scan) return null;

  const color = scan.soh_color ?? "green";
  const c = SOH_COLOR_MAP[color];
  const scannedDate = scan.scanned_at
    ? new Date(scan.scanned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className={`mx-5 my-3 rounded-xl border ${c.border} ${c.bg} p-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${c.text} shrink-0`} />
          <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
            Dealer-Verified Battery Scan
          </span>
        </div>
        {scan.dealer_verified && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge} shrink-0`}>
            OBD VERIFIED
          </span>
        )}
      </div>

      {/* SOH + capacity row */}
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <div>
          <div className={`text-3xl font-black ${c.text} leading-none`}>
            {scan.soh_percent?.toFixed(1)}%
          </div>
          <div className="text-xs text-white/40 mt-0.5">State of Health</div>
        </div>

        {scan.capacity_kwh && (
          <div>
            <div className="text-lg font-bold text-white/80 leading-none flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-white/40" />
              {scan.capacity_kwh.toFixed(1)} kWh
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              Measured capacity
              {scan.capacity_nominal_kwh ? ` of ${scan.capacity_nominal_kwh} kWh nominal` : ""}
            </div>
          </div>
        )}

        {scan.cycle_count !== null && scan.cycle_count !== undefined && (
          <div>
            <div className="text-lg font-bold text-white/80 leading-none">
              {scan.cycle_count.toLocaleString()}
            </div>
            <div className="text-xs text-white/40 mt-0.5">Charge cycles</div>
          </div>
        )}
      </div>

      {/* Quality label */}
      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${c.badge} mb-3`}>
        {color === "green" && "✓ Battery in good condition"}
        {color === "yellow" && "⚠ Battery showing moderate wear"}
        {color === "red" && "✗ Significant battery degradation"}
      </div>

      {/* Cell balance warning */}
      {scan.cell_balance?.flagged && (
        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{scan.cell_balance.message} ({scan.cell_balance.delta_mv} mV delta)</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/30">
        {scannedDate && (
          <span>Scanned {scannedDate}{scan.days_since_scan !== undefined ? ` · ${scan.days_since_scan}d ago` : ""}</span>
        )}
        {scan.odometer_miles && (
          <span>At {scan.odometer_miles.toLocaleString()} mi</span>
        )}
        <span className="text-white/20">OBD-II direct read</span>
      </div>
    </div>
  );
}
