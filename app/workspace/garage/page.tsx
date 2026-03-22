/**
 * Garage Page
 *
 * List of user's saved vehicles with add vehicle form.
 * Supports per-vehicle "New Check" and two-step "Compare" selection.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Car, Plus, X, Loader2, Trash2, Search, GitCompare, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";
import VehicleImage from "@/components/VehicleImage";

interface GarageVehicle {
  id: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  nickname: string | null;
  classification: { category?: string; subCategory?: string } | null;
  notes: string | null;
  created_at: string;
}

function vehicleLabel(v: GarageVehicle): string {
  return `${v.year || ""} ${v.make} ${v.model}`.trim();
}

export default function GaragePage() {
  const { session } = useAuth();
  const router = useRouter();
  const { trackEvent } = useEventTracking();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"vin" | "manual">("vin");
  const [formData, setFormData] = useState({ vin: "", make: "", model: "", year: "", nickname: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [compareBase, setCompareBase] = useState<GarageVehicle | null>(null);

  const headers = useCallback(() => {
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
      : undefined;
  }, [session?.access_token]);

  const loadVehicles = useCallback(async () => {
    const h = headers();
    if (!h) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/garage", { headers: h });
      const data = await res.json();
      if (data.success) setVehicles(data.vehicles);
    } catch {} finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadVehicles();
    trackEvent("my_garage_viewed", {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleAdd = async () => {
    setError("");
    setSubmitting(true);
    const h = headers();
    if (!h) return;

    const body: Record<string, string> = {};
    if (addMode === "vin") {
      if (!formData.vin.trim()) {
        setError("VIN is required");
        setSubmitting(false);
        return;
      }
      body.vin = formData.vin.trim();
    } else {
      if (!formData.make.trim() || !formData.model.trim()) {
        setError("Make and model are required");
        setSubmitting(false);
        return;
      }
      body.make = formData.make.trim();
      body.model = formData.model.trim();
      if (formData.year) body.year = formData.year;
    }
    if (formData.nickname.trim()) body.nickname = formData.nickname.trim();

    try {
      const res = await fetch("/api/workspace/garage", {
        method: "POST",
        headers: h,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to add vehicle");
      } else {
        trackEvent("my_garage_vehicle_added", { mode: addMode });
        setShowAdd(false);
        setFormData({ vin: "", make: "", model: "", year: "", nickname: "" });
        loadVehicles();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const h = headers();
    if (!h) return;
    await fetch(`/api/workspace/garage/${id}`, { method: "DELETE", headers: h });
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    if (compareBase?.id === id) setCompareBase(null);
  };

  const handleCompareClick = (v: GarageVehicle) => {
    if (!compareBase) {
      setCompareBase(v);
      return;
    }
    if (compareBase.id === v.id) {
      setCompareBase(null);
      return;
    }
    // Navigate to compare with both vehicles pre-filled
    const a = encodeURIComponent(vehicleLabel(compareBase));
    const b = encodeURIComponent(vehicleLabel(v));
    router.push(`/compare?a=${a}&b=${b}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Garage</h1>
          <p className="text-sm text-gray-500">Your saved vehicles</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? "Cancel" : "Add Vehicle"}
        </button>
      </div>

      {/* Compare selection banner */}
      {compareBase && (
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <div className="flex items-center gap-2 text-blue-700">
            <GitCompare className="w-4 h-4" />
            <span>Comparing <strong>{vehicleLabel(compareBase)}</strong> — now pick another vehicle</span>
          </div>
          <button
            onClick={() => setCompareBase(null)}
            className="text-blue-500 hover:text-blue-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Vehicle Form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setAddMode("vin")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                addMode === "vin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              <Search className="w-3.5 h-3.5 inline mr-1" />
              By VIN
            </button>
            <button
              onClick={() => setAddMode("manual")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                addMode === "manual" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              Manual Entry
            </button>
          </div>

          {addMode === "vin" ? (
            <input
              type="text"
              placeholder="Enter 17-character VIN"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono tracking-wider"
              maxLength={17}
            />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <input
                placeholder="Make"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                placeholder="Model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                placeholder="Year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          <input
            placeholder="Nickname (optional)"
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleAdd}
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Adding..." : "Add to Garage"}
          </button>
        </div>
      )}

      {/* Vehicle List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Car className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No vehicles in your garage</p>
          <p className="text-sm text-gray-400 mt-1">Add your first vehicle by VIN or make/model</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vehicles.length >= 2 && !compareBase && (
            <p className="text-xs text-gray-400 text-center pb-1">
              Select any vehicle to start a side-by-side comparison
            </p>
          )}
          {vehicles.map((v) => {
            const isCompareBase = compareBase?.id === v.id;
            const isCompareTarget = compareBase && compareBase.id !== v.id;
            return (
              <div
                key={v.id}
                className={`bg-white rounded-xl border p-4 flex items-center gap-4 group transition-all ${
                  isCompareBase
                    ? "border-blue-400 ring-2 ring-blue-100"
                    : "border-gray-200"
                }`}
              >
                <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0">
                  <VehicleImage
                    make={v.make}
                    model={v.model}
                    year={v.year ?? undefined}
                    vin={v.vin ?? undefined}
                    className="w-full h-full rounded-xl"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">
                    {v.nickname || vehicleLabel(v)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    {v.nickname && <span>{vehicleLabel(v)}</span>}
                    {v.trim && <span>&middot; {v.trim}</span>}
                    {v.vin && <span className="font-mono">&middot; {v.vin}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {/* New Check button */}
                  <button
                    onClick={() => router.push(`/receipt?vehicle=${encodeURIComponent(vehicleLabel(v))}`)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                    title="Generate a receipt check for this vehicle"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    New Check
                  </button>

                  {/* Compare button */}
                  {vehicles.length >= 2 && (
                    <button
                      onClick={() => handleCompareClick(v)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isCompareBase
                          ? "bg-blue-600 text-white"
                          : isCompareTarget
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "text-gray-600 bg-gray-100 hover:bg-purple-50 hover:text-purple-700"
                      }`}
                      title={
                        isCompareBase
                          ? "Cancel selection"
                          : isCompareTarget
                          ? `Compare with ${vehicleLabel(compareBase!)}`
                          : "Select for comparison"
                      }
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      {isCompareBase ? "Selected" : isCompareTarget ? "Compare →" : "Compare"}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove from garage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
