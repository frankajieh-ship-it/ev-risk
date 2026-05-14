"use client";

/**
 * AuctionAuditTeaser — Upsell banner shown on /copart after free results load.
 *
 * Shows 3 blurred dollar figures (ARV, repair cost, max safe bid) with a CTA
 * that links to the full audit page where payment happens.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Lock, TrendingUp, Wrench, Gavel } from "lucide-react";

interface AuctionAuditTeaserProps {
  resultId: string;
  repairCostLow?: number | null;
  repairCostHigh?: number | null;
  maxSafeBid?: number | null;
  arv?: number | null;
  arvRange?: { low: number; high: number } | null;
  onShown?: () => void;
  onCtaClick?: () => void;
}

function blurFmt(n: number | null | undefined, fallback: string): string {
  if (n != null && n > 0) return "$" + Math.round(n).toLocaleString();
  return fallback;
}

export default function AuctionAuditTeaser({
  resultId,
  repairCostLow,
  repairCostHigh,
  maxSafeBid,
  arv,
  arvRange,
  onShown,
  onCtaClick,
}: AuctionAuditTeaserProps) {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!shownRef.current) {
      shownRef.current = true;
      onShown?.();
    }
  }, [onShown]);

  const arvDisplay = arvRange
    ? `${blurFmt(arvRange.low, "$28,000")}–${blurFmt(arvRange.high, "$34,000")}`
    : arv
    ? blurFmt(arv, "$31,000")
    : "$28,000–$34,000";

  const repairDisplay = repairCostLow && repairCostHigh
    ? `${blurFmt(repairCostLow, "$3,800")}–${blurFmt(repairCostHigh, "$6,200")}`
    : "$3,800–$6,200";

  const bidDisplay = blurFmt(maxSafeBid, "$21,500");

  return (
    <div className="rounded-2xl border border-[#00d97e]/20 bg-white/[0.04] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2 mb-1">
          <Gavel className="w-4 h-4 text-[#00d97e]" />
          <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wide">
            Full Auction Audit
          </span>
        </div>
        <h3 className="text-base font-bold text-white leading-tight">
          Know your numbers before you bid
        </h3>
        <p className="text-xs text-white/50 mt-0.5">
          Market value, repair cost range, and your maximum safe bid — computed from real auction data.
        </p>
      </div>

      {/* Blurred numbers */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-white/[0.06]">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1.5">
            <TrendingUp className="w-3 h-3 text-white/30" />
            <p className="text-[10px] text-white/40 font-medium">Market Value</p>
          </div>
          <div className="relative inline-block">
            <p className="text-sm font-bold text-white/20 blur-sm select-none">{arvDisplay}</p>
            <Lock className="w-3 h-3 text-white/30 absolute inset-0 m-auto" />
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1.5">
            <Wrench className="w-3 h-3 text-white/30" />
            <p className="text-[10px] text-white/40 font-medium">Repair Cost</p>
          </div>
          <div className="relative inline-block">
            <p className="text-sm font-bold text-white/20 blur-sm select-none">{repairDisplay}</p>
            <Lock className="w-3 h-3 text-white/30 absolute inset-0 m-auto" />
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1.5">
            <Gavel className="w-3 h-3 text-white/30" />
            <p className="text-[10px] text-white/40 font-medium">Max Safe Bid</p>
          </div>
          <div className="relative inline-block">
            <p className="text-sm font-bold text-white/20 blur-sm select-none">{bidDisplay}</p>
            <Lock className="w-3 h-3 text-white/30 absolute inset-0 m-auto" />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <p className="text-xs text-white/40">
          One-time · No subscription · Instant access
        </p>
        <Link
          href={`/auction/${resultId}`}
          onClick={onCtaClick}
          className="shrink-0 flex items-center gap-1.5 bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] font-bold text-sm px-4 py-2 rounded-xl transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          View Full Audit
        </Link>
      </div>
    </div>
  );
}
