/**
 * ReceiptOutputCard — Displays the generated listing receipt
 *
 * Verdict badge, price sanity, risk flags, must-answer questions,
 * inspect first, negotiation opener, copy button.
 */

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  CheckCircle,
  AlertTriangle,
  Shield,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Lock,
  Info,
  Store,
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  X,
  Bookmark,
  GitCompare,
} from "lucide-react";
import type { ListingReceipt, LintError } from "@/types/receipt";
import type { Region } from "@/lib/region";
import { formatPrice } from "@/lib/region";
import VehicleFactsBar from "@/components/receipt/VehicleFactsBar";
import PhotoDueDiligenceCard from "@/components/receipt/PhotoDueDiligenceCard";
import { Badge } from "@/components/ui";

interface ReceiptOutputCardProps {
  receipt: ListingReceipt;
  lintPassed: boolean;
  lintErrors: LintError[];
  onCopy?: () => void;
  onTrackCopy?: (copyType: string) => void;
  onAutoFix?: () => void;
  isFixing?: boolean;
  isFallback?: boolean;
  isSimilarityMatch?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onTrackLintFallback?: () => void;
  region?: Region;
  sellerPackUnlocked?: boolean;
  onSellerPackUpgrade?: () => void;
  isUpgrading?: boolean;
  upgradeFailed?: boolean;
  isUnlocked?: boolean;
  paymentsEnabled?: boolean;
  onPaywallClick?: () => void;
  photos?: string[];
  receiptId?: string;
  vin?: string;
  onSave?: () => void;
  saveState?: "idle" | "saved";
  onCompare?: () => void;
  showCompare?: boolean;
  firstSeenAt?: string | null;
  priceDropCents?: number | null;
  dealerInfo?: { id: string; name: string; slug: string; logo_url: string | null; is_verified: boolean } | null;
  onContactDealer?: () => void;
}

const VERDICT_STYLES = {
  GREEN: {
    bg: "bg-green-950/60",
    text: "text-green-400",
    border: "border-green-500/30",
    label: "Good Deal",
    icon: Shield,
  },
  YELLOW: {
    bg: "bg-amber-950/60",
    text: "text-amber-300",
    border: "border-amber-500/30",
    label: "Proceed with Caution",
    icon: AlertTriangle,
  },
  RED: {
    bg: "bg-red-950/60",
    text: "text-red-400",
    border: "border-red-500/30",
    label: "High Risk",
    icon: AlertCircle,
  },
};

const PRICE_STYLES = {
  UNDERPRICED: { bg: "bg-[#00d97e]/[0.08]",   text: "text-[#00d97e]",  label: "Underpriced" },
  FAIR:        { bg: "bg-blue-500/[0.08]",     text: "text-blue-400",   label: "Fair Price" },
  OVERPRICED:  { bg: "bg-red-500/[0.08]",      text: "text-red-400",    label: "Overpriced" },
  UNKNOWN:     { bg: "bg-white/[0.06]",        text: "text-white/40",   label: "Price Pending" },
};

const EVIDENCE_STYLES: Record<string, { bg: string; text: string }> = {
  STRONG:  { bg: "bg-blue-500/[0.12]",   text: "text-blue-300"   },
  PARTIAL: { bg: "bg-white/[0.08]",      text: "text-white/50"   },
  MISSING: { bg: "bg-orange-500/[0.10]", text: "text-orange-400" },
};

const REASON_CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  routine_friction: { bg: "bg-blue-500/[0.10]",   text: "text-blue-400",   label: "Routine" },
  listing_risk:     { bg: "bg-red-500/[0.10]",    text: "text-red-400",    label: "Risk" },
  missing_proof:    { bg: "bg-orange-500/[0.10]", text: "text-orange-400", label: "Proof" },
};

