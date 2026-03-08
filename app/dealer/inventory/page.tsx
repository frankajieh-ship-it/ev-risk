/**
 * Dealer Inventory Page
 *
 * List, add, edit, and remove vehicles from dealership inventory.
 * Features: VIN scan & autofill, photo upload.
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Loader2, Package, X, Search, ImagePlus, Camera } from "lucide-react";
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
  photo_urls: string[] | null;
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

  // VIN decode state
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinDecoded, setVinDecoded] = useState("");
  const [vinError, setVinError] = useState("");

  // Photo state
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  const authHeadersOnly = useCallback(() => ({
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  const loadInventory = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/dealer/inventory", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, authHeaders]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newPhotoPreviews]);

  const resetFormState = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError("");
    setVinDecoded("");
    setVinError("");
    setExistingPhotos([]);
    setNewPhotoFiles([]);
    newPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewPhotoPreviews([]);
  };

  const openAdd = () => {
    resetFormState();
    setShowForm(true);
  };

  const openEdit = (item: InventoryItem) => {
    resetFormState();
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
    setExistingPhotos(item.photo_urls || []);
    setEditId(item.id);
    setShowForm(true);
  };

  // --- VIN Decode ---
  const handleVinDecode = async () => {
    if (!form.vin.trim()) {
      setVinError("Enter a VIN first");
      return;
    }

    setVinDecoding(true);
    setVinError("");
    setVinDecoded("");

    try {
      const res = await fetch("/api/dealer/vin-decode", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ vin: form.vin.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setVinError(data.error || "VIN decode failed");
        return;
      }

      const d = data.decoded;
      setForm((prev) => ({
        ...prev,
        make: d.make || prev.make,
        model: d.model || prev.model,
        year: d.year ? d.year.toString() : prev.year,
        trim: d.trim || prev.trim,
      }));

      const label = [d.year, d.make, d.model, d.trim].filter(Boolean).join(" ");
      setVinDecoded(label);
    } catch {
      setVinError("Network error");
    } finally {
      setVinDecoding(false);
    }
  };

  // --- Photo handling ---
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const totalPhotos = existingPhotos.length + newPhotoFiles.length + files.length;
    if (totalPhotos > 6) {
      setError(`Maximum 6 photos. You can add ${Math.max(0, 6 - existingPhotos.length - newPhotoFiles.length)} more.`);
      return;
    }

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError(`"${file.name}" is not a valid image. Use JPEG, PNG, or WebP.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`"${file.name}" exceeds 5MB limit.`);
        return;
      }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    setNewPhotoFiles((prev) => [...prev, ...validFiles]);
    setNewPhotoPreviews((prev) => [...prev, ...validPreviews]);
    setError("");
  };

  const removeNewPhoto = (index: number) => {
    URL.revokeObjectURL(newPhotoPreviews[index]);
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  // --- Save ---
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

      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      const itemId = editId || data.item?.id;

      // Update photo_urls if existing photos were removed (edit mode)
      if (editId) {
        const origItem = items.find((i) => i.id === editId);
        const origPhotos = origItem?.photo_urls || [];
        if (JSON.stringify(origPhotos) !== JSON.stringify(existingPhotos)) {
          await fetch(`/api/dealer/inventory/${editId}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ photo_urls: existingPhotos }),
          });
        }
      }

      // Upload new photos if any
      if (newPhotoFiles.length > 0 && itemId) {
        setUploading(true);
        const formData = new FormData();
        formData.append("itemId", itemId);
        newPhotoFiles.forEach((f) => formData.append("files", f));

        const uploadRes = await fetch("/api/dealer/inventory/upload", {
          method: "POST",
          headers: authHeadersOnly(),
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json();
          setError(uploadData.error || "Photo upload failed");
          setSaving(false);
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      setShowForm(false);
      resetFormState();
      await loadInventory();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this vehicle from inventory?")) return;

    try {
      const res = await fetch(`/api/dealer/inventory/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
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

  const totalPhotoCount = existingPhotos.length + newPhotoFiles.length;

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
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">{editId ? "Edit Vehicle" : "Add Vehicle"}</h2>
              <button onClick={() => { setShowForm(false); resetFormState(); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* VIN with decode button */}
              <div>
                <div className="flex gap-2">
                  <input
                    placeholder="VIN (17 characters)"
                    value={form.vin}
                    onChange={(e) => { setForm({ ...form, vin: e.target.value.toUpperCase() }); setVinDecoded(""); setVinError(""); }}
                    maxLength={17}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase"
                  />
                  <button
                    onClick={handleVinDecode}
                    disabled={vinDecoding || !form.vin.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {vinDecoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Scan VIN
                  </button>
                </div>
                {vinDecoded && (
                  <p className="mt-1.5 text-xs text-green-600 font-medium">
                    Decoded: {vinDecoded}
                  </p>
                )}
                {vinError && (
                  <p className="mt-1.5 text-xs text-red-600">{vinError}</p>
                )}
              </div>

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

              {/* Photo upload section */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Photos ({totalPhotoCount}/6)
                </label>

                {/* Existing + new photo thumbnails */}
                {(existingPhotos.length > 0 || newPhotoPreviews.length > 0) && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {existingPhotos.map((url, i) => (
                      <div key={`existing-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeExistingPhoto(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {newPhotoPreviews.map((url, i) => (
                      <div key={`new-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-green-300">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeNewPhoto(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drop zone */}
                {totalPhotoCount < 6 && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-sm">Drop photos here or click to browse</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP up to 5MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowForm(false); resetFormState(); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(saving || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? "Uploading photos..." : saving ? "Saving..." : editId ? "Update" : "Add"}
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
                    <div className="flex items-center gap-3">
                      {item.photo_urls && item.photo_urls.length > 0 ? (
                        <img
                          src={item.photo_urls[0]}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Camera className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.year ? `${item.year} ` : ""}{item.make} {item.model}
                        </p>
                        {item.trim && <p className="text-xs text-gray-500">{item.trim}</p>}
                      </div>
                    </div>
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
