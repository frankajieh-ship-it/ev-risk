/**
 * /vehicles/browse — Browse dealer EV inventory
 *
 * Global marketplace search across all active dealer listings.
 * Filters by make, model, year range, price max, state, and category.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Loader2, Car, MapPin, Shield, ChevronRight, X } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

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

function VehicleCard({ v }: { v: VehicleListing }) {
  const photo = v.photo_urls?.[0] ?? null;
  const price = v.price_cents != null ? `$${Math.round(v.price_cents / 100).toLocaleString()}` : "Price TBD";
  const category = v.classification?.category;
  const dealerLocation = [v.dealerships.city, v.dealerships.state].filter(Boolean).join(", ");

  return (
    <Link
      href={`/dealers/${v.dealerships.slug}`}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all group"
    >
      {/* Photo */}
      <div className="aspect-[16/9] bg-gray-100 flex items-center justify-center overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={`${v.year ?? ""} ${v.make} ${v.model}`}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <Car className="w-12 h-12 text-gray-300" />
        )}
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-gray-900 text-sm leading-snug">
            {v.year} {v.make} {v.model}
            {v.trim && <span className="text-gray-500 font-normal"> · {v.trim}</span>}
          </p>
          {category && (
            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-medium ${
              category === "EV" ? "bg-green-50 text-green-700" :
              category === "PHEV" ? "bg-yellow-50 text-yellow-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm mb-3">
          <span className="font-bold text-gray-900">{price}</span>
          {v.mileage != null && (
            <span className="text-gray-400">{v.mileage.toLocaleString()} mi</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
            {v.dealerships.is_verified && <Shield className="w-3 h-3 text-green-600 shrink-0" />}
            <span className="truncate">{v.dealerships.name}</span>
            {dealerLocation && (
              <>
                <span>·</span>
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{dealerLocation}</span>
              </>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

export default function VehicleBrowsePage() {
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/dealers" className="hover:text-gray-700">Dealers</Link>
            <span>·</span>
            <span className="text-gray-800 font-medium">Browse Vehicles</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Browse EV Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? "Loading..." : `${total.toLocaleString()} vehicles from OFFO-listed dealers`}
          </p>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Make */}
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-medium text-gray-500 block mb-1">Make</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Tesla, Ford..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>

            {/* Model */}
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-medium text-gray-500 block mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model 3, Mach-E..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {/* Price */}
            <div className="min-w-[130px]">
              <label className="text-xs font-medium text-gray-500 block mb-1">Max Price</label>
              <select
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              >
                {PRICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* State */}
            <div className="min-w-[100px]">
              <label className="text-xs font-medium text-gray-500 block mb-1">State</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
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
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-green-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 items-end">
              {/* Type */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
                <div className="flex gap-1.5">
                  {["", "EV", "PHEV", "ICE"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        category === c
                          ? "bg-green-600 border-green-600 text-white"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {c || "All"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year range */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Year</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value)}
                    placeholder="2018"
                    min="2000" max="2026"
                    className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <span className="text-gray-400 text-sm">–</span>
                  <input
                    type="number"
                    value={yearMax}
                    onChange={(e) => setYearMax(e.target.value)}
                    placeholder="2026"
                    min="2000" max="2026"
                    className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Car className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">No vehicles match your filters</p>
            <p className="text-sm text-gray-400 mt-1">Try broadening your search or clearing filters</p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-sm text-green-700 border border-green-200 rounded-lg hover:bg-green-50"
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
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2"
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
