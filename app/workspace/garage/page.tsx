"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Car, Plus, X, Loader2, Trash2, Search, GitCompare, Zap, LogIn,
  ShieldCheck, ExternalLink, Star, Bookmark, Key,
  DollarSign, Link2, AlertCircle,
  BarChart2, FileText, HelpCircle, Clock, MapPin,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";
import VehicleImage from "@/components/VehicleImage";
import { getAnonGarage, removeFromAnonGarage, type AnonGarageItem } from "@/lib/anon-garage";
import { getShortlist, removeFromShortlist } from "@/lib/shortlist-store";
import type { ShortlistCandidate } from "@/lib/shortlist-coach";
import RecallBadge, { type Recall } from "@/components/garage/RecallBadge";
import RecallPanel from "@/components/garage/RecallPanel";
import StarRating from "@/components/garage/StarRating";
import ReviewModal, { type GarageReview } from "@/components/garage/ReviewModal";

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
  source?: string;
  auction_source?: string | null;
  auction_result_id?: string | null;
  lot_number?: string | null;
  // Receipt/analysis data (populated from linked receipt if available)
  impact_score?: number | null;
  verdict?: string | null;
  listed_price?: number | null;
  market_avg?: number | null;
  vs_market?: number | null;
  mileage?: number | null;
  location?: string | null;
  estimated_range?: number | null;
  battery_health_pct?: number | null;
}

type GarageFilter = "all" | "shortlisted" | "owned";
type GarageSort = "score" | "price" | "range" | "added";
type DetailTab = "report" | "questions" | "vin";

interface OwnedEvReportHealth {
  score: number;
  label: string;
  headline: string;
  watch_area: string | null;
}

function vehicleLabel(v: GarageVehicle): string {
  return `${v.year || ""} ${v.make} ${v.model}`.trim();
}