export default function ReceiptOutputCard({
  receipt,
  lintPassed,
  lintErrors,
  onCopy,
  onTrackCopy,
  onAutoFix,
  isFixing,
  isFallback,
  isSimilarityMatch,
  onRegenerate,
  isRegenerating,
  onTrackLintFallback,
  region = "US",
  sellerPackUnlocked,
  onSellerPackUpgrade,
  isUpgrading,
  upgradeFailed,
  isUnlocked = false,
  paymentsEnabled = false,
  onPaywallClick,
  photos = [],
  receiptId,
  vin,
  onSave,
  saveState = "idle",
  onCompare,
  showCompare = false,
  firstSeenAt,
  priceDropCents,
  dealerInfo,
  onContactDealer,
}: ReceiptOutputCardProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [scoringTooltipOpen, setScoringTooltipOpen] = useState(false);
  const [whyNotGreenOpen, setWhyNotGreenOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fallbackFiredRef = useRef(false);

  // Normalize AI-returned array field — AI can return why_not_green as non-array
  const whyNotGreen = Array.isArray(receipt.why_not_green) ? receipt.why_not_green : [];

  const photoSrcs = photos;

  const prevPhoto = useCallback(() =>
    setPhotoIndex((i) => (i - 1 + photoSrcs.length) % photoSrcs.length),
    [photoSrcs.length]
  );
  const nextPhoto = useCallback(() =>
    setPhotoIndex((i) => (i + 1) % photoSrcs.length),
    [photoSrcs.length]
  );

  // Wikimedia URLs are public — serve directly; proxy everything else
  const resolveImgSrc = (url: string | undefined) => {
    if (!url) return url;
    // Only proxy URLs that need hotlink protection stripped (Wikimedia, CarGurus CDN).
    // Marketcheck dealer CDN URLs (dealerinspire, dealer.com, etc.) are public — serve directly.
    if (url.includes("wikimedia.org") || url.includes("cargurus.com") || url.includes("cimg.cargurus.com")) {
      return `/api/img?url=${encodeURIComponent(url)}`;
    }
    return url;
  };


  useEffect(() => {
    if (!lintPassed && receipt && !fallbackFiredRef.current) {
      fallbackFiredRef.current = true;
      onTrackLintFallback?.();
    }
  }, [lintPassed, receipt, onTrackLintFallback]);

  const copySection = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionId);
      onTrackCopy?.(sectionId);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const verdict = VERDICT_STYLES[receipt.verdict];
  const VerdictIcon = verdict.icon;
  const price = PRICE_STYLES[receipt.price_sanity?.label || "UNKNOWN"];

  // Vehicle description
  const ls = receipt.listing_summary;
  const vehicleDesc = [ls?.year, ls?.make, ls?.model, ls?.trim]
    .filter(Boolean)
    .join(" ");
  const priceStr = ls?.price
    ? formatPrice(ls.price, region)
    : null;

   
  const [nowMs] = useState(() => Date.now());
  type ListingAgeBadge = { label: string; cls: string } | null;
  const listingAgeBadge = useMemo((): ListingAgeBadge => {
    if (priceDropCents && priceDropCents > 0) {
      const dropped = Math.round(priceDropCents / 100);
      return { label: `Price dropped $${dropped.toLocaleString()}`, cls: "text-[#00d97e] bg-[#00d97e]/[0.08] border-[#00d97e]/20" };
    }
    if (!firstSeenAt) return null;
    const daysDiff = Math.floor((nowMs - new Date(firstSeenAt).getTime()) / 86_400_000);
    if (daysDiff < 3) return { label: "Just listed", cls: "text-white/50 bg-white/[0.06] border-white/10" };
    if (daysDiff >= 30) return { label: `${daysDiff}+ days on market — room to negotiate`, cls: "text-amber-400 bg-amber-500/[0.08] border-amber-500/20" };
    if (daysDiff >= 15) return { label: `Listed ${daysDiff} days ago`, cls: "text-yellow-400 bg-yellow-500/[0.08] border-yellow-500/20" };
    return null;
  }, [firstSeenAt, priceDropCents, nowMs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden"
    >
      {/* Full analysis in progress — prominent banner with animated bar */}
      {isUpgrading && (
        <div className="bg-[#161b22] border-b border-white/[0.08] px-5 py-3.5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00d97e] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#00d97e] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#00d97e] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-sm font-semibold text-white">
              Full analysis running — verdict loading
            </p>
          </div>
          <div className="h-1 w-full bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full bg-[#00d97e] rounded-full animate-pulse w-2/3" />
          </div>
          <p className="text-xs text-white/40 mt-1.5">
            Initial signals shown below. Full verdict replaces this in ~15–30 seconds.
          </p>
        </div>
      )}

      {/* Upgrade failed - reassurance banner */}
      {upgradeFailed && !isUpgrading && (
        <div className="bg-[#00d97e]/[0.08] border-b border-[#00d97e]/20 px-5 py-3">
          <p className="text-sm text-[#00d97e]">
            ✓ Your receipt is complete with {receipt.listing_signals?.length || 0}+ data points analyzed.
            All key risk factors and pricing insights are included.
          </p>
        </div>
      )}

      {/* OFFO Verified Dealer bar — shown when listing matches dealer inventory */}
      {dealerInfo && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#00d97e]/10 bg-[#00d97e]/[0.04]">
          {dealerInfo.logo_url && (
            <img src={dealerInfo.logo_url} alt="" className="h-7 w-auto rounded flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{dealerInfo.name}</p>
            {dealerInfo.is_verified && (
              <span className="flex items-center gap-1 text-xs text-[#00d97e]">
                <ShieldCheck className="w-3 h-3" /> OFFO Verified Dealer
              </span>
            )}
          </div>
          {onContactDealer && (
            <button
              onClick={onContactDealer}
              className="flex-shrink-0 text-xs font-semibold bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] px-3 py-1.5 rounded-lg transition-colors"
            >
              Contact Dealer
            </button>
          )}
        </div>
      )}

      {/* Verdict banner — neutral/pending style while upgrading */}
      <div className={`${isUpgrading ? "bg-[#161b22] border-white/[0.08]" : `${verdict.bg} ${verdict.border}`} border-b px-5 py-4`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Overall Verdict</p>
          {/* Quick-action icons — save + compare without scrolling */}
          {!isUpgrading && (
            <div className="flex items-center gap-1">
              {onSave && (
                <button
                  onClick={onSave}
                  title={saveState === "saved" ? "Saved to garage" : "Save to My Garage"}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${saveState === "saved" ? "text-[#00d97e]" : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"}`}
                >
                  <Bookmark className={`w-4 h-4 ${saveState === "saved" ? "fill-[#00d97e]" : ""}`} />
                  <span className="hidden sm:inline">{saveState === "saved" ? "Saved" : "Save report"}</span>
                </button>
              )}
              {onCompare && showCompare && (
                <button
                  onClick={onCompare}
                  title="Compare with another listing"
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <GitCompare className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isUpgrading
            ? <HelpCircle className="w-6 h-6 text-white/40" />
            : <VerdictIcon className={`w-6 h-6 ${verdict.text}`} />
          }
          <div>
            <div className="flex items-center gap-2">
              {isUpgrading ? (
                <span className="text-lg font-bold text-white/40">Analyzing…</span>
              ) : (
                <>
                  <span className={`text-lg font-bold ${verdict.text}`}>
                    {receipt.verdict}
                  </span>
                  <span className={`text-sm font-medium ${verdict.text} opacity-80`}>
                    — {verdict.label}
                  </span>
                </>
              )}
              {!isUpgrading && receipt.evidence_label === "STRONG" && (
                <Badge variant="primary">Strong Evidence</Badge>
              )}
            </div>
            {vehicleDesc && (
              <p className="text-sm text-white/70 mt-0.5">
                {vehicleDesc}
                {priceStr && <span className="font-semibold"> · {priceStr}</span>}
              </p>
            )}
            {listingAgeBadge && (
              <span className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${listingAgeBadge.cls}`}>
                {listingAgeBadge.label}
              </span>
            )}
          </div>
        </div>

        {/* Photo strip — hero + thumbnail row, only when photos available */}
        {photoSrcs.length > 0 && (
          <div className="mt-3 -mx-5 relative">
            {/* Hero image */}
            <div
              className="relative w-full aspect-[16/7] overflow-hidden cursor-pointer group"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={resolveImgSrc(photoSrcs[photoIndex])}
                alt={vehicleDesc ? `${vehicleDesc} — listing photo ${photoIndex + 1} of ${photoSrcs.length}` : `Listing photo ${photoIndex + 1} of ${photoSrcs.length}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                onError={(e) => {
                  // Hide broken image — no fallback to wrong-car stock images
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              {/* Gradient overlay so text below stays readable */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
              {/* Expand hint */}
              <div className="absolute top-2 right-2 bg-black/40 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Expand className="w-3.5 h-3.5 text-white" />
              </div>
              {/* Prev/next on hero */}
              {photoSrcs.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full p-1.5 transition-colors"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full p-1.5 transition-colors"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              {/* Counter */}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {photoIndex + 1} / {photoSrcs.length}
              </div>
            </div>

            {/* Thumbnail strip — only when 2+ photos */}
            {photoSrcs.length > 1 && (
              <div className="flex gap-1.5 px-5 pt-2 pb-0 overflow-x-auto scrollbar-hide">
                {photoSrcs.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                      i === photoIndex ? "border-[#00d97e] opacity-100" : "border-transparent opacity-60 hover:opacity-90"
                    }`}
                  >
                    <img src={resolveImgSrc(url)} alt={vehicleDesc ? `${vehicleDesc} — photo ${i + 1}` : `Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isSimilarityMatch && (
          <p className={`text-sm mt-3 ${isUpgrading ? "text-white/40 italic" : "text-white/70"}`}>
            {isUpgrading ? "Verdict and full reasoning will appear when analysis completes." : receipt.verdict_reason}
          </p>
        )}
        {region === "UK" && (
          <p className="text-xs text-white/40 mt-1.5">UK Mode (beta) — prices in pounds, UK wording</p>
        )}
      </div>

      {/* Photo due diligence — coverage checklist + AI damage scan */}
      {receiptId && photoSrcs.length > 0 && (
        <PhotoDueDiligenceCard
          receiptId={receiptId}
          photoUrls={photoSrcs}
          onHighlightPhoto={(index) => { setPhotoIndex(index); }}
        />
      )}

      {/* Vehicle Facts Bar — title status, accidents, live NHTSA recalls, battery estimate */}
      <VehicleFactsBar receipt={receipt} isUnlocked={isUnlocked} paymentsEnabled={paymentsEnabled} onPaywallClick={onPaywallClick} />

      {/* Why not GREEN? — collapsible */}
      {whyNotGreen && whyNotGreen.length > 0 && receipt.verdict !== "GREEN" && (
        <div className="px-5 py-3 bg-[#161b22] border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              onClick={() => setWhyNotGreenOpen((o) => !o)}
              className="flex items-center gap-1.5 flex-1 text-left"
            >
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                Why not GREEN?
              </p>
              <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${whyNotGreenOpen ? "rotate-180" : ""}`} />
            </button>
            <div className="relative">
              <button
                onClick={() => setScoringTooltipOpen((o) => !o)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="How scoring works"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {scoringTooltipOpen && (
                <div className="absolute left-0 top-5 z-20 w-64 bg-[#161b22] border border-white/[0.10] rounded-xl shadow-lg p-3 text-xs text-white/70 space-y-1.5">
                  <p className="font-semibold text-white">How verdicts are scored</p>
                  <p><span className="font-medium text-green-400">GREEN</span> — low risk, strong evidence (price fair, history clean, no flags)</p>
                  <p><span className="font-medium text-yellow-400">YELLOW</span> — moderate risk or missing proof (high mileage, no service records, price unclear)</p>
                  <p><span className="font-medium text-red-400">RED</span> — hard flag present (salvage title, accident history, severely overpriced)</p>
                  <p className="text-white/50 pt-1 border-t border-white/[0.08]">Categories: <span className="text-red-400">Risk</span> = confirmed concern · <span className="text-orange-400">Proof</span> = missing evidence · <span className="text-blue-400">Routine</span> = standard friction</p>
                  <button onClick={() => setScoringTooltipOpen(false)} className="text-white/40 hover:text-white/60 mt-1">Close</button>
                </div>
              )}
            </div>
          </div>
          {whyNotGreenOpen && (isUnlocked || !paymentsEnabled ? (
            <ul className="space-y-1 mt-1.5">
              {whyNotGreen.map((reason: { signal_id: string; category: string; points: number; label: string }, i: number) => {
                const catStyle = REASON_CATEGORY_STYLES[reason.category] || REASON_CATEGORY_STYLES.listing_risk;
                return (
                  <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${catStyle.bg} ${catStyle.text}`}>
                      {catStyle.label}
                    </span>
                    <span className="flex-1">{reason.label}</span>
                    {reason.points !== 0 && (
                      <span className="text-xs text-white/40 whitespace-nowrap">{reason.points}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-1.5">
              <ul className="space-y-1 mb-2">
                {whyNotGreen.slice(0, 1).map((reason: { signal_id: string; category: string; points: number; label: string }, i: number) => {
                  const catStyle = REASON_CATEGORY_STYLES[reason.category] || REASON_CATEGORY_STYLES.listing_risk;
                  return (
                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${catStyle.bg} ${catStyle.text}`}>
                        {catStyle.label}
                      </span>
                      <span className="flex-1">{reason.label}</span>
                    </li>
                  );
                })}
                {whyNotGreen.slice(1).map((reason: { signal_id: string; category: string; points: number; label: string }, i: number) => {
                  const catStyle = REASON_CATEGORY_STYLES[reason.category] || REASON_CATEGORY_STYLES.listing_risk;
                  const preview = reason.label.length > 45 ? reason.label.slice(0, 45) + "…" : reason.label;
                  return (
                    <li key={`locked-${i}`} className="text-sm flex items-start gap-2 select-none">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${catStyle.bg} ${catStyle.text}`}>
                        {catStyle.label}
                      </span>
                      <span className="flex-1 blur-[3px] text-gray-500">{preview}</span>
                    </li>
                  );
                })}
              </ul>
              {whyNotGreen.length > 1 && (
                <button
                  onClick={onPaywallClick}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  +{whyNotGreen.length - 1} more reason{whyNotGreen.length - 1 !== 1 ? "s" : ""} — see full analysis
                </button>
              )}
            </div>
          ))}
        </div>
      )}



      <div className="p-5 space-y-5">
        {/* Price Sanity — hidden when UNKNOWN (deep market comparison still processing) */}
        {receipt.price_sanity && receipt.price_sanity.label !== "UNKNOWN" && (
          <div className={`${price.bg} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className={`w-4 h-4 ${price.text}`} />
              <span className={`text-sm font-semibold ${price.text}`}>
                {price.label}
              </span>
              {receipt.price_sanity.confidence > 0 && (
                <span className="text-xs text-white/50">
                  ({Math.round(receipt.price_sanity.confidence * 100)}% confidence)
                </span>
              )}
            </div>
            <p className="text-sm text-white/70">
              {receipt.price_sanity.rationale_short}
            </p>
            {/* Market price range — from Auto.dev enrichment via listing_summary passthrough */}
            {(() => {
              const mpr = (receipt.listing_summary as Record<string, unknown>)?.market_price_range as { low: number; high: number; count: number } | undefined;
              if (!mpr || mpr.count === 0) return null;
              return (
                <p className="text-xs text-white/50 mt-1.5">
                  Market range: <span className="font-semibold text-white/70">{formatPrice(mpr.low, region)} – {formatPrice(mpr.high, region)}</span>
                  <span className="ml-1">({mpr.count} comparable listing{mpr.count !== 1 ? "s" : ""})</span>
                </p>
              );
            })()}
          </div>
        )}

        {/* Seller & location context */}
        {(() => {
          const ls = receipt.listing_summary;
          const sellerType = ls?.seller_type;
          const zip = ls?.zip_or_postcode;
          if (!sellerType && !zip) return null;
          const sellerLabel = sellerType === "dealer" ? "Dealer" : sellerType === "private" ? "Private seller" : null;
          const negotiationNote = sellerType === "private"
            ? "Private sellers are often more flexible — come prepared with comparable listings."
            : sellerType === "dealer"
            ? "Dealers have more room on add-ons and fees than the sticker price."
            : null;
          return (
            <div className="flex items-start gap-2 text-xs text-white/60 -mt-1">
              {sellerType === "dealer"
                ? <Store className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" />
                : <User className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" />}
              <span>
                {sellerLabel && <span className="font-medium text-white/70">{sellerLabel}</span>}
                {zip && <span className="text-white/40 ml-1">· {zip}</span>}
                {negotiationNote && <span className="text-white/50 ml-1">— {negotiationNote}</span>}
              </span>
            </div>
          );
        })()}

        {/* Lint errors — itemized list + auto-fix */}
        {!lintPassed && lintErrors.length > 0 && (
          <div className="bg-amber-500/[0.08] border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">
                {lintErrors.length} lint issue{lintErrors.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="space-y-1">
              {lintErrors.map((err, i) => (
                <li key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">·</span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
            {onAutoFix && (
              <button
                onClick={onAutoFix}
                disabled={isFixing}
                className="mt-3 w-full py-2 text-sm font-medium rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/[0.08] transition-all disabled:opacity-50"
              >
                {isFixing ? "Fixing..." : "Auto-fix lint issues"}
              </button>
            )}
          </div>
        )}

      {/* Regenerate button — always visible for non-fallback receipts */}
      {!isFallback && onRegenerate && (
        <div className="px-5 pb-4">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="w-full py-2.5 text-sm font-medium rounded-lg border border-white/[0.12] text-white/60 hover:bg-white/[0.06] hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegenerating ? "Generating fresh analysis..." : "Regenerate analysis"}
          </button>
        </div>
      )}

      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && photoSrcs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={resolveImgSrc(photoSrcs[photoIndex])}
                alt={vehicleDesc ? `${vehicleDesc} — photo ${photoIndex + 1} of ${photoSrcs.length}` : `Listing photo ${photoIndex + 1} of ${photoSrcs.length}`}
                className="w-full max-h-[75vh] object-contain rounded-xl"
              />
              {photoSrcs.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/75 text-white rounded-full p-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-center text-white/70 text-xs mt-2">
                {photoIndex + 1} of {photoSrcs.length} · Click outside to close
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Section helper ---

function Section({
  icon,
  title,
  children,
  onCopy,
  copied,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {onCopy && (
          <button
            onClick={onCopy}
            className="ml-auto text-white/40 hover:text-white/60 transition-colors"
            title={`Copy ${title}`}
          >
            {copied ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
