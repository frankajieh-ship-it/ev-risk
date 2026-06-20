"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Tag, ArrowRight, SlidersHorizontal, AlertCircle, ExternalLink } from "lucide-react";
import type { MinimumViableRoutine } from "@/types/v2";
import type { CuratedDealMatch, DealsMatchResponse } from "@/types/recommendations";

interface CuratedDealsMatchProps {
  routine: MinimumViableRoutine;
}

const FIT_LABEL_STYLES: Record<string, { bg: string; text: string }> = {
  "Great Fit":    { bg: "bg-[#00d97e]/15", text: "text-[#00d97e]" },
  "Good Fit":     { bg: "bg-sky-500/15",   text: "text-sky-400" },
  "Mixed Fit":    { bg: "bg-amber-500/15", text: "text-amber-400" },
  "High Friction":{ bg: "bg-red-500/15",   text: "text-red-400" },
};

function SkeletonDealCard() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden animate-pulse">
      <div className="h-36 bg-white/[0.07]" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 bg-white/[0.08] rounded" />
        <div className="h-3 w-1/2 bg-white/[0.06] rounded" />
        <div className="flex gap-1 mt-2">
          <div className="h-5 w-14 bg-white/[0.06] rounded-full" />
          <div className="h-5 w-16 bg-white/[0.06] rounded-full" />
        </div>
      </div>
    </div>
  );
}

function DealMatchCard({ deal }: { deal: CuratedDealMatch }) {
  const receiptUrl = deal.receipt_id
    ? `/receipt?id=${deal.receipt_id}`
    : `/receipt?url=${encodeURIComponent(deal.listing_url)}`;

  const labelStyle = FIT_LABEL_STYLES[deal.fit_label] ?? FIT_LABEL_STYLES["Mixed Fit"];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden flex flex-col hover:border-white/[0.15] transition-colors">
      <div className="h-36 bg-white/[0.05] overflow-hidden relative shrink-0">
        {deal.photo_url ? (
          // photo_url is pre-proxied (/api/img?url=...) in the DB
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.photo_url}
            alt={deal.vehicle_label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/20 text-xs">No photo</span>
          </div>
        )}
        {/* Fit label badge */}
        <div className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${labelStyle.bg} ${labelStyle.text}`}>
          {deal.fit_label} · {deal.match_score}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
            {deal.vehicle_label}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
            {deal.price != null && (
              <span className="text-white/80 font-medium">${deal.price.toLocaleString()}</span>
            )}
            {deal.mileage != null && (
              <span>{deal.mileage.toLocaleString()} mi</span>
            )}
          </div>
        </div>

        {deal.match_reasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deal.match_reasons.slice(0, 3).map((reason) => (
              <span
                key={reason}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/50 text-[10px] font-medium"
              >
                <Tag className="w-2.5 h-2.5" />
                {reason}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-auto pt-1">
          <Link
            href={receiptUrl}
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg bg-[#00d97e]/10 text-[#00d97e] hover:bg-[#00d97e]/20 transition-colors"
          >
            Run Analysis
          </Link>
          <a
            href={deal.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors px-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function NoResultsCard({ filtersApplied }: { filtersApplied: string[] }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">No deals match your current filters</p>
          <p className="text-xs text-white/40 mt-1">
            These filters eliminated all results from our database:
          </p>
          {filtersApplied.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filtersApplied.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 text-xs font-medium border border-white/[0.08]"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-white/40">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Try loosening your drivetrain, budget, or body type in the Adjust Results panel above.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CuratedDealsMatch({ routine }: CuratedDealsMatchProps) {
  const [matches, setMatches] = useState<CuratedDealMatch[]>([]);
  const [filtersApplied, setFiltersApplied] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMatched, setTotalMatched] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/deals/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routine }),
        });
        if (!res.ok) throw new Error("fetch failed");
        const data: DealsMatchResponse = await res.json();
        if (data.success) {
          setMatches(data.matches);
          setTotalMatched(data.total_matched);
          setFiltersApplied(data.filters_applied);
        }
      } catch {
        setMatches([]);
        setFiltersApplied([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [routine]);

  const hasMatches = matches.length > 0;
  const showNoResults = !loading && !hasMatches;

  // Hide entirely only if loading finished, nothing to show, and no filters were active
  if (!loading && !hasMatches && filtersApplied.length === 0) return null;

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            {hasMatches ? "Real Listings That Match Your EVFit" : "Deal Watch"}
          </h3>
          {!loading && hasMatches && totalMatched > 6 && (
            <p className="text-xs text-white/40 mt-0.5">{totalMatched} deals match · showing top 6</p>
          )}
        </div>
        {hasMatches && (
          <Link href="/deals" className="flex items-center gap-1 text-xs text-[#00d97e] font-medium hover:underline">
            All deals <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Curated deals grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonDealCard key={i} />)}
        </div>
      ) : hasMatches ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {matches.map((deal) => <DealMatchCard key={deal.id} deal={deal} />)}
        </div>
      ) : null}

      {/* Zero-results state */}
      {showNoResults && (
        <NoResultsCard filtersApplied={filtersApplied} />
      )}

    </div>
  );
}
