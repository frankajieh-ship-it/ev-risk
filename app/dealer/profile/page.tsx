/**
 * Dealership Profile Page
 *
 * Edit dealership info: name, phone, address, description, logo, etc.
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Save, Check, Building, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Image from "next/image";

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
  logo_url: string | null;
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
  logo_url: null,
};

export default function DealerProfilePage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<DealershipProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
          setLogoPreview(data.dealership.logo_url ?? null);
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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;

    setLogoError("");
    setLogoUploading(true);

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/dealer/logo", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setProfile((prev) => ({ ...prev, logo_url: data.logo_url }));
        setLogoPreview(data.logo_url);
      } else {
        setLogoError(data.error || "Upload failed");
        setLogoPreview(profile.logo_url);
      }
    } catch {
      setLogoError("Upload failed — please try again");
      setLogoPreview(profile.logo_url);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    if (!session?.access_token) return;
    setLogoPreview(null);
    setProfile((prev) => ({ ...prev, logo_url: null }));
    // Persist the removal via PATCH
    await fetch("/api/dealer/profile", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ logo_url: null }),
    });
  };

  const updateField = (field: keyof DealershipProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const inputCls = "w-full px-3 py-2 bg-white/[0.06] border border-white/[0.10] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/50";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Dealership Profile</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#00d97e] text-[#0d1117] rounded-lg text-sm font-semibold hover:bg-[#00f090] disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="space-y-4">
        {/* Logo Upload */}
        <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Dealership Logo</h2>
          <div className="flex items-center gap-5">
            {/* Preview */}
            <div className="w-20 h-20 rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center justify-center shrink-0 overflow-hidden relative">
              {logoPreview ? (
                <>
                  <Image src={logoPreview} alt="Logo" fill className="object-cover" unoptimized />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-900/80 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </>
              ) : (
                <Building className="w-8 h-8 text-white/20" />
              )}
            </div>

            {/* Upload button + hints */}
            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="flex items-center gap-2 px-4 py-2 bg-[#00d97e] text-[#0d1117] rounded-lg text-sm font-semibold hover:bg-[#00f090] disabled:opacity-40 transition-colors"
              >
                {logoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {logoUploading ? "Uploading…" : logoPreview ? "Change Logo" : "Upload Logo"}
              </button>
              <p className="text-xs text-white/30 mt-1.5">JPEG, PNG, or WebP · Max 2MB</p>
              {logoError && <p className="text-xs text-red-400 mt-1">{logoError}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-6 space-y-5">
          {/* Basic Info */}
          <div>
            <h2 className="text-sm font-semibold text-white/70 mb-3">Basic Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1">Dealership Name</label>
                <input
                  value={profile.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1">Phone</label>
                  <input
                    value={profile.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1">Website</label>
                  <input
                    value={profile.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1">Description</label>
                <textarea
                  value={profile.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={3}
                  placeholder="Tell buyers about your dealership..."
                  className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.10] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/50 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h2 className="text-sm font-semibold text-white/70 mb-3">Address</h2>
            <div className="space-y-3">
              <input
                value={profile.address_line1}
                onChange={(e) => updateField("address_line1", e.target.value)}
                placeholder="Street address"
                className={inputCls}
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  value={profile.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="City"
                  className="px-3 py-2 bg-white/[0.06] border border-white/[0.10] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/50"
                />
                <input
                  value={profile.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  placeholder="State"
                  className="px-3 py-2 bg-white/[0.06] border border-white/[0.10] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/50"
                />
                <input
                  value={profile.zip}
                  onChange={(e) => updateField("zip", e.target.value)}
                  placeholder="ZIP"
                  className="px-3 py-2 bg-white/[0.06] border border-white/[0.10] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/50"
                />
              </div>
            </div>
          </div>

          {/* Slug (read-only) */}
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1">Profile URL Slug</label>
            <div className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white/40 font-mono">
              /dealers/{profile.slug}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
