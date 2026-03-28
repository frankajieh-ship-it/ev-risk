/**
 * Garage Page
 *
 * List of user's saved vehicles with add vehicle form.
 * Supports per-vehicle "New Check" and two-step "Compare" selection.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Car, Plus, X, Loader2, Trash2, Search, GitCompare, Zap, LogIn, ChevronRight, ShieldCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import NewsCard, { type NewsArticle } from "@/components/NewsCard";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";
import VehicleImage from "@/components/VehicleImage";
import { getAnonGarage, removeFromAnonGarage, type AnonGarageItem } from "@/lib/anon-garage";
import { getShortlist, removeFromShortlist } from "@/lib/shortlist-store";
import type { ShortlistCandidate } from "@/lib/shortlist-coach";
import RecallBadge, { type Recall } from "@/components/garage/RecallBadge";
import RecallPanel from "@/components/garage/RecallPanel";
import OwnedEvCard from "@/components/garage/OwnedEvCard";

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
  is_owned_ev?: boolean;
  created_at: string;
  // Auction source fields (null for listing-sourced vehicles)
  source?: string;
  auction_source?: string | null;
  auction_result_id?: string | null;
  lot_number?: string | null;
}

type GarageSourceFilter = "all" | "listing" | "copart" | "iaai" | "manheim";

interface OwnedEvReportHealth {
  score: number;
  label: string;
  headline: string;
  watch_area: string | null;
}

function vehicleLabel(v: GarageVehicle): string {
  return `${v.year || ""} ${v.make} ${v.model}`.trim();
}

export default function GaragePage() {
  const { session, isAuthenticated } = useAuth();
  const router = useRouter();
  const { trackEvent } = useEventTracking();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [anonItems, setAnonItems] = useState<AnonGarageItem[]>([]);
  const [shortlistItems, setShortlistItems] = useState<ShortlistCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"vin" | "manual">("vin");
  const [formData, setFormData] = useState({ vin: "", make: "", model: "", year: "", nickname: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [compareBase, setCompareBase] = useState<GarageVehicle | null>(null);
  const [recallPanel, setRecallPanel] = useState<{ vehicle: GarageVehicle; recalls: Recall[] } | null>(null);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  // Owned EV state
  const [ownedEvReports, setOwnedEvReports] = useState<Record<string, OwnedEvReportHealth | null>>({});
  const [ownedEvReportLoading, setOwnedEvReportLoading] = useState<Record<string, boolean>>({});
  const [markingOwnedId, setMarkingOwnedId] = useState<string | null>(null);
  const [justAddedVehicleId, setJustAddedVehicleId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<GarageSourceFilter>("all");

  // Derived: which auction sources exist in the vehicle list
  const hasAuctionSource = useCallback(
    (src: string) => vehicles.some((v) => v.auction_source === src),
    [vehicles]
  );

  const filteredVehicles = useMemo(() => {
    if (sourceFilter === "all") return vehicles;
    if (sourceFilter === "listing") return vehicles.filter((v) => !v.auction_source && v.source !== "auction");
    return vehicles.filter((v) => v.auction_source === sourceFilter);
  }, [vehicles, sourceFilter]);

  const headers = useCallback(() => {
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
      : undefined;
  }, [session?.access_token]);

  const loadVehicles = useCallback(async () => {
    // Always load shortlist + anon garage from localStorage (available for all users)
    setShortlistItems(getShortlist());
    setAnonItems(getAnonGarage());

    const h = headers();
    if (!h) {
      setLoading(false);
      return;
    }
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

  // Fetch news digest once on mount
  useEffect(() => {
    fetch("/api/news?hours=168&limit=4")
      .then((r) => r.json())
      .then((data: { articles?: NewsArticle[] }) => setNewsArticles(data.articles ?? []))
      .catch(() => {/* silent — news is non-critical */});
  }, []);

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
        if (data.vehicle?.id) setJustAddedVehicleId(data.vehicle.id);
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

  const handleMarkAsOwned = async (vehicleId: string) => {
    const h = headers();
    if (!h) return;
    setMarkingOwnedId(vehicleId);
    try {
      const res = await fetch("/api/workspace/garage/owned-ev", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ garage_vehicle_id: vehicleId, ownership_source: "manual" }),
      });
      if (res.ok) {
        setJustAddedVehicleId(null);
        trackEvent("owned_ev_marked", { vehicle_id: vehicleId });
        loadVehicles();
      }
    } catch {} finally {
      setMarkingOwnedId(null);
    }
  };

  const handleGenerateOwnedEvReport = async (vehicleId: string) => {
    const h = headers();
    if (!h) return;
    setOwnedEvReportLoading((prev) => ({ ...prev, [vehicleId]: true }));
    try {
      const res = await fetch(`/api/workspace/garage/${vehicleId}/owned-ev/report`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ report_type: "routine_health" }),
      });
      const data = await res.json();
      if (res.ok && data.report?.output_payload?.routine_health) {
        setOwnedEvReports((prev) => ({ ...prev, [vehicleId]: data.report.output_payload.routine_health }));
      }
    } catch {} finally {
      setOwnedEvReportLoading((prev) => ({ ...prev, [vehicleId]: false }));
    }
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
      {recallPanel && session?.access_token && (
        <RecallPanel
          vehicleLabel={recallPanel.vehicle.nickname || vehicleLabel(recallPanel.vehicle)}
          recalls={recallPanel.recalls}
          authToken={session.access_token}
          onClose={() => setRecallPanel(null)}
          onDismissed={(recallId) => {
            setRecallPanel((prev) =>
              prev ? { ...prev, recalls: prev.recalls.filter((r) => r.id !== recallId) } : null
            );
          }}
        />
      )}
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
      ) : !isAuthenticated && anonItems.length > 0 ? (
        /* Unauthenticated with saved items — show them with sign-in prompt */
        <div className="space-y-3">
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <LogIn className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">Sign in to sync your saved items</p>
              <p className="text-xs text-amber-700 mt-0.5">These are stored locally. Sign in to keep them across devices.</p>
            </div>
          </div>
          {anonItems.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 group">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{item.type.replace("_", " ")}</p>
              </div>
              <button
                onClick={() => { removeFromAnonGarage(item.id); setAnonItems(getAnonGarage()); }}
                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : !isAuthenticated ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Car className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No vehicles saved yet</p>
          <p className="text-sm text-gray-400 mt-1">Save vehicles while browsing receipts or EVFit results</p>
        </div>
      ) : vehicles.length === 0 && shortlistItems.length === 0 ? (
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

          {/* Source filter pills — only shown when auction vehicles exist */}
          {vehicles.length > 0 && (hasAuctionSource("copart") || hasAuctionSource("iaai") || hasAuctionSource("manheim")) && (
            <div className="flex items-center gap-1.5 flex-wrap pb-1">
              {(["all", "listing", "copart", "iaai", "manheim"] as GarageSourceFilter[])
                .filter((f) => {
                  if (f === "all" || f === "listing") return true;
                  return hasAuctionSource(f);
                })
                .map((f) => {
                  const labels: Record<GarageSourceFilter, string> = {
                    all: "All",
                    listing: "Listings",
                    copart: "Copart",
                    iaai: "IAAI",
                    manheim: "Manheim",
                  };
                  const active = sourceFilter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setSourceFilter(f)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                        active
                          ? f === "copart"
                            ? "bg-orange-500 text-white border-orange-500"
                            : f === "iaai"
                            ? "bg-blue-500 text-white border-blue-500"
                            : f === "manheim"
                            ? "bg-purple-500 text-white border-purple-500"
                            : "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
            </div>
          )}

          {vehicles.length > 0 && shortlistItems.length > 0 && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1 pb-0.5">Added Vehicles</p>
          )}
          {/* EVFit Shortlist — localStorage, visible for all users */}
          {shortlistItems.length > 0 && (
            <div className="space-y-2">
              {vehicles.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2 pb-1">EV Fit Shortlist</p>
              )}
              {vehicles.length === 0 && (
                <p className="text-xs text-gray-400 pb-1">
                  Vehicles saved from your EV Fit results. <span className="font-medium">Add a vehicle above</span> to save it permanently.
                </p>
              )}
              {shortlistItems.map((s) => (
                <div key={s.run_id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 group">
                  <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0">
                    <VehicleImage make={s.vehicle_label.split(" ").slice(1, 2).join("")} model={s.vehicle_label.split(" ").slice(2).join(" ")} className="w-full h-full rounded-xl" imgClassName="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{s.vehicle_label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.fit_score.label} · {s.fit_score.score_0_100}/100
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => router.push(`/receipt?vehicle=${encodeURIComponent(s.vehicle_label)}`)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                      title="Generate a receipt check for this vehicle"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      New Check
                    </button>
                    <button
                      onClick={() => { removeFromShortlist(s.run_id); setShortlistItems(getShortlist()); }}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove from shortlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredVehicles.map((v) => {
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">
                      {v.nickname || vehicleLabel(v)}
                    </p>
                    {v.is_owned_ev && (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        My Car
                      </span>
                    )}
                    {v.auction_source && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        v.auction_source === "copart"
                          ? "bg-orange-100 text-orange-800 border-orange-200"
                          : v.auction_source === "iaai"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-purple-100 text-purple-800 border-purple-200"
                      }`}>
                        {v.auction_source.toUpperCase()}
                      </span>
                    )}
                    {session?.access_token && (
                      <RecallBadge
                        vehicleId={v.id}
                        authToken={session.access_token}
                        onViewRecalls={(recalls) => setRecallPanel({ vehicle: v, recalls })}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    {v.nickname && <span>{vehicleLabel(v)}</span>}
                    {v.trim && <span>&middot; {v.trim}</span>}
                    {v.vin && <span className="font-mono">&middot; {v.vin}</span>}
                    {v.is_owned_ev && (
                      <Link
                        href={`/workspace/garage/${v.id}/owned-ev`}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        View Owned EV Report
                      </Link>
                    )}
                    {v.auction_result_id && (
                      <Link
                        href={`/auction/${v.auction_result_id}`}
                        className="flex items-center gap-1 text-orange-600 hover:text-orange-800 font-medium transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Analysis
                      </Link>
                    )}
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

      {/* Mark as Owned prompt — shown after adding a new vehicle */}
      {justAddedVehicleId && isAuthenticated && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">Is this your vehicle?</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Mark it as Owned to unlock your free Routine Health Report.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleMarkAsOwned(justAddedVehicleId)}
              disabled={markingOwnedId === justAddedVehicleId}
              className="flex items-center gap-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {markingOwnedId === justAddedVehicleId ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Marking…</>
              ) : (
                "Yes, mark as Owned"
              )}
            </button>
            <button
              onClick={() => setJustAddedVehicleId(null)}
              className="py-1.5 px-3 rounded-lg text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Not mine
            </button>
          </div>
        </div>
      )}

      {/* My Owned EVs section */}
      {isAuthenticated && vehicles.filter((v) => v.is_owned_ev).length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">My Owned EVs</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {vehicles.filter((v) => v.is_owned_ev).length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles
              .filter((v) => v.is_owned_ev)
              .map((v) => {
                const vinRedacted = v.vin
                  ? v.vin.slice(0, 3) + "****" + v.vin.slice(-4)
                  : null;
                return (
                  <OwnedEvCard
                    key={v.id}
                    vehicleId={v.id}
                    make={v.make}
                    model={v.model}
                    year={v.year}
                    trim={v.trim}
                    vinRedacted={vinRedacted}
                    routineHealth={ownedEvReports[v.id] ?? null}
                    reportLoading={ownedEvReportLoading[v.id] ?? false}
                    sellersReportUnlocked={false}
                    onGenerateReport={() => handleGenerateOwnedEvReport(v.id)}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* EV news digest — shown to all users */}
      {newsArticles.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-semibold text-gray-900">This week&apos;s EV news</h2>
            </div>
            <Link
              href="/news"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-xs text-gray-400 mb-3">Top routine-impact stories · updated daily</p>
          <div className="space-y-2">
            {newsArticles.map((article) => (
              <NewsCard key={article.id} article={article} variant="compact" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
