"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

interface VehicleRow {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  // Range / battery
  epa_range_mi: number | null;
  real_world_range_mi: number | null;
  battery_kwh: number | null;
  chemistry: string | null;
  dc_fast_kw: number | null;
  connector_types: string[] | null;
  // Bands
  usable_range_band: string | null;
  dc_fast_band: string | null;
  ac_home_charge_band: string | null;
  winter_sensitivity_band: string | null;
  efficiency_band: string | null;
  // Phase 1 specs
  body_type: string | null;
  seating_capacity: number | null;
  has_heat_pump: boolean | null;
  towing_capacity_lbs: number | null;
  // Phase 2 specs
  drivetrain: string | null;
  cargo_volume_cuft: number | null;
  charge_time_l2_hours: number | null;
  front_legroom_in: number | null;
  rear_legroom_in: number | null;
  doors: number | null;
  exterior_colors: string[] | null;
  interior_colors: string[] | null;
  // Safety
  has_dual_airbags: boolean | null;
  has_side_airbags: boolean | null;
  has_abs: boolean | null;
  has_active_seatbelts: boolean | null;
  has_passenger_airbag: boolean | null;
  // Comfort
  has_ac: boolean | null;
  has_power_windows: boolean | null;
  has_power_locks: boolean | null;
  has_power_steering: boolean | null;
  has_tilt_wheel: boolean | null;
  has_am_fm_radio: boolean | null;
  has_satellite_radio: boolean | null;
  has_keyless_entry: boolean | null;
  has_alarm: boolean | null;
  has_immobilizer: boolean | null;
  has_carplay: boolean | null;
  has_android_auto: boolean | null;
  // Meta
  is_active: boolean;
  data_source: string | null;
  created_at: string | null;
}

type EditMap = Record<string, Partial<VehicleRow>>;

function BoolCell({
  value,
  vehicleId,
  field,
  editing,
  onChange,
}: {
  value: boolean | null;
  vehicleId: string;
  field: string;
  editing: boolean;
  onChange: (id: string, field: string, val: boolean | null) => void;
}) {
  if (!editing) {
    if (value === null || value === undefined) return <span className="text-white/15">—</span>;
    return (
      <span className={value ? "text-[#00d97e] text-xs font-medium" : "text-white/30 text-xs"}>
        {value ? "Yes" : "No"}
      </span>
    );
  }
  return (
    <select
      value={value === null ? "" : value ? "1" : "0"}
      onChange={(e) => {
        const v = e.target.value;
        onChange(vehicleId, field, v === "" ? null : v === "1");
      }}
      className="bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white w-16"
    >
      <option value="">—</option>
      <option value="1">Yes</option>
      <option value="0">No</option>
    </select>
  );
}

