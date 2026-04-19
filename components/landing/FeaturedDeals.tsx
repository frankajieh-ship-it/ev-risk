"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import DealCard, { type CuratedDeal } from "@/components/deals/DealCard";

export default function FeaturedDeals() {
  const [deals, setDeals] = useState<CuratedDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deals?verdict=GREEN,YELLOW&per_page=10&page=1")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.deals?.length) setDeals(data.deals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Don't render the section if there are no deals and loading is done
  if (!loading && deals.length === 0) return null;

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
            Pre-analyzed by OFFO — verdict and risk score included.
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
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {deals.map((deal, i) => (
              <DealCard key={deal.id} deal={deal} compact rank={i + 1} />
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
      )}
    </section>
  );
}
