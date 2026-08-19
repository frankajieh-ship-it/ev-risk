"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, RefreshCw, Zap, ChevronDown } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import DealCard, { type CuratedDeal } from "@/components/deals/DealCard";
import { useEventTracking } from "@/hooks/useEventTracking";
type SortOption = "price_asc" | "price_desc" | "mileage" | "newest";

const MAKES = ["All Makes", "Tesla", "Chevrolet", "Hyundai", "Volkswagen", "Ford", "Kia", "Nissan", "BMW", "Rivian", "Mitsubishi", "Volvo", "Audi", "Mercedes-Benz", "FIAT"];
const YEAR_OPTIONS = [
  { label: "Any Year", min: null, max: null },
  { label: "2022 or newer", min: 2022, max: null },
  { label: "2020 or newer", min: 2020, max: null },
  { label: "2018 or newer", min: 2018, max: null },
  { label: "2015 or newer", min: 2015, max: null },
  { label: "2014 or older", min: null, max: 2014 },
];
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
  { label: "Price: Low → High", value: "price_asc" },
  { label: "Price: High → Low", value: "price_desc" },
  { label: "Lowest Mileage", value: "mileage" },
  { label: "Newest Year", value: "newest" },
];

function DealsPageInner() {
  const { trackEvent } = useEventTracking();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<CuratedDeal[]>([]);

  useEffect(() => { trackEvent("deals_page_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters — initialise from URL params so Reddit deep links pre-filter the grid
  const paramMake = searchParams.get("make");
  const paramState = searchParams.get("state") || searchParams.get("location");
  const [make, setMake] = useState(() => {
    if (!paramMake) return "All Makes";
    return MAKES.find((m) => m.toLowerCase() === paramMake.toLowerCase()) ?? "All Makes";
  });
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [mileageMax, setMileageMax] = useState<number | null>(null);
  const [yearMin, setYearMin] = useState<number | null>(null);
  const [yearMax, setYearMax] = useState<number | null>(null);
  const [locationState, setLocationState] = useState(() => {
    if (!paramState) return "Any State";
    return US_STATES.find((s) => s.toLowerCase() === paramState.toLowerCase()) ?? "Any State";
  });
  const [sort, setSort] = useState<SortOption>("price_asc");
  const [adjustExpanded, setAdjustExpanded] = useState(false);

  // Local (uncommitted) filter state for the Adjust panel
  const [localMake, setLocalMake] = useState(() => paramMake && MAKES.find((m) => m.toLowerCase() === paramMake.toLowerCase()) ? MAKES.find((m) => m.toLowerCase() === paramMake.toLowerCase())! : "All Makes");
  const [localPriceMax, setLocalPriceMax] = useState<number | null>(null);
  const [localMileageMax, setLocalMileageMax] = useState<number | null>(null);
  const [localYearMin, setLocalYearMin] = useState<number | null>(null);
  const [localYearMax, setLocalYearMax] = useState<number | null>(null);
  const [localLocationState, setLocalLocationState] = useState(() => paramState && US_STATES.find((s) => s.toLowerCase() === paramState.toLowerCase()) ? US_STATES.find((s) => s.toLowerCase() === paramState.toLowerCase())! : "Any State");
  const [localSort, setLocalSort] = useState<SortOption>("price_asc");

  const fetchDeals = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: "20", sort });
      if (make !== "All Makes") params.set("make", make);
      if (priceMax) params.set("price_max", String(priceMax));
      if (mileageMax) params.set("mileage_max", String(mileageMax));
      if (yearMin) params.set("year_min", String(yearMin));
      if (yearMax) params.set("year_max", String(yearMax));
      if (locationState !== "Any State") params.set("location", locationState);

      const res = await fetch(`/api/deals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDeals(data.deals ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.total_pages ?? 1);
      setPage(p);
      trackEvent("deals_results_loaded", { count: data.deals?.length ?? 0, total: data.total ?? 0 });
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [make, priceMax, mileageMax, yearMin, yearMax, locationState, sort]);

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
            {make !== "All Makes"
              ? `${make} EV Deals`
              : locationState !== "Any State"
                ? `EV Deals in ${locationState}`
                : "Today's Best EV Deals"}
          </h1>
          <p className="text-white/50 text-base max-w-xl">
            EV listings sorted by price. Run a free analysis on any deal to see battery health, risk flags, and whether it&apos;s worth it.
          </p>
          <div className="flex items-center gap-2 mt-3">
            {total > 0 && (
              <span className="text-white/30 text-sm">{total.toLocaleString()} EV listings</span>
            )}
            {total > 0 && <span className="text-white/15 text-sm">·</span>}
            <span className="text-white/25 text-xs">Updated every 24 hours — some listings may have sold</span>
            {(make !== "All Makes" || locationState !== "Any State" || yearMin || yearMax || priceMax || mileageMax) && (
              <>
                <span className="text-white/15 text-sm">·</span>
                <button
                  onClick={() => {
                    setMake("All Makes"); setLocalMake("All Makes");
                    setLocationState("Any State"); setLocalLocationState("Any State");
                    setPriceMax(null); setLocalPriceMax(null);
                    setMileageMax(null); setLocalMileageMax(null);
                    setYearMin(null); setLocalYearMin(null);
                    setYearMax(null); setLocalYearMax(null);
                  }}
                  className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] transition-colors underline underline-offset-2"
                >
                  Clear all filters
                </button>
              </>
            )}
          </div>
        </div>

        {/* Adjust bar */}
        <div className="mb-8">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
            {/* Collapsed summary row */}
            <div className="flex items-center gap-3 px-5 py-4">
              <SlidersHorizontal className="w-4 h-4 text-[#00d97e] shrink-0" />
              <div className="flex-1 text-sm text-white/50 truncate">
                {[
                  make !== "All Makes" && make,
                  priceMax && `Under $${Math.round(priceMax / 1000)}k`,
                  mileageMax && `Under ${Math.round(mileageMax / 1000)}k mi`,
                  yearMin && `${yearMin}+`,
                  yearMax && `≤ ${yearMax}`,
                  locationState !== "Any State" && locationState,
                ].filter(Boolean).join(" · ") || "Budget: Any · Make: Any · Mileage: Any"}
              </div>
              <button
                onClick={() => setAdjustExpanded((v) => !v)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#00d97e] text-[#0d1117] text-xs font-bold rounded-xl hover:bg-[#00f090] transition-colors"
              >
                Adjust <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adjustExpanded ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Expanded panel */}
            {adjustExpanded && (
              <div className="px-5 pb-6 border-t border-white/[0.06]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-4">

                  {/* Budget */}
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-1.5">Budget</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRICE_OPTIONS.map(({ label, value }) => (
                        <button key={label}
                          onClick={() => setLocalPriceMax(value)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${localPriceMax === value ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]" : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Make */}
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-1.5">Make</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MAKES.map((m) => (
                        <button key={m}
                          onClick={() => setLocalMake(m)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${localMake === m ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]" : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"}`}
                        >{m === "All Makes" ? "Any" : m}</button>
                      ))}
                    </div>
                  </div>

                  {/* Mileage */}
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-1.5">Max mileage</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MILEAGE_OPTIONS.map(({ label, value }) => (
                        <button key={label}
                          onClick={() => setLocalMileageMax(value)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${localMileageMax === value ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]" : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Year */}
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-1.5">Year</p>
                    <div className="flex flex-wrap gap-1.5">
                      {YEAR_OPTIONS.map((o) => {
                        const active = o.min ? localYearMin === o.min : o.max ? localYearMax === o.max : (!localYearMin && !localYearMax);
                        return (
                          <button key={o.label}
                            onClick={() => { setLocalYearMin(o.min); setLocalYearMax(o.max); }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]" : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"}`}
                          >{o.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* State */}
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-1.5">State</p>
                    <select
                      value={localLocationState}
                      onChange={(e) => setLocalLocationState(e.target.value)}
                      className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d97e]/40 w-full"
                    >
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Sort */}
                  <div>
                    <p className="text-xs font-semibold text-white/60 mb-1.5">Sort by</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SORT_OPTIONS.map((o) => (
                        <button key={o.value}
                          onClick={() => setLocalSort(o.value)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${localSort === o.value ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]" : "bg-white/[0.06] text-white/60 border-white/[0.12] hover:border-white/30"}`}
                        >{o.label}</button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 mt-2 border-t border-white/[0.08]">
                  <button
                    onClick={() => {
                      setMake(localMake);
                      setPriceMax(localPriceMax);
                      setMileageMax(localMileageMax);
                      setYearMin(localYearMin);
                      setYearMax(localYearMax);
                      setLocationState(localLocationState);
                      setSort(localSort);
                      setAdjustExpanded(false);
                      trackEvent("deals_filter_applied", {
                        make: localMake !== "All Makes" ? localMake : null,
                        price_max: localPriceMax,
                        mileage_max: localMileageMax,
                        year_min: localYearMin,
                        year_max: localYearMax,
                        state: localLocationState !== "Any State" ? localLocationState : null,
                        sort: localSort,
                      });
                    }}
                    className="px-4 py-2 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00f090] transition-colors"
                  >
                    Update Results
                  </button>
                  <button
                    onClick={() => {
                      setLocalMake("All Makes"); setLocalPriceMax(null); setLocalMileageMax(null);
                      setLocalYearMin(null); setLocalYearMax(null); setLocalLocationState("Any State"); setLocalSort("price_asc");
                    }}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => fetchDeals(1)}
                    disabled={loading}
                    className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <button onClick={() => setAdjustExpanded(false)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <>
            <p className="text-xs text-white/30 mb-3 flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              Loading deals — refreshed 3× daily
            </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-[#161b22] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-white/[0.04]" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                  <div className="h-4 bg-white/[0.04] rounded w-1/2" />
                  <div className="h-8 bg-white/[0.04] rounded" />
                </div>
              </div>
            ))}
          </div>
          </>
        ) : deals.length === 0 ? (
          <div className="text-center py-24">
            <Zap className="w-10 h-10 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-base font-medium mb-2">No deals found</p>
            <p className="text-white/25 text-sm">Try adjusting your filters or check back soon — deals refresh 3× daily.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {deals.map((deal, index) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  rank={index + 1 + (page - 1) * 20}
                  totalDeals={total}
                  onTrackEvent={(name, data) => { trackEvent(name, data as Parameters<typeof trackEvent>[1]); }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  onClick={() => { fetchDeals(page - 1); trackEvent("deals_page_changed", { page: page - 1, total_pages: totalPages }); }}
                  disabled={page <= 1 || loading}
                  className="px-4 py-2 text-sm text-white/50 hover:text-white/80 border border-white/[0.08] rounded-lg disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-white/30">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => { fetchDeals(page + 1); trackEvent("deals_page_changed", { page: page + 1, total_pages: totalPages }); }}
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
          Listings are curated by OFFO for informational purposes only. Always verify independently before purchase.
        </p>
      </main>

      <Footer />
    </div>
  );
}

export default function DealsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00d97e]/30 border-t-[#00d97e] rounded-full animate-spin" />
      </div>
    }>
      <DealsPageInner />
    </Suspense>
  );
}