function TextCell({
  value,
  vehicleId,
  field,
  editing,
  onChange,
  width = "w-24",
}: {
  value: string | number | null;
  vehicleId: string;
  field: string;
  editing: boolean;
  onChange: (id: string, field: string, val: string | number | null) => void;
  width?: string;
}) {
  if (!editing) {
    return (
      <span className="text-white/70 text-xs">
        {value !== null && value !== undefined ? String(value) : <span className="text-white/15">—</span>}
      </span>
    );
  }
  return (
    <input
      type="text"
      defaultValue={value !== null && value !== undefined ? String(value) : ""}
      onBlur={(e) => {
        const v = e.target.value.trim();
        onChange(vehicleId, field, v === "" ? null : isNaN(Number(v)) ? v : Number(v));
      }}
      className={`bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white ${width}`}
    />
  );
}

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editMap, setEditMap] = useState<EditMap>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"core" | "specs" | "safety" | "comfort">("core");

  const authHeader = adminKey ? `Bearer ${adminKey}` : "";

  const fetchVehicles = useCallback(async () => {
    const isProd = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isProd && !adminKey) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vehicles?active=${showInactive ? "false" : "true"}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVehicles(data.vehicles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [authHeader, showInactive]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const startEdit = (id: string) => {
    setEditingId(id);
    setEditMap({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMap({});
  };

  const handleFieldChange = (id: string, field: string, val: unknown) => {
    setEditMap((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), [field]: val },
    }));
  };

  const saveEdit = async (id: string) => {
    const changes = editMap[id];
    if (!changes || Object.keys(changes).length === 0) { cancelEdit(); return; }
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/admin/vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ id, ...changes }),
      });
      const data = await res.json();
      if (data.success) {
        setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, ...changes } : v));
        setSaveStatus("✓ Saved");
        cancelEdit();
      } else {
        setSaveStatus(`✗ ${data.error}`);
      }
    } catch {
      setSaveStatus("✗ Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!adminKey) { alert("Enter admin key first"); return; }
    const res = await fetch("/api/admin/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ id, is_active: !current }),
    });
    const data = await res.json();
    if (data.success) {
      setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, is_active: !current } : v));
    }
  };

  const filtered = vehicles.filter((v) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      String(v.year).includes(q) ||
      v.trim?.toLowerCase().includes(q)
    );
  });

  const isProd = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);

  // Helper: get live value (edits override stored value)
  const val = <T,>(v: VehicleRow, field: keyof VehicleRow): T => {
    const edits = editMap[v.id];
    return (edits && field in edits ? edits[field as keyof typeof edits] : v[field]) as T;
  };

  const isEditing = (id: string) => editingId === id;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-4 font-mono text-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-white">Vehicle Profiles</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {filtered.length} of {vehicles.length} vehicles · <a href="/admin/deals" className="underline text-white/40 hover:text-white/70">→ Deals</a>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isProd && (
            <input
              type="password"
              placeholder="Admin API key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchVehicles()}
              className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 w-48"
            />
          )}
          <input
            type="text"
            placeholder="Filter make/model/year…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 w-44"
          />
          <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-[#00d97e]"
            />
            Show inactive
          </label>
          <button
            onClick={fetchVehicles}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-lg text-xs hover:border-white/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Column group tabs */}
      <div className="flex gap-1 mb-3">
        {(["core", "specs", "safety", "comfort"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              activeTab === tab
                ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]"
                : "bg-white/[0.04] text-white/50 border-white/10 hover:border-white/30"
            }`}
          >
            {tab === "core" ? "Core / Range" : tab === "specs" ? "Physical Specs" : tab === "safety" ? "Safety" : "Comfort & Tech"}
          </button>
        ))}
      </div>

      {saveStatus && (
        <div className={`mb-3 text-xs px-3 py-2 rounded-lg border ${
          saveStatus.startsWith("✓")
            ? "bg-[#00d97e]/10 border-[#00d97e]/30 text-[#00d97e]"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          {saveStatus}
        </div>
      )}

      {error && <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
      {isProd && !adminKey && !loading && (
        <div className="text-center py-12 text-white/30 text-sm">Enter admin API key above to load vehicles.</div>
      )}
      {loading && <div className="text-center py-12 text-white/30 text-sm">Loading…</div>}

      {!loading && vehicles.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-white/[0.04] border-b border-white/[0.08]">
                {/* Always-visible identity columns */}
                <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Year</th>
                <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Make</th>
                <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Model</th>
                <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Trim</th>
                <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Active</th>

                {activeTab === "core" && <>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">EPA mi</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Real mi</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">kWh</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Chemistry</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">DCFC kW</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Body</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Seats</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Heat Pump</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Tow lbs</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Connectors</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Range Band</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">DC Band</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Winter Band</th>
                </>}

                {activeTab === "specs" && <>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Drivetrain</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Doors</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Cargo cuft</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">L2 Charge h</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Front Leg in</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Rear Leg in</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Ext Colors</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Int Colors</th>
                </>}

                {activeTab === "safety" && <>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Dual Airbags</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Side Airbags</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">ABS</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Active Belts</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Pass Airbag</th>
                </>}

                {activeTab === "comfort" && <>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">AC</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Pwr Windows</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Pwr Locks</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Pwr Steering</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Tilt Wheel</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">AM/FM</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Satellite</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Keyless</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Alarm</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Immobilizer</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">CarPlay</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Android Auto</th>
                </>}

                <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const editing = isEditing(v.id);

                return (
                  <tr key={v.id} className={`border-b border-white/[0.05] hover:bg-white/[0.02] ${!v.is_active ? "opacity-40" : ""}`}>
                    {/* Identity — always shown */}
                    <td className="px-3 py-2 font-medium text-white/80 whitespace-nowrap">{v.year}</td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{v.make}</td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{v.model}</td>
                    <td className="px-3 py-2 text-white/40 whitespace-nowrap">
                      {editing
                        ? <input defaultValue={v.trim ?? ""} onBlur={(e) => handleFieldChange(v.id, "trim", e.target.value || null)} className="bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white w-24" />
                        : (v.trim ?? <span className="text-white/15">—</span>)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleActive(v.id, v.is_active)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                          v.is_active
                            ? "bg-[#00d97e]/15 text-[#00d97e] border-[#00d97e]/30"
                            : "bg-white/[0.06] text-white/30 border-white/10"
                        }`}
                      >
                        {v.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>

                    {/* Core / Range tab */}
                    {activeTab === "core" && <>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "epa_range_mi")} vehicleId={v.id} field="epa_range_mi" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "real_world_range_mi")} vehicleId={v.id} field="real_world_range_mi" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "battery_kwh")} vehicleId={v.id} field="battery_kwh" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        {editing
                          ? <select defaultValue={v.chemistry ?? ""} onChange={(e) => handleFieldChange(v.id, "chemistry", e.target.value || null)} className="bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white">
                              <option value="">—</option>
                              {["LFP", "NMC", "NMC811", "NCA"].map((c) => <option key={c}>{c}</option>)}
                            </select>
                          : <span className="text-white/70">{v.chemistry ?? <span className="text-white/15">—</span>}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "dc_fast_kw")} vehicleId={v.id} field="dc_fast_kw" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        {editing
                          ? <select defaultValue={v.body_type ?? ""} onChange={(e) => handleFieldChange(v.id, "body_type", e.target.value || null)} className="bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white">
                              <option value="">—</option>
                              {["suv","sedan","hatchback","crossover","truck","van","coupe"].map((b) => <option key={b}>{b}</option>)}
                            </select>
                          : <span className="text-white/70">{v.body_type ?? <span className="text-white/15">—</span>}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "seating_capacity")} vehicleId={v.id} field="seating_capacity" editing={editing} onChange={handleFieldChange} width="w-12" />
                      </td>
                      <td className="px-3 py-2">
                        <BoolCell value={val(v, "has_heat_pump")} vehicleId={v.id} field="has_heat_pump" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "towing_capacity_lbs")} vehicleId={v.id} field="towing_capacity_lbs" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2 text-white/40 text-xs">{v.connector_types?.join(", ") ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${
                          v.usable_range_band === "high" ? "text-[#00d97e]" : v.usable_range_band === "low" ? "text-red-400" : "text-yellow-400"
                        }`}>{v.usable_range_band ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-white/40 text-xs">{v.dc_fast_band ?? "—"}</td>
                      <td className="px-3 py-2 text-white/40 text-xs">{v.winter_sensitivity_band ?? "—"}</td>
                    </>}

                    {/* Physical Specs tab */}
                    {activeTab === "specs" && <>
                      <td className="px-3 py-2">
                        {editing
                          ? <select defaultValue={v.drivetrain ?? ""} onChange={(e) => handleFieldChange(v.id, "drivetrain", e.target.value || null)} className="bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white">
                              <option value="">—</option>
                              <option>awd</option><option>rwd</option><option>fwd</option>
                            </select>
                          : <span className="text-white/70 uppercase text-xs font-medium">{v.drivetrain ?? <span className="text-white/15 normal-case font-normal">—</span>}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "doors")} vehicleId={v.id} field="doors" editing={editing} onChange={handleFieldChange} width="w-10" />
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "cargo_volume_cuft")} vehicleId={v.id} field="cargo_volume_cuft" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "charge_time_l2_hours")} vehicleId={v.id} field="charge_time_l2_hours" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "front_legroom_in")} vehicleId={v.id} field="front_legroom_in" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        <TextCell value={val(v, "rear_legroom_in")} vehicleId={v.id} field="rear_legroom_in" editing={editing} onChange={handleFieldChange} />
                      </td>
                      <td className="px-3 py-2">
                        {editing
                          ? <input
                              defaultValue={v.exterior_colors?.join(", ") ?? ""}
                              onBlur={(e) => {
                                const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                handleFieldChange(v.id, "exterior_colors", arr.length ? arr : null);
                              }}
                              placeholder="White, Black, Red…"
                              className="bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white w-40"
                            />
                          : <span className="text-white/60 text-xs">{v.exterior_colors?.join(", ") ?? <span className="text-white/15">—</span>}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {editing
                          ? <input
                              defaultValue={v.interior_colors?.join(", ") ?? ""}
                              onBlur={(e) => {
                                const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                handleFieldChange(v.id, "interior_colors", arr.length ? arr : null);
                              }}
                              placeholder="Black, White, Tan…"
                              className="bg-white/[0.08] border border-white/10 rounded px-1 py-0.5 text-xs text-white w-32"
                            />
                          : <span className="text-white/60 text-xs">{v.interior_colors?.join(", ") ?? <span className="text-white/15">—</span>}</span>}
                      </td>
                    </>}

                    {/* Safety tab */}
                    {activeTab === "safety" && <>
                      {(["has_dual_airbags","has_side_airbags","has_abs","has_active_seatbelts","has_passenger_airbag"] as const).map((f) => (
                        <td key={f} className="px-3 py-2">
                          <BoolCell value={val(v, f)} vehicleId={v.id} field={f} editing={editing} onChange={handleFieldChange} />
                        </td>
                      ))}
                    </>}

                    {/* Comfort & Tech tab */}
                    {activeTab === "comfort" && <>
                      {(["has_ac","has_power_windows","has_power_locks","has_power_steering","has_tilt_wheel","has_am_fm_radio","has_satellite_radio","has_keyless_entry","has_alarm","has_immobilizer","has_carplay","has_android_auto"] as const).map((f) => (
                        <td key={f} className="px-3 py-2">
                          <BoolCell value={val(v, f)} vehicleId={v.id} field={f} editing={editing} onChange={handleFieldChange} />
                        </td>
                      ))}
                    </>}

                    {/* Actions */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => saveEdit(v.id)}
                            disabled={saving}
                            className="px-2.5 py-1 bg-[#00d97e] text-[#0d1117] rounded text-[10px] font-bold hover:bg-[#00f090] disabled:opacity-50"
                          >
                            {saving ? "…" : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2.5 py-1 bg-white/[0.06] text-white/50 rounded text-[10px] hover:text-white/80 border border-white/10"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(v.id)}
                          className="px-2.5 py-1 bg-white/[0.06] text-white/50 rounded text-[10px] hover:text-white/80 border border-white/10 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && vehicles.length > 0 && (
        <div className="text-center py-12 text-white/30 text-sm">No vehicles match &ldquo;{filter}&rdquo;</div>
      )}
    </div>
  );
}