function verdictColor(verdict: string | null | undefined) {
  switch (verdict?.toLowerCase()) {
    case "good deal":   return { bg: "bg-[#00d97e]/15", text: "text-[#00d97e]",   border: "border-[#00d97e]/30" };
    case "fair":        return { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30" };
    case "overpriced":  return { bg: "bg-red-500/15",    text: "text-red-400",    border: "border-red-500/30" };
    default:            return { bg: "bg-white/[0.06]",  text: "text-white/50",   border: "border-white/[0.10]" };
  }
}

export default function GaragePage() {
  const { session, isAuthenticated } = useAuth();
  const router = useRouter();
  const { trackEvent } = useEventTracking();

  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [anonItems, setAnonItems] = useState<AnonGarageItem[]>([]);
  const [shortlistItems, setShortlistItems] = useState<ShortlistCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  // Add vehicle modal
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"url" | "vin" | "manual">("url");
  const [formData, setFormData] = useState({ url: "", vin: "", make: "", model: "", year: "", nickname: "" });
  const [addVehicleType, setAddVehicleType] = useState<"shortlisted" | "owned">("shortlisted");
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  // Filters / sort
  const [activeFilter, setActiveFilter] = useState<GarageFilter>("all");
  const [activeSort, setActiveSort] = useState<GarageSort>("added");

  // Detail panel
  const [detailVehicle, setDetailVehicle] = useState<GarageVehicle | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("report");

  // Other state
  const [compareBase, setCompareBase] = useState<GarageVehicle | null>(null);
  const [recallPanel, setRecallPanel] = useState<{ vehicle: GarageVehicle; recalls: Recall[] } | null>(null);
  const [ownedEvReportLoading, setOwnedEvReportLoading] = useState<Record<string, boolean>>({});
  const [markingOwnedId, setMarkingOwnedId] = useState<string | null>(null);
  const [justAddedVehicleId, setJustAddedVehicleId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, GarageReview | null>>({});
  const [reviewModal, setReviewModal] = useState<{ vehicleId: string; vehicleName: string } | null>(null);

  const headers = useCallback(
    () =>
      session?.access_token
        ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
        : undefined,
    [session?.access_token]
  );

  const loadVehicles = useCallback(async () => {
    setShortlistItems(getShortlist());
    setAnonItems(getAnonGarage());
    const h = headers();
    if (!h) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/garage", { headers: h });
      const data = await res.json();
      if (data.success) setVehicles(data.vehicles);
    } catch {/* silent */} finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadVehicles();
    trackEvent("my_garage_viewed", {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // Load reviews
  useEffect(() => {
    const h = headers();
    if (!h || vehicles.length === 0) return;
    async function fetchReviews() {
      const results = await Promise.all(
        vehicles.map((v) =>
          fetch(`/api/workspace/garage/${v.id}/review`, { headers: h! })
            .then((r) => r.json())
            .then((d) => ({ id: v.id, review: d.success ? d.review : null }))
            .catch(() => ({ id: v.id, review: null }))
        )
      );
      const map: Record<string, GarageReview | null> = {};
      results.forEach(({ id, review }) => { map[id] = review; });
      setReviews(map);
    }
    fetchReviews();
  }, [vehicles, headers]);

  // Derived counts
  const ownedCount = vehicles.filter((v) => v.is_owned_ev).length;
  const shortlistedCount = vehicles.filter((v) => !v.is_owned_ev).length + shortlistItems.length;
  const totalSavings = vehicles.reduce((sum, v) => {
    if (v.vs_market != null && v.vs_market < 0) return sum + Math.abs(v.vs_market);
    return sum;
  }, 0);

  const filteredVehicles = useMemo(() => {
    let list = [...vehicles];
    if (activeFilter === "owned") list = list.filter((v) => v.is_owned_ev);
    else if (activeFilter === "shortlisted") list = list.filter((v) => !v.is_owned_ev);

    list.sort((a, b) => {
      if (activeSort === "score") return (b.impact_score ?? 0) - (a.impact_score ?? 0);
      if (activeSort === "price") return (a.listed_price ?? 0) - (b.listed_price ?? 0);
      if (activeSort === "range") return (b.estimated_range ?? 0) - (a.estimated_range ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [vehicles, activeFilter, activeSort]);

  // ── Handlers ─────────────────────────────────────────────

  const handleAdd = async () => {
    setAddError("");
    setSubmitting(true);
    const h = headers();
    if (!h) { setSubmitting(false); return; }

    const body: Record<string, string> = {};
    if (addMode === "url") {
      if (!formData.url.trim()) { setAddError("Please enter a listing URL"); setSubmitting(false); return; }
      body.listing_url = formData.url.trim();
    } else if (addMode === "vin") {
      if (!formData.vin.trim()) { setAddError("VIN is required"); setSubmitting(false); return; }
      body.vin = formData.vin.trim();
    } else {
      if (!formData.make.trim() || !formData.model.trim()) { setAddError("Make and model are required"); setSubmitting(false); return; }
      body.make = formData.make.trim();
      body.model = formData.model.trim();
      if (formData.year) body.year = formData.year;
    }
    if (formData.nickname.trim()) body.nickname = formData.nickname.trim();
    body.vehicle_type = addVehicleType;

    try {
      const res = await fetch("/api/workspace/garage", { method: "POST", headers: h, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) {
        setAddError(data.error || "Failed to add vehicle");
      } else {
        trackEvent("my_garage_vehicle_added", { mode: addMode });
        setShowAdd(false);
        setFormData({ url: "", vin: "", make: "", model: "", year: "", nickname: "" });
        if (data.vehicle?.id) setJustAddedVehicleId(data.vehicle.id);
        loadVehicles();
      }
    } catch {
      setAddError("Network error");
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
    if (detailVehicle?.id === id) setDetailVehicle(null);
  };

  const handleMarkAsOwned = async (vehicleId: string) => {
    const h = headers();
    if (!h) return;
    setMarkingOwnedId(vehicleId);
    try {
      const res = await fetch("/api/workspace/garage/owned-ev", {
        method: "POST", headers: h,
        body: JSON.stringify({ garage_vehicle_id: vehicleId, ownership_source: "manual" }),
      });
      if (res.ok) {
        setJustAddedVehicleId(null);
        trackEvent("owned_ev_marked", { vehicle_id: vehicleId });
        loadVehicles();
      }
    } catch {/* silent */} finally {
      setMarkingOwnedId(null);
    }
  };

  const handleGenerateOwnedEvReport = async (vehicleId: string) => {
    const h = headers();
    if (!h) return;
    setOwnedEvReportLoading((prev) => ({ ...prev, [vehicleId]: true }));
    try {
      await fetch(`/api/workspace/garage/${vehicleId}/owned-ev/report`, {
        method: "POST", headers: h, body: JSON.stringify({ report_type: "routine_health" }),
      });
      loadVehicles();
    } catch {/* silent */} finally {
      setOwnedEvReportLoading((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  const handleCompareClick = (v: GarageVehicle) => {
    if (!compareBase) { setCompareBase(v); return; }
    if (compareBase.id === v.id) { setCompareBase(null); return; }
    const a = encodeURIComponent(vehicleLabel(compareBase));
    const b = encodeURIComponent(vehicleLabel(v));
    router.push(`/compare?a=${a}&b=${b}`);
  };

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">

      {/* Recall panel overlay */}
      {recallPanel && session?.access_token && (
        <RecallPanel
          vehicleLabel={recallPanel.vehicle.nickname || vehicleLabel(recallPanel.vehicle)}
          recalls={recallPanel.recalls}
          authToken={session.access_token}
          onClose={() => setRecallPanel(null)}
          onDismissed={(recallId) =>
            setRecallPanel((prev) =>
              prev ? { ...prev, recalls: prev.recalls.filter((r) => r.id !== recallId) } : null
            )
          }
        />
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Garage</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {ownedCount} owned · {shortlistedCount} shortlisted · {vehicles.length + shortlistItems.length} total
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00c970] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Vehicles", value: vehicles.length + shortlistItems.length, icon: Car,      color: "text-blue-400" },
          { label: "Owned",          value: ownedCount,                               icon: Key,      color: "text-purple-400" },
          { label: "Shortlisted",    value: shortlistedCount,                         icon: Bookmark, color: "text-amber-400" },
          { label: "Savings Found",  value: totalSavings > 0 ? `$${totalSavings.toLocaleString()}` : "—", icon: DollarSign, color: "text-[#00d97e]" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white leading-tight truncate">{value}</p>
              <p className="text-xs text-white/40 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter tabs + sort ───────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex gap-1">
          {(["all", "shortlisted", "owned"] as GarageFilter[]).map((f) => {
            const counts: Record<GarageFilter, number> = {
              all: vehicles.length + shortlistItems.length,
              shortlisted: shortlistedCount,
              owned: ownedCount,
            };
            const labels: Record<GarageFilter, string> = { all: "All", shortlisted: "Shortlisted", owned: "Owned" };
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === f
                    ? "bg-white text-[#0d1117]"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {labels[f]} ({counts[f]})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 text-xs text-white/40">
          <span className="mr-1">Sort:</span>
          {(["score", "price", "range", "added"] as GarageSort[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSort(s)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                activeSort === s
                  ? "bg-white/[0.10] text-white"
                  : "hover:text-white/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Compare banner ───────────────────────────────────── */}
      {compareBase && (
        <div className="flex items-center justify-between px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm mb-4">
          <div className="flex items-center gap-2 text-blue-400">
            <GitCompare className="w-4 h-4" />
            <span>Comparing <strong className="text-white">{vehicleLabel(compareBase)}</strong> — pick another</span>
          </div>
          <button onClick={() => setCompareBase(null)} className="text-white/40 hover:text-white/70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
        </div>
      ) : !isAuthenticated && anonItems.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
            <LogIn className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-300">Sign in to sync your saved items</p>
              <p className="text-xs text-amber-400/70 mt-0.5">These are stored locally. Sign in to keep them across devices.</p>
            </div>
          </div>
          {anonItems.map((item) => (
            <div key={item.id} className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-4 flex items-center gap-4 group">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white/80">{item.label}</p>
                <p className="text-xs text-white/30 mt-0.5 capitalize">{item.type.replace("_", " ")}</p>
              </div>
              <button
                onClick={() => { removeFromAnonGarage(item.id); setAnonItems(getAnonGarage()); }}
                className="p-1.5 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : !isAuthenticated ? (
        <EmptyState message="Sign in to save vehicles to your garage" />
      ) : filteredVehicles.length === 0 && (activeFilter !== "all" || shortlistItems.length === 0) ? (
        <EmptyState
          message={activeFilter !== "all" ? `No ${activeFilter} vehicles yet` : "No vehicles in your garage"}
          sub="Click + Add Vehicle to get started"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* EVFit shortlist items */}
          {(activeFilter === "all" || activeFilter === "shortlisted") && shortlistItems.map((s) => (
            <ShortlistCard
              key={s.run_id} item={s} router={router}
              onRemove={() => { removeFromShortlist(s.run_id); setShortlistItems(getShortlist()); }}
            />
          ))}

          {filteredVehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              isCompareBase={compareBase?.id === v.id}
              isCompareTarget={!!(compareBase && compareBase.id !== v.id)}
              compareBase={compareBase}
              review={reviews[v.id] ?? null}
              authToken={session?.access_token}
              ownedEvReportLoading={ownedEvReportLoading[v.id] ?? false}
              onOpen={() => { setDetailVehicle(v); setDetailTab("report"); }}
              onDelete={() => handleDelete(v.id)}
              onCompare={() => handleCompareClick(v)}
              onRate={() => setReviewModal({ vehicleId: v.id, vehicleName: v.nickname || vehicleLabel(v) })}
              onRecalls={(recalls) => setRecallPanel({ vehicle: v, recalls })}
              onGenerateReport={() => handleGenerateOwnedEvReport(v.id)}
            />
          ))}
        </div>
      )}

      {/* Mark as Owned prompt */}
      {justAddedVehicleId && isAuthenticated && (
        <div className="flex items-start gap-3 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-xl px-4 py-3 mt-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Is this your vehicle?</p>
            <p className="text-xs text-white/50 mt-0.5">Mark it as Owned to unlock your free Routine Health Report.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleMarkAsOwned(justAddedVehicleId)}
              disabled={markingOwnedId === justAddedVehicleId}
              className="flex items-center gap-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970] disabled:opacity-50 transition-colors"
            >
              {markingOwnedId === justAddedVehicleId && <Loader2 className="w-3 h-3 animate-spin" />}
              Yes, mark as Owned
            </button>
            <button
              onClick={() => setJustAddedVehicleId(null)}
              className="py-1.5 px-3 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              Not mine
            </button>
          </div>
        </div>
      )}

      {/* ── Add Vehicle Modal ────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/[0.10] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-[#00d97e]" />
                <span className="font-semibold text-white">Add to Garage</span>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Mode tabs */}
              <div className="flex gap-1 bg-white/[0.05] rounded-xl p-1">
                {([
                  { key: "url" as const,    label: "Listing URL", icon: Link2 },
                  { key: "vin" as const,    label: "By VIN",      icon: Search },
                  { key: "manual" as const, label: "Manual",      icon: Car },
                ]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setAddMode(key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      addMode === key ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {addMode === "url" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">CarGurus Listing URL</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="url"
                      placeholder="https://www.cargurus.com/Cars/..."
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00d97e]/50 focus:ring-1 focus:ring-[#00d97e]/30"
                    />
                  </div>
                </div>
              )}

              {addMode === "vin" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">VIN</label>
                  <input
                    type="text"
                    placeholder="17-character VIN"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                    maxLength={17}
                    className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-white/25 font-mono tracking-wider focus:outline-none focus:border-[#00d97e]/50 focus:ring-1 focus:ring-[#00d97e]/30"
                  />
                </div>
              )}

              {addMode === "manual" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Vehicle Details</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { field: "make" as const,  placeholder: "Make" },
                      { field: "model" as const, placeholder: "Model" },
                      { field: "year" as const,  placeholder: "Year", type: "number" },
                    ]).map(({ field, placeholder, type }) => (
                      <input
                        key={field}
                        type={type ?? "text"}
                        placeholder={placeholder}
                        value={formData[field]}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                        className="px-3 py-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00d97e]/50 focus:ring-1 focus:ring-[#00d97e]/30"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Vehicle Type</label>
                <div className="flex gap-2">
                  {(["shortlisted", "owned"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAddVehicleType(t)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        addVehicleType === t
                          ? "bg-[#00d97e]/15 border-[#00d97e]/40 text-[#00d97e]"
                          : "border-white/[0.10] text-white/40 hover:text-white/70 hover:border-white/20"
                      }`}
                    >
                      {t === "shortlisted" ? <Bookmark className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                      {t === "shortlisted" ? "Shortlisted" : "Owned"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2 text-xs text-white/35 bg-white/[0.03] rounded-xl px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#00d97e]/60" />
                <span>OFFOLab will analyze the listing and add it to your garage with a full deal score, battery health check, and market comparison.</span>
              </div>

              {addError && <p className="text-sm text-red-400">{addError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.10] text-sm text-white/60 hover:text-white/80 hover:border-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  + Add Vehicle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Vehicle Detail Panel ─────────────────────────────── */}
      {detailVehicle && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDetailVehicle(null)}
          />
          <div className="relative w-full max-w-sm bg-[#0d1117] border-l border-white/[0.08] h-full overflow-y-auto flex flex-col shadow-2xl">
            {/* Panel header */}
            <div className="flex items-start gap-3 p-4 border-b border-white/[0.08]">
              <div className="w-12 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <VehicleImage
                  make={detailVehicle.make} model={detailVehicle.model} year={detailVehicle.year ?? undefined}
                  className="w-full h-full" imgClassName="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  {detailVehicle.verdict && (() => {
                    const c = verdictColor(detailVehicle.verdict);
                    return (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
                        {detailVehicle.verdict}
                      </span>
                    );
                  })()}
                  {detailVehicle.is_owned_ev
                    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">Owned</span>
                    : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/30">Shortlisted</span>
                  }
                </div>
                <p className="text-sm font-bold text-white truncate">{vehicleLabel(detailVehicle)}</p>
                {(detailVehicle.trim || detailVehicle.location) && (
                  <p className="text-xs text-white/40 truncate">
                    {[detailVehicle.trim, detailVehicle.location].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <button onClick={() => setDetailVehicle(null)} className="text-white/40 hover:text-white/80 flex-shrink-0 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.08]">
              {([
                { key: "report" as const,    label: "OFFO Report",     icon: BarChart2  },
                { key: "questions" as const, label: "Dealer Questions", icon: HelpCircle },
                { key: "vin" as const,       label: "VIN History",      icon: Clock      },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setDetailTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium border-b-2 transition-colors ${
                    detailTab === key
                      ? "border-[#00d97e] text-[#00d97e]"
                      : "border-transparent text-white/40 hover:text-white/70"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1">{label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 p-4 space-y-3">
              {detailTab === "report" && (
                <>
                  {/* Deal score */}
                  {detailVehicle.impact_score != null && (
                    <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">OFFO Deal Score</p>
                      <div className="flex items-center gap-4">
                        <ScoreDial score={detailVehicle.impact_score} size={64} />
                        <div>
                          {detailVehicle.verdict && <p className="text-base font-bold text-white">{detailVehicle.verdict}</p>}
                          <p className="text-xs text-white/40 mt-0.5 leading-snug">
                            {detailVehicle.vs_market != null && detailVehicle.vs_market < 0
                              ? `Price is $${Math.abs(detailVehicle.vs_market).toLocaleString()} below market.`
                              : "OFFO analysis complete."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Price analysis */}
                  {detailVehicle.listed_price != null && (
                    <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Price Analysis</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-base font-bold text-white">${detailVehicle.listed_price.toLocaleString()}</p>
                          <p className="text-[10px] text-white/30">Listed Price</p>
                        </div>
                        {detailVehicle.market_avg != null && (
                          <div>
                            <p className="text-base font-bold text-white/50">${detailVehicle.market_avg.toLocaleString()}</p>
                            <p className="text-[10px] text-white/30">Market Avg</p>
                          </div>
                        )}
                        {detailVehicle.vs_market != null && (
                          <div>
                            <p className={`text-base font-bold ${detailVehicle.vs_market < 0 ? "text-[#00d97e]" : "text-red-400"}`}>
                              {detailVehicle.vs_market < 0 ? "-" : "+"}${Math.abs(detailVehicle.vs_market).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-white/30">vs Market</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Battery health */}
                  {detailVehicle.battery_health_pct != null && (
                    <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Battery Health</p>
                        <span className="text-xs font-semibold text-[#00d97e] bg-[#00d97e]/15 px-2 py-0.5 rounded-full">
                          {detailVehicle.battery_health_pct >= 90 ? "Excellent" : detailVehicle.battery_health_pct >= 75 ? "Good" : "Fair"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <ScoreDial score={detailVehicle.battery_health_pct} size={48} />
                        <div>
                          <p className="text-sm font-bold text-white">{detailVehicle.battery_health_pct}% Capacity</p>
                          {detailVehicle.estimated_range != null && (
                            <p className="text-xs text-white/40">{detailVehicle.estimated_range} mi est. range</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Specs */}
                  <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Full Specifications</p>
                    <div className="space-y-2.5">
                      {([
                        { label: "Make",    value: detailVehicle.make },
                        { label: "Model",   value: detailVehicle.model },
                        { label: "Year",    value: detailVehicle.year?.toString() },
                        { label: "Trim",    value: detailVehicle.trim },
                        { label: "VIN",     value: detailVehicle.vin },
                        { label: "Mileage", value: detailVehicle.mileage ? `${detailVehicle.mileage.toLocaleString()} mi` : null },
                        { label: "Location", value: detailVehicle.location },
                      ] as { label: string; value: string | null | undefined }[])
                        .filter((row) => row.value)
                        .map(({ label, value }) => (
                          <div key={label} className="flex justify-between text-xs">
                            <span className="text-white/40">{label}</span>
                            <span className="text-white/80 font-medium text-right max-w-[60%] truncate">{value}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* View full report */}
                  <Link
                    href={detailVehicle.is_owned_ev
                      ? `/workspace/garage/${detailVehicle.id}/owned-ev`
                      : `/receipt?vehicle=${encodeURIComponent(vehicleLabel(detailVehicle))}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white/60 hover:text-white hover:border-white/15 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Full Report
                  </Link>
                </>
              )}

              {detailTab === "questions" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <HelpCircle className="w-10 h-10 text-white/10 mb-3" />
                  <p className="text-sm text-white/30">Dealer question templates coming soon.</p>
                  <p className="text-xs text-white/20 mt-1">Questions suggested based on this vehicle&apos;s risk profile.</p>
                </div>
              )}

              {detailTab === "vin" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="w-10 h-10 text-white/10 mb-3" />
                  <p className="text-sm text-white/30">VIN history coming soon.</p>
                  {detailVehicle.vin && (
                    <p className="text-xs font-mono text-white/20 mt-2">{detailVehicle.vin}</p>
                  )}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="p-4 border-t border-white/[0.08] flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.10] text-sm text-white/60 hover:text-white/80 hover:border-white/20 transition-colors">
                <FileText className="w-4 h-4" />
                Share Report
              </button>
              <Link
                href={`/receipt?vehicle=${encodeURIComponent(vehicleLabel(detailVehicle))}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Listing
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewModal && session?.access_token && (
        <ReviewModal
          vehicleId={reviewModal.vehicleId}
          vehicleName={reviewModal.vehicleName}
          authToken={session.access_token}
          existingReview={reviews[reviewModal.vehicleId] ?? null}
          onClose={() => setReviewModal(null)}
          onSaved={(review) => {
            setReviews((prev) => ({ ...prev, [reviewModal.vehicleId]: review }));
            setReviewModal(null);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────

function ScoreDial({ score, size }: { score: number; size: number }) {
  const r = size * 0.39;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#ffffff10" strokeWidth={size * 0.09} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#00d97e" strokeWidth={size * 0.09}
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-bold text-white"
        style={{ fontSize: size * 0.22 }}>
        {score}
      </span>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
        <Car className="w-6 h-6 text-white/20" />
      </div>
      <p className="text-sm font-medium text-white/40">{message}</p>
      {sub && <p className="text-xs text-white/25 mt-1">{sub}</p>}
    </div>
  );
}

function ShortlistCard({
  item, router, onRemove,
}: {
  item: ShortlistCandidate;
  router: ReturnType<typeof useRouter>;
  onRemove: () => void;
}) {
  const parts = item.vehicle_label.split(" ");
  const make = parts[1] ?? "";
  const model = parts.slice(2).join(" ");

  return (
    <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col group">
      <div className="h-36 w-full overflow-hidden">
        <VehicleImage make={make} model={model} className="w-full h-full" imgClassName="w-full h-full object-cover" />
      </div>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-[#00d97e] bg-[#00d97e]/15 border border-[#00d97e]/30 px-2 py-0.5 rounded-full w-fit">Shortlisted</span>
        <p className="text-sm font-semibold text-white truncate">{item.vehicle_label}</p>
        <p className="text-xs text-white/40">{item.fit_score.label} · {item.fit_score.score_0_100}/100</p>
        <div className="flex gap-2 mt-auto">
          <button
            onClick={() => router.push(`/receipt?vehicle=${encodeURIComponent(item.vehicle_label)}`)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/60 hover:bg-white/[0.10] hover:text-white transition-colors"
          >
            <Zap className="w-3.5 h-3.5" /> New Check
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleCard({
  vehicle: v, isCompareBase, isCompareTarget, compareBase, review,
  authToken, ownedEvReportLoading, onOpen, onDelete, onCompare, onRate, onRecalls, onGenerateReport,
}: {
  vehicle: GarageVehicle;
  isCompareBase: boolean;
  isCompareTarget: boolean;
  compareBase: GarageVehicle | null;
  review: GarageReview | null;
  authToken?: string;
  ownedEvReportLoading: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onCompare: () => void;
  onRate: () => void;
  onRecalls: (recalls: Recall[]) => void;
  onGenerateReport: () => void;
}) {
  const label = vehicleLabel(v);
  const vc = verdictColor(v.verdict);

  return (
    <div
      className={`bg-[#161b22] rounded-2xl overflow-hidden flex flex-col group cursor-pointer transition-all border ${
        isCompareBase
          ? "border-blue-500/50 ring-1 ring-blue-500/30"
          : "border-white/[0.08] hover:border-white/[0.18]"
      }`}
      onClick={onOpen}
    >
      {/* Image */}
      <div className="relative h-36 w-full overflow-hidden">
        <VehicleImage
          make={v.make} model={v.model} year={v.year ?? undefined} vin={v.vin ?? undefined}
          className="w-full h-full" imgClassName="w-full h-full object-cover"
        />
        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          {v.verdict && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm ${vc.bg} ${vc.text} ${vc.border}`}>
              {v.verdict}
            </span>
          )}
          {v.is_owned_ev
            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 backdrop-blur-sm">Owned</span>
            : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/30 backdrop-blur-sm">Shortlisted</span>
          }
        </div>
        {/* Actions top-right (hover) */}
        <div
          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {authToken && (
            <RecallBadge vehicleId={v.id} authToken={authToken} onViewRecalls={onRecalls} />
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/50 hover:text-red-400 transition-colors"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-sm font-semibold text-white leading-tight truncate">{v.nickname || label}</p>
          {v.trim && <p className="text-xs text-white/35 truncate mt-0.5">{v.trim}</p>}
        </div>

        {/* Chips */}
        {(v.listed_price != null || v.estimated_range != null || v.battery_health_pct != null) && (
          <div className="flex gap-1.5 flex-wrap">
            {v.listed_price != null && (
              <span className="text-xs font-semibold text-white/80 bg-white/[0.07] px-2 py-1 rounded-lg">
                ${v.listed_price.toLocaleString()}
              </span>
            )}
            {v.estimated_range != null && (
              <span className="text-xs font-semibold text-white/80 bg-white/[0.07] px-2 py-1 rounded-lg">
                {v.estimated_range} mi
              </span>
            )}
            {v.battery_health_pct != null && (
              <span className="text-xs font-semibold text-white/80 bg-white/[0.07] px-2 py-1 rounded-lg">
                {v.battery_health_pct}%
              </span>
            )}
          </div>
        )}

        {/* Score bar */}
        {v.impact_score != null && (
          <div className="space-y-1">
            <div className="w-full h-1.5 rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[#00d97e]" style={{ width: `${v.impact_score}%` }} />
            </div>
            <p className="text-[10px] text-white/30 text-right">Score {v.impact_score}</p>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-[10px] text-white/30 mt-auto">
          <span className="flex items-center gap-1 truncate">
            {v.mileage != null && (
              <><MapPin className="w-3 h-3 flex-shrink-0" />{v.mileage.toLocaleString()} mi{v.location ? ` · ${v.location}` : ""}</>
            )}
          </span>
          {v.vs_market != null && (
            <span className={`font-semibold flex-shrink-0 ml-2 ${v.vs_market < 0 ? "text-[#00d97e]" : "text-red-400"}`}>
              {v.vs_market < 0 ? "-" : "+"}${Math.abs(v.vs_market).toLocaleString()} vs market
            </span>
          )}
        </div>

        {/* Action row */}
        <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onCompare}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              isCompareBase
                ? "bg-blue-600 text-white"
                : "bg-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.10]"
            }`}
          >
            <GitCompare className="w-3 h-3" />
            {isCompareBase ? "Selected" : isCompareTarget ? "Compare →" : "Compare"}
          </button>
          <button
            onClick={onRate}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.10] transition-colors"
          >
            <Star className="w-3 h-3" />
            {review ? `${review.rating}★` : "Rate"}
          </button>
          {v.is_owned_ev && (
            <Link
              href={`/workspace/garage/${v.id}/owned-ev`}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.06] text-white/50 hover:text-[#00d97e] hover:bg-[#00d97e]/10 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ShieldCheck className="w-3 h-3" />
              Report
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
