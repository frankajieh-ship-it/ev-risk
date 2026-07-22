"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, ShieldCheck, Loader2, ChevronRight, CheckCircle2,
  AlertTriangle, RotateCcw, ClipboardList,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PidField {
  name: string;
  description: string;
  unit: string;
  required?: boolean;
}

interface PidMap {
  pid_profile: string;
  protocol: string;
  soh_field: string;
  soh_formula: string;
  pids: Array<{ name: string; mode: string; pid: string; formula: string; unit: string; description: string }>;
}

interface Session {
  session_id: string;
  session_token: string;
  expires_at: string;
  pid_profile: string | null;
  pid_map: PidMap | null;
  vin: string;
}

type Step = "vin" | "confirm" | "scan" | "result";

interface ScanResult {
  soh_percent: number;
  capacity_kwh: number | null;
  cycle_count: number | null;
  cell_delta_mv: number | null;
  vin: string;
  vehicle: string | null;
  badge_active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sohColor(soh: number): { text: string; bg: string; label: string } {
  if (soh >= 90) return { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", label: "Excellent" };
  if (soh >= 80) return { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", label: "Good" };
  if (soh >= 70) return { text: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/25", label: "Fair" };
  return { text: "text-red-400", bg: "bg-red-500/10 border-red-500/25", label: "Poor" };
}

// Key PIDs the dealer manually enters — ordered by importance
const MANUAL_PID_FIELDS: PidField[] = [
  { name: "SOH",         description: "State of Health %",    unit: "%",   required: true },
  { name: "PackVoltage", description: "HV Pack Voltage",      unit: "V",   required: false },
  { name: "MaxCapacity", description: "Max Capacity",         unit: "Ah",  required: false },
  { name: "CellVoltMin", description: "Min Cell Voltage",     unit: "V",   required: false },
  { name: "CellVoltMax", description: "Max Cell Voltage",     unit: "V",   required: false },
  { name: "CycleCount",  description: "Charge Cycle Count",   unit: "",    required: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DealerScanPage() {
  const { session } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("vin");
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState("");
  const [odometer, setOdometer] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState({ year: "", make: "", model: "", trim: "" });
  const [scanSession, setScanSession] = useState<Session | null>(null);
  const [pidValues, setPidValues] = useState<Record<string, string>>({});
  const [obdTool, setObdTool] = useState("obdlink_mx");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  const dealerId = session?.user?.user_metadata?.dealer_id as string | undefined;
  const token = session?.access_token;

  // ── Step 1: register VIN + request session ─────────────────────────────────

  async function handleRequestSession() {
    setVinError("");
    const cleanVin = vin.toUpperCase().trim();
    if (cleanVin.length !== 17) { setVinError("VIN must be exactly 17 characters"); return; }
    if (!dealerId) { setError("Dealer ID not found — please sign out and back in."); return; }
    if (!token) { setError("Not authenticated"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/soh/request-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vin: cleanVin,
          dealer_id: dealerId,
          vehicle_year: vehicleInfo.year ? parseInt(vehicleInfo.year, 10) : undefined,
          vehicle_make: vehicleInfo.make || undefined,
          vehicle_model: vehicleInfo.model || undefined,
          vehicle_trim: vehicleInfo.trim || undefined,
          odometer_miles: odometer ? parseInt(odometer, 10) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to start session"); return; }
      setScanSession(data);
      setStep("confirm");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: submit raw PID readings ───────────────────────────────────────

  async function handleSubmit() {
    if (!scanSession) return;
    const rawPids: Record<string, number> = {};
    for (const [k, v] of Object.entries(pidValues)) {
      if (v !== "") rawPids[k] = parseFloat(v);
    }
    if (rawPids.SOH === undefined) { setError("SOH % is required"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/soh/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: scanSession.session_token,
          obd_tool: obdTool,
          raw_pids: rawPids,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to submit scan"); return; }
      setResult(data);
      setStep("result");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("vin");
    setVin("");
    setVinError("");
    setOdometer("");
    setVehicleInfo({ year: "", make: "", model: "", trim: "" });
    setScanSession(null);
    setPidValues({});
    setError("");
    setResult(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d1117] px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#00d97e]/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-[#00d97e]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Battery SOH Scan</h1>
          <p className="text-xs text-white/40">OBD-II verified health check</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {(["vin", "confirm", "scan", "result"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
              step === s ? "bg-[#00d97e] text-[#0d1117]"
              : (["vin", "confirm", "scan", "result"].indexOf(step) > i) ? "bg-[#00d97e]/20 text-[#00d97e]"
              : "bg-white/[0.06] text-white/30"
            }`}>
              {(["vin", "confirm", "scan", "result"].indexOf(step) > i) ? "✓" : i + 1}
            </div>
            {i < 3 && <div className={`flex-1 h-0.5 ${(["vin", "confirm", "scan", "result"].indexOf(step) > i) ? "bg-[#00d97e]/30" : "bg-white/[0.06]"}`} />}
          </div>
        ))}
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ── Step 1: VIN entry ───────────────────────────────────────────────── */}
      {step === "vin" && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">VIN *</label>
            <input
              type="text"
              value={vin}
              onChange={(e) => { setVin(e.target.value.toUpperCase()); setVinError(""); }}
              maxLength={17}
              placeholder="e.g. 1N4AZ0CP8FC310128"
              className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-white/20 focus:outline-none focus:border-[#00d97e]/50 focus:bg-white/[0.07] transition-colors"
            />
            {vinError && <p className="text-red-400 text-xs mt-1">{vinError}</p>}
            <p className="text-white/25 text-xs mt-1">{vin.length}/17 characters</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Year</label>
              <input
                type="number"
                value={vehicleInfo.year}
                onChange={(e) => setVehicleInfo(v => ({ ...v, year: e.target.value }))}
                placeholder="2022"
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d97e]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Odometer</label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="34500"
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d97e]/50 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Make</label>
              <input
                type="text"
                value={vehicleInfo.make}
                onChange={(e) => setVehicleInfo(v => ({ ...v, make: e.target.value }))}
                placeholder="Nissan"
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d97e]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Model</label>
              <input
                type="text"
                value={vehicleInfo.model}
                onChange={(e) => setVehicleInfo(v => ({ ...v, model: e.target.value }))}
                placeholder="LEAF"
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d97e]/50 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleRequestSession}
            disabled={loading || vin.length !== 17}
            className="w-full py-3.5 bg-[#00d97e] text-[#0d1117] font-bold rounded-xl hover:bg-[#00f090] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Start Scan <ChevronRight className="w-5 h-5" /></>}
          </button>
        </div>
      )}

      {/* ── Step 2: Confirm session + PID profile ──────────────────────────── */}
      {step === "confirm" && scanSession && (
        <div className="space-y-5">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#00d97e]" />
              <span className="text-sm font-semibold text-white">Scan session created</span>
            </div>
            <div className="text-xs text-white/50 font-mono bg-black/20 rounded-lg px-3 py-2">{scanSession.vin}</div>
            {scanSession.pid_profile ? (
              <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>PID profile loaded: <strong>{scanSession.pid_profile}</strong> — this vehicle is fully supported</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>No specific PID profile found for this vehicle. You can still record a manual reading.</span>
              </div>
            )}
          </div>

          {scanSession.pid_map && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">OBD Commands to Run</p>
              <div className="space-y-2">
                {scanSession.pid_map.pids.slice(0, 6).map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="text-white/60">{p.description}</span>
                    <span className="font-mono text-white/30 text-[10px]">Mode {p.mode} PID {p.pid}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-white/30 leading-relaxed">
            Connect your OBD dongle to the vehicle&apos;s OBD-II port, run the scan in your app, then enter the readings on the next screen.
          </p>

          <button
            onClick={() => setStep("scan")}
            className="w-full py-3.5 bg-[#00d97e] text-[#0d1117] font-bold rounded-xl hover:bg-[#00f090] transition-colors flex items-center justify-center gap-2"
          >
            Enter Readings <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Step 3: Manual PID entry ───────────────────────────────────────── */}
      {step === "scan" && (
        <div className="space-y-5">
          <p className="text-sm text-white/50 leading-relaxed">
            Enter the values from your OBD scan app. SOH % is required — all other fields improve accuracy.
          </p>

          <div className="space-y-3">
            {MANUAL_PID_FIELDS.map((field) => (
              <div key={field.name}>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
                  {field.description}
                  {field.unit && <span className="text-white/25 normal-case font-normal">({field.unit})</span>}
                  {field.required && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={pidValues[field.name] ?? ""}
                  onChange={(e) => setPidValues(v => ({ ...v, [field.name]: e.target.value }))}
                  placeholder={field.name === "SOH" ? "e.g. 87.5" : ""}
                  className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d97e]/50 transition-colors"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">OBD Tool Used</label>
            <select
              value={obdTool}
              onChange={(e) => setObdTool(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d97e]/50 transition-colors"
            >
              <option value="obdlink_mx">OBDLink MX+</option>
              <option value="obdlink_cx">OBDLink CX (BLE)</option>
              <option value="veepeak">Veepeak OBDCheck BLE</option>
              <option value="carscanner">Car Scanner ELM OBD2</option>
              <option value="leafspy">LeafSpy Pro</option>
              <option value="other">Other</option>
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !pidValues.SOH}
            className="w-full py-3.5 bg-[#00d97e] text-[#0d1117] font-bold rounded-xl hover:bg-[#00f090] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Submit Scan <ShieldCheck className="w-5 h-5" /></>}
          </button>
        </div>
      )}

      {/* ── Step 4: Result ─────────────────────────────────────────────────── */}
      {step === "result" && result && (() => {
        const c = sohColor(result.soh_percent);
        return (
          <div className="space-y-5">
            <div className={`rounded-2xl border p-6 ${c.bg}`}>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className={`w-5 h-5 ${c.text}`} />
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Battery Scan Complete</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto ${c.text} border ${c.bg}`}>
                  OBD VERIFIED
                </span>
              </div>

              <div className={`text-5xl font-black ${c.text} leading-none mb-1`}>
                {result.soh_percent.toFixed(1)}%
              </div>
              <div className="text-sm text-white/40 mb-4">State of Health — {c.label}</div>

              <div className="grid grid-cols-3 gap-3">
                {result.capacity_kwh && (
                  <div className="bg-black/20 rounded-lg px-3 py-2">
                    <div className="text-sm font-bold text-white/80">{result.capacity_kwh.toFixed(1)} kWh</div>
                    <div className="text-[10px] text-white/30">Capacity</div>
                  </div>
                )}
                {result.cycle_count !== null && result.cycle_count !== undefined && (
                  <div className="bg-black/20 rounded-lg px-3 py-2">
                    <div className="text-sm font-bold text-white/80">{result.cycle_count.toLocaleString()}</div>
                    <div className="text-[10px] text-white/30">Cycles</div>
                  </div>
                )}
                {result.cell_delta_mv !== null && result.cell_delta_mv !== undefined && (
                  <div className="bg-black/20 rounded-lg px-3 py-2">
                    <div className={`text-sm font-bold ${result.cell_delta_mv > 50 ? "text-amber-400" : "text-white/80"}`}>
                      {result.cell_delta_mv} mV
                    </div>
                    <div className="text-[10px] text-white/30">Cell delta</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#00d97e]/[0.06] border border-[#00d97e]/20 rounded-xl px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00d97e] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Badge is now live</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Any OFFO buyer report for VIN {result.vin} will now show the verified battery badge automatically.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={reset}
                className="py-3 bg-white/[0.06] border border-white/[0.10] text-white text-sm font-semibold rounded-xl hover:bg-white/[0.10] transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Scan Another
              </button>
              <button
                onClick={() => router.push("/dealer")}
                className="py-3 bg-[#00d97e] text-[#0d1117] text-sm font-bold rounded-xl hover:bg-[#00f090] transition-colors flex items-center justify-center gap-2"
              >
                <ClipboardList className="w-4 h-4" /> Dashboard
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
