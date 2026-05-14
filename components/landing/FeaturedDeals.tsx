"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, ArrowRight, Bell } from "lucide-react";
import DealCard, { type CuratedDeal } from "@/components/deals/DealCard";

export default function FeaturedDeals() {
  const [deals, setDeals] = useState<CuratedDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deals?sort=mileage&per_page=10&page=1")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.deals?.length) setDeals(data.deals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      {/* Section header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#00d97e]">
              Deal Watch
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Today&apos;s Best EV Deals
          </h2>
          <p className="text-white/40 text-sm mt-1 max-w-md">
            Curated EV listings sorted by lowest mileage — run analysis to see if it&apos;s a good deal.
          </p>
        </div>
        <Link
          href="/deals"
          className="hidden sm:flex items-center gap-1.5 text-sm text-[#00d97e] hover:text-[#00d97e]/80 transition-colors font-medium"
        >
          View all deals
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#161b22] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-[16/9] bg-white/[0.04]" />
              <div className="p-3 space-y-3">
                <div className="h-4 bg-white/[0.04] rounded w-3/4" />
                <div className="h-5 bg-white/[0.04] rounded w-1/2" />
                <div className="h-9 bg-white/[0.04] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : deals.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {deals.map((deal, i) => (
              <DealCard key={deal.id} deal={deal} preview rank={i + 1} />
            ))}
          </div>
          <div className="flex sm:hidden justify-center mt-6">
            <Link
              href="/deals"
              className="flex items-center gap-1.5 text-sm text-[#00d97e] font-medium"
            >
              View all deals
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-5 py-8 text-center">
          <p className="text-sm text-white/40">No deals available right now — check back soon.</p>
          <Link href="/deals" className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#00d97e] font-medium hover:text-[#00f090] transition-colors">
            Browse all deals <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Deal Watch alert CTA — always shown */}
      <div className="mt-6 rounded-xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-[#00d97e] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Get alerted when prices drop</p>
            <p className="text-xs text-white/40 mt-0.5">
              Save search filters and OFFO notifies you by email when matching EVs drop in price or a new GREEN listing appears.
            </p>
          </div>
        </div>
        <Link
          href="/deals"
          className="shrink-0 px-4 py-2 rounded-lg bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00f090] transition-colors whitespace-nowrap"
        >
          Set up deal watch →
        </Link>
      </div>
    </section>
  );
}
