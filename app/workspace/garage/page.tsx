/**
 * Garage Page
 *
 * List of user's saved vehicles with add vehicle form.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Car, Plus, X, Loader2, Trash2, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

export default function GaragePage() {
  const { session } = useAuth();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"vin" | "manual">("vin");
  const [formData, setFormData] = useState({ vin: "", make: "", model: "", year: "", nickname: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Garage</h1>
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
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
                v.classification?.category === "EV"
                  ? "bg-green-50 text-green-700"
                  : v.classification?.category === "PHEV"
                  ? "bg-yellow-50 text-yellow-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {v.classification?.category || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">
                  {v.nickname || `${v.year || ""} ${v.make} ${v.model}`.trim()}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  {v.nickname && <span>{v.year || ""} {v.make} {v.model}</span>}
                  {v.trim && <span>&middot; {v.trim}</span>}
                  {v.vin && <span className="font-mono">&middot; {v.vin}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(v.id)}
                className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove from garage"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
