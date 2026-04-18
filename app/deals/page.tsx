"use client";

import { useState, useEffect, useCallback } from "react";
import { SlidersHorizontal, RefreshCw, Zap } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import DealCard, { type CuratedDeal } from "@/components/deals/DealCard";
import { useAuth } from "@/hooks/useAuth";

const DEBUG_USER_IDS = new Set([
  "e2c20b6d-ff51-46d0-b696-a5a29a8c282f",
  "a9e65037-00b3-443b-afba-5631e42b0505",
  "cb99b83d-552f-4f94-9497-ac4a81160bca",
  "0f183ae8-38a6-491d-b400-a37de25c8606",
]);

type VerdictFilter = "ALL" | "GREEN" | "YELLOW";
type SortOption = "quality" | "price_asc" | "price_desc" | "mileage" | "newest";

const MAKES = ["All Makes", "Tesla", "Chevrolet", "Hyundai", "Volkswagen", "Ford", "Kia", "Nissan", "BMW", "Rivian"];
const US_STATES = ["Any State","AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const PRICE_OPTIONS = [
  { label: "Any Price", value: null },
  { label: "Under $20k", value: 20000 },
  { label: "Under $25k", value: 25000 },
  { label: "Under $35k", value: 35000 },
  { label: "Under $45k", value: 45000 },
  { label: "Under $60k", value: 60000 },
];
const MILEAGE_OPTIONS = [
  { label: "Any Mileage", value: null },
  { label: "Under 20k mi", value: 20000 },
  { label: "Under 40k mi", value: 40000 },
  { label: "Under 60k mi", value: 60000 },
  { label: "Under 80k mi", value: 80000 },
];
const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Best Match", value: "quality" },
  { label: "Price: Low → High", value: "price_asc" },
  { label: "Price: High → Low", value: "price_desc" },
  { label: "Lowest Mileage", value: "mileage" },
  { label: "Newest Year", value: "newest" },
];

export default function DealsPage() {
  const { user } = useAuth();
  const isDebugUser = user?.id ? DEBUG_USER_IDS.has(user.id) : false;

  const [deals, setDeals] = useState<CuratedDeal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [verdict, setVerdict] = useState<VerdictFilter>("ALL");
  const [make, setMake] = useState("All Makes");
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [mileageMax, setMileageMax] = useState<number | null>(null);
  const [locationState, setLocationState] = useState("Any State");
  const [sort, setSort] = useState<SortOption>("quality");

  const fetchDeals = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: "18", sort });
      if (verdict !== "ALL") params.set("verdict", verdict);
      if (make !== "All Makes") params.set("make", make);
      if (priceMax) params.set("price_max", String(priceMax));
      if (mileageMax) params.set("mileage_max", String(mileageMax));
      if (locationState !== "Any State") params.set("location", locationState);

      const res = await fetch(`/api/deals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDeals(data.deals ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.total_pages ?? 1);
      setPage(p);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [verdict, make, priceMax, mileageMax, locationState, sort]);

  useEffect(() => {
    fetchDeals(1);
  }, [fetchDeals]);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="homepage" />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Page header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-[#00d97e]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#00d97e]">Deal Watch</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Today&apos;s Best EV Deals
          </h1>
          <p className="text-white/50 text-base max-w-xl">
            Every listing is pre-analyzed by OFFO — verdict, risk flags, and evidence score included. No browsing blind.
          </p>
          {total > 0 && (
            <p className="text-white/30 text-sm mt-2">{total.toLocaleString()} deals analyzed</p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-2 text-white/40">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-xs font-medium">Filters</span>
          </div>

          {/* Verdict toggle */}
          <div className="flex items-center gap-1 bg-[#161b22] border border-white/[0.08] rounded-lg p-1">
            {(["ALL", "GREEN", "YELLOW"] as VerdictFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setVerdict(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  verdict === v
                    ? v === "GREEN"
                      ? "bg-[#00d97e]/15 text-[#00d97e]"
                      : v === "YELLOW"
                      ? "bg-yellow-500/15 text-yellow-400"
                      : "bg-white/[0.10] text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {v === "ALL" ? "All" : v === "GREEN" ? "Good Deals" : "Caution"}
              </button>
            ))}
          </div>

          {/* Make select */}
          <select
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d97e]/40"
          >
            {MAKES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Price select */}
          <select
            value={priceMax ?? ""}
            onChange={(e) => setPriceMax(e.target.value ? parseInt(e.target.value) : null)}
            className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d97e]/40"
          >
            {PRICE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value ?? ""}>{o.label}</option>
            ))}
          </select>

          {/* Mileage select */}
          <select
            value={mileageMax ?? ""}
            onChange={(e) => setMileageMax(e.target.value ? parseInt(e.target.value) : null)}
            className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d97e]/40"
          >
            {MILEAGE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value ?? ""}>{o.label}</option>
            ))}
          </select>

          {/* State select */}
          <select
            value={locationState}
            onChange={(e) => setLocationState(e.target.value)}
            className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d97e]/40"
          >
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Sort select */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d97e]/40"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            onClick={() => fetchDeals(1)}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#161b22] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-white/[0.04]" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-white/[0.04] rounded w-3/4" />
                  <div className="h-5 bg-white/[0.04] rounded w-1/2" />
                  <div className="h-3 bg-white/[0.04] rounded w-full" />
                  <div className="h-9 bg-white/[0.04] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-24">
            <Zap className="w-10 h-10 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-base font-medium mb-2">No deals found</p>
            <p className="text-white/25 text-sm">Try adjusting your filters or check back soon — deals refresh 3× daily.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {deals.map((deal, index) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  showDebug={isDebugUser}
                  rank={index + 1 + (page - 1) * 18}
                  totalDeals={total}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  onClick={() => fetchDeals(page - 1)}
                  disabled={page <= 1 || loading}
                  className="px-4 py-2 text-sm text-white/50 hover:text-white/80 border border-white/[0.08] rounded-lg disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-white/30">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => fetchDeals(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="px-4 py-2 text-sm text-white/50 hover:text-white/80 border border-white/[0.08] rounded-lg disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Disclaimer */}
        <p className="text-center text-xs text-white/20 mt-12 max-w-xl mx-auto">
          Deals are automatically analyzed by OFFO and are for informational purposes only. Always verify listings independently before purchase.
        </p>
      </main>

      <Footer />
    </div>
  );
}
