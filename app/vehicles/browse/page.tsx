/**
 * /vehicles/browse — Browse dealer EV inventory
 *
 * Global marketplace search across all active dealer listings.
 * Filters by make, model, year range, price max, state, and category.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Loader2, Car, MapPin, Shield, X, Zap, ArrowLeft } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useEventTracking } from "@/hooks/useEventTracking";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const PRICE_OPTIONS = [
  { label: "Any price", value: "" },
  { label: "Under $20k", value: "20000" },
  { label: "Under $30k", value: "30000" },
  { label: "Under $40k", value: "40000" },
  { label: "Under $50k", value: "50000" },
  { label: "Under $75k", value: "75000" },
];

interface VehicleListing {
  id: string;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  price_cents: number | null;
  mileage: number | null;
  exterior_color: string | null;
  photo_urls: string[] | null;
  classification: { category?: string } | null;
  listing_url: string | null;
  dealerships: {
    name: string;
    slug: string;
    city: string | null;
    state: string | null;
    is_verified: boolean;
  };
}

const inputCls = "w-full px-3 py-2 text-sm bg-[#0d1117] border border-white/[0.10] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d97e]/40 focus:border-[#00d97e]/40 transition-colors";
const labelCls = "text-xs font-medium text-white/40 block mb-1";

function VehicleCard({ v }: { v: VehicleListing }) {
  const router = useRouter();
  const photo = v.photo_urls?.[0] ?? null;
  const price = v.price_cents != null ? `$${Math.round(v.price_cents / 100).toLocaleString()}` : "Price TBD";
  const category = v.classification?.category;
  const dealerLocation = [v.dealerships.city, v.dealerships.state].filter(Boolean).join(", ");

  const handleAnalyze = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (v.listing_url) {
      router.push(`/receipt?url=${encodeURIComponent(v.listing_url)}&src=browse`);
    } else {
      router.push("/receipt");
    }
  };

  return (
    <div className="bg-[#161b22] border border-white/[0.08] rounded-xl overflow-hidden hover:border-white/[0.18] hover:bg-white/[0.03] transition-all group">
      <Link href={`/dealers/${v.dealerships.slug}`} className="block">
        {/* Photo */}
        <div className="aspect-[16/9] bg-white/[0.04] flex items-center justify-center overflow-hidden">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={`${v.year ?? ""} ${v.make} ${v.model}`}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          ) : (
            <Car className="w-12 h-12 text-white/10" />
          )}
        </div>

        {/* Details */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-white/90 text-sm leading-snug">
              {v.year} {v.make} {v.model}
              {v.trim && <span className="text-white/40 font-normal"> · {v.trim}</span>}
            </p>
            {category && (
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-medium ${
                category === "EV" ? "bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/20" :
                category === "PHEV" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                "bg-white/[0.06] text-white/40 border border-white/[0.08]"
              }`}>
                {category}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm mb-2">
            <span className="font-bold text-white">{price}</span>
            {v.mileage != null && (
              <span className="text-white/40">{v.mileage.toLocaleString()} mi</span>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs text-white/40 min-w-0">
            {v.dealerships.is_verified && <Shield className="w-3 h-3 text-[#00d97e] shrink-0" />}
            <span className="truncate">{v.dealerships.name}</span>
            {dealerLocation && (
              <>
                <span>·</span>
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{dealerLocation}</span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* Analyze CTA */}
      <div className="px-4 pb-4">
        <button
          onClick={handleAnalyze}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-xs font-semibold rounded-lg transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Analyze this listing
        </button>
      </div>
    </div>
  );
}

export default function VehicleBrowsePage() {
  const { trackEvent } = useEventTracking();
  useEffect(() => { trackEvent("vehicles_browse_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [vehicles, setVehicles] = useState<VehicleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [category, setCategory] = useState("");

  const buildParams = useCallback((pg: number) => {
    const p = new URLSearchParams();
    if (make) p.set("make", make);
    if (model) p.set("model", model);
    if (yearMin) p.set("year_min", yearMin);
    if (yearMax) p.set("year_max", yearMax);
    if (priceMax) p.set("price_max", priceMax);
    if (stateFilter) p.set("state", stateFilter);
    if (category) p.set("category", category);
    p.set("page", String(pg));
    p.set("limit", "20");
    return p.toString();
  }, [make, model, yearMin, yearMax, priceMax, stateFilter, category]);

  // Initial + filter-change fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setPage(1);
      setVehicles([]);
      fetch(`/api/vehicles/browse?${buildParams(1)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setVehicles(data.vehicles);
            setTotal(data.total);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [buildParams]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/vehicles/browse?${buildParams(nextPage)}`);
      const data = await res.json();
      if (data.success && data.vehicles?.length > 0) {
        setVehicles((prev) => [...prev, ...data.vehicles]);
        setPage(nextPage);
      }
    } catch {} finally {
      setLoadingMore(false);
    }
  };

  const activeFilterCount = [make, model, yearMin, yearMax, priceMax, stateFilter, category].filter(Boolean).length;

  const clearFilters = () => {
    setMake(""); setModel(""); setYearMin(""); setYearMax("");
    setPriceMax(""); setStateFilter(""); setCategory("");
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <Link href="/dealers" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Dealers
          </Link>
          <h1 className="text-2xl font-bold text-white">Browse EV Inventory</h1>
          <p className="text-sm text-white/40 mt-1">
            {loading ? "Loading..." : `${total.toLocaleString()} vehicles from OFFO-listed dealers`}
          </p>
        </div>

        {/* Filter bar */}
        <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Make */}
            <div className="flex-1 min-w-[120px]">
              <label className={labelCls}>Make</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Tesla, Ford..."
                  className={`${inputCls} pl-8`}
                />
              </div>
            </div>

            {/* Model */}
            <div className="flex-1 min-w-[120px]">
              <label className={labelCls}>Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model 3, Mach-E..."
                className={inputCls}
              />
            </div>

            {/* Price */}
            <div className="min-w-[130px]">
              <label className={labelCls}>Max Price</label>
              <select
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className={inputCls}
              >
                {PRICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* State */}
            <div className="min-w-[100px]">
              <label className={labelCls}>State</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className={inputCls}
              >
                <option value="">Any state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* More filters toggle */}
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? "bg-[#00d97e]/10 border-[#00d97e]/20 text-[#00d97e]"
                    : "border-white/[0.10] text-white/50 hover:bg-white/[0.05]"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-[#00d97e] text-[#0d1117] text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-white/40 hover:text-white/70 border border-white/[0.10] rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/[0.06] items-end">
              {/* Type */}
              <div>
                <label className={labelCls}>Type</label>
                <div className="flex gap-1.5">
                  {["", "EV", "PHEV", "ICE"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        category === c
                          ? "bg-[#00d97e] border-[#00d97e] text-[#0d1117]"
                          : "border-white/[0.10] text-white/50 hover:bg-white/[0.05]"
                      }`}
                    >
                      {c || "All"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year range */}
              <div>
                <label className={labelCls}>Year</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value)}
                    placeholder="2018"
                    min="2000" max="2026"
                    className="w-20 px-2 py-1.5 text-sm bg-[#0d1117] border border-white/[0.10] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d97e]/40"
                  />
                  <span className="text-white/30 text-sm">–</span>
                  <input
                    type="number"
                    value={yearMax}
                    onChange={(e) => setYearMax(e.target.value)}
                    placeholder="2026"
                    min="2000" max="2026"
                    className="w-20 px-2 py-1.5 text-sm bg-[#0d1117] border border-white/[0.10] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d97e]/40"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-12 text-center">
            <Car className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="font-medium text-white/50">No vehicles match your filters</p>
            <p className="text-sm text-white/30 mt-1">Try broadening your search or clearing filters</p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-sm text-[#00d97e] border border-[#00d97e]/20 rounded-lg hover:bg-[#00d97e]/10 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {vehicles.map((v) => <VehicleCard key={v.id} v={v} />)}
            </div>

            {vehicles.length < total && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 text-sm font-medium text-white/60 bg-[#161b22] border border-white/[0.08] rounded-xl hover:bg-white/[0.05] disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loadingMore ? "Loading..." : `Load more (${(total - vehicles.length).toLocaleString()} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
