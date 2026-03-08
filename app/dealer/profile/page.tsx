/**
 * Dealership Profile Page
 *
 * Edit dealership info: name, phone, address, description, etc.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DealershipProfile {
  id: string;
  name: string;
  slug: string;
  phone: string;
  website: string;
  description: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  ev_specialties: string[];
}

const EMPTY_PROFILE: DealershipProfile = {
  id: "",
  name: "",
  slug: "",
  phone: "",
  website: "",
  description: "",
  address_line1: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  ev_specialties: [],
};

export default function DealerProfilePage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<DealershipProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;

    const load = async () => {
      try {
        const res = await fetch("/api/dealer/profile", { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setProfile({ ...EMPTY_PROFILE, ...data.dealership });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session?.access_token, authHeaders]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/dealer/profile", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          website: profile.website,
          description: profile.description,
          address_line1: profile.address_line1,
          city: profile.city,
          state: profile.state,
          zip: profile.zip,
          country: profile.country,
          ev_specialties: profile.ev_specialties,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof DealershipProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
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
        <h1 className="text-xl font-bold text-gray-900">Dealership Profile</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Basic Info */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dealership Name</label>
              <input
                value={profile.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Website</label>
                <input
                  value={profile.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={profile.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                placeholder="Tell buyers about your dealership..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Address</h2>
          <div className="space-y-3">
            <input
              value={profile.address_line1}
              onChange={(e) => updateField("address_line1", e.target.value)}
              placeholder="Street address"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                value={profile.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="City"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                value={profile.state}
                onChange={(e) => updateField("state", e.target.value)}
                placeholder="State"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                value={profile.zip}
                onChange={(e) => updateField("zip", e.target.value)}
                placeholder="ZIP"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Slug (read-only) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Profile URL Slug</label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
            /dealers/{profile.slug}
          </div>
        </div>
      </div>
    </div>
  );
}
