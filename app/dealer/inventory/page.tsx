/**
 * Dealer Inventory Page
 *
 * List, add, edit, and remove vehicles from dealership inventory.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, Package, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface InventoryItem {
  id: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  price_cents: number | null;
  mileage: number | null;
  exterior_color: string | null;
  status: string;
  created_at: string;
}

const EMPTY_FORM = {
  make: "",
  model: "",
  year: "",
  trim: "",
  vin: "",
  price: "",
  mileage: "",
  exterior_color: "",
};

export default function DealerInventoryPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  const loadInventory = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/dealer/inventory", { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, headers]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (item: InventoryItem) => {
    setForm({
      make: item.make,
      model: item.model,
      year: item.year?.toString() || "",
      trim: item.trim || "",
      vin: item.vin || "",
      price: item.price_cents ? (item.price_cents / 100).toString() : "",
      mileage: item.mileage?.toString() || "",
      exterior_color: item.exterior_color || "",
    });
    setEditId(item.id);
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.make.trim() || !form.model.trim()) {
      setError("Make and model are required");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: form.year ? parseInt(form.year) : null,
      trim: form.trim.trim() || null,
      vin: form.vin.trim() || null,
      price_cents: form.price ? Math.round(parseFloat(form.price) * 100) : null,
      mileage: form.mileage ? parseInt(form.mileage) : null,
      exterior_color: form.exterior_color.trim() || null,
    };

    try {
      const url = editId ? `/api/dealer/inventory/${editId}` : "/api/dealer/inventory";
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      setShowForm(false);
      await loadInventory();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this vehicle from inventory?")) return;

    try {
      const res = await fetch(`/api/dealer/inventory/${id}`, {
        method: "DELETE",
        headers: headers(),
      });

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">{editId ? "Edit Vehicle" : "Add Vehicle"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Make *"
                  value={form.make}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  placeholder="Model *"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Year"
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  placeholder="Trim"
                  value={form.trim}
                  onChange={(e) => setForm({ ...form, trim: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <input
                placeholder="VIN"
                value={form.vin}
                onChange={(e) => setForm({ ...form, vin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Price ($)"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  placeholder="Mileage"
                  type="number"
                  min="0"
                  value={form.mileage}
                  onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <input
                placeholder="Exterior Color"
                value={form.exterior_color}
                onChange={(e) => setForm({ ...form, exterior_color: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory list */}
      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No vehicles in your inventory yet.</p>
          <button
            onClick={openAdd}
            className="mt-4 text-sm text-green-600 hover:text-green-700 font-medium"
          >
            Add your first vehicle
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">VIN</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Price</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Status</th>
                <th className="px-5 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">
                      {item.year ? `${item.year} ` : ""}{item.make} {item.model}
                    </p>
                    {item.trim && <p className="text-xs text-gray-500">{item.trim}</p>}
                  </td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell font-mono text-xs">
                    {item.vin || "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">
                    {item.price_cents
                      ? `$${(item.price_cents / 100).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      item.status === "active" ? "bg-green-50 text-green-700" :
                      item.status === "sold" ? "bg-gray-100 text-gray-600" :
                      item.status === "pending" ? "bg-yellow-50 text-yellow-700" :
                      "bg-red-50 text-red-700"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
