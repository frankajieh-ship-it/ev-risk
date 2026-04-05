/**
 * ReceiptOutputCard — Displays the generated listing receipt
 *
 * Verdict badge, price sanity, risk flags, must-answer questions,
 * inspect first, negotiation opener, copy button.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  CheckCircle,
  AlertTriangle,
  Shield,
  Search,
  DollarSign,
  AlertCircle,
  HelpCircle,
  FileSearch,
  Lock,
  Info,
  Store,
  User,
  ChevronLeft,
  ChevronRight,
  Expand,
  X,
} from "lucide-react";
import type { ListingReceipt, LintError } from "@/types/receipt";
import type { Region } from "@/lib/region";
import { formatPrice } from "@/lib/region";
import { humanizeFlag } from "@/lib/receipt-rules";
import VehicleFactsBar from "@/components/receipt/VehicleFactsBar";
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
}

const VERDICT_STYLES = {
  GREEN: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
    label: "Good Deal",
    icon: Shield,
  },
  YELLOW: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
    label: "Proceed with Caution",
    icon: AlertTriangle,
  },
  RED: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
    label: "High Risk",
    icon: AlertCircle,
  },
};

const PRICE_STYLES = {
  UNDERPRICED: { bg: "bg-green-50", text: "text-green-700", label: "Underpriced" },
  FAIR: { bg: "bg-blue-50", text: "text-blue-700", label: "Fair Price" },
  OVERPRICED: { bg: "bg-red-50", text: "text-red-700", label: "Overpriced" },
  UNKNOWN: { bg: "bg-gray-50", text: "text-gray-600", label: "Price Pending" },
};

const EVIDENCE_STYLES: Record<string, { bg: string; text: string }> = {
  STRONG: { bg: "bg-blue-100", text: "text-blue-700" },
  PARTIAL: { bg: "bg-gray-100", text: "text-gray-600" },
  MISSING: { bg: "bg-orange-100", text: "text-orange-700" },
};

const REASON_CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  routine_friction: { bg: "bg-blue-50", text: "text-blue-600", label: "Routine" },
  listing_risk: { bg: "bg-red-50", text: "text-red-600", label: "Risk" },
  missing_proof: { bg: "bg-orange-50", text: "text-orange-600", label: "Proof" },
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
}: ReceiptOutputCardProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [scoringTooltipOpen, setScoringTooltipOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fallbackFiredRef = useRef(false);

  const prevPhoto = useCallback(() =>
    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length),
    [photos.length]
  );
  const nextPhoto = useCallback(() =>
    setPhotoIndex((i) => (i + 1) % photos.length),
    [photos.length]
  );

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card-base overflow-hidden"
    >
      {/* Fallback banner */}
      {isFallback && (
        <div className={`${isSimilarityMatch ? "bg-blue-50 border-b border-blue-200" : "bg-amber-50 border-b border-amber-200"} px-5 py-3 flex items-center justify-between`}>
          <p className={`text-sm ${isSimilarityMatch ? "text-blue-800" : "text-amber-800"}`}>
            {isSimilarityMatch
              ? "Based on a similar vehicle — Tap Regenerate for vehicle-specific analysis."
              : "Quick receipt — analysis timed out. Tap Regenerate for a full analysis."}
          </p>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className={`text-sm font-medium underline whitespace-nowrap ml-3 ${isRegenerating ? "opacity-50 cursor-not-allowed" : ""} ${isSimilarityMatch ? "text-blue-700 hover:text-blue-900" : "text-amber-700 hover:text-amber-900"}`}
            >
              {isRegenerating ? "Generating..." : "Regenerate"}
            </button>
          )}
        </div>
      )}

      {/* Full analysis in progress — prominent banner with animated bar */}
      {isUpgrading && (
        <div className="bg-gray-900 border-b border-gray-800 px-5 py-3.5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-sm font-semibold text-white">
              Full analysis running — verdict loading
            </p>
          </div>
          <div className="h-1 w-full bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Initial signals shown below. Full verdict replaces this in ~15–30 seconds.
          </p>
        </div>
      )}

      {/* Upgrade failed - reassurance banner */}
      {upgradeFailed && !isUpgrading && (
        <div className="bg-green-50 border-b border-green-200 px-5 py-3">
          <p className="text-sm text-green-800">
            ✓ Your receipt is complete with {receipt.listing_signals?.length || 0}+ data points analyzed.
            All key risk factors and pricing insights are included.
          </p>
        </div>
      )}

      {/* Verdict banner — neutral/pending style while upgrading */}
      <div className={`${isUpgrading ? "bg-gray-50 border-gray-200" : `${verdict.bg} ${verdict.border}`} border-b px-5 py-4`}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overall Verdict</p>
        <div className="flex items-center gap-3">
          {isUpgrading
            ? <HelpCircle className="w-6 h-6 text-gray-400" />
            : <VerdictIcon className={`w-6 h-6 ${verdict.text}`} />
          }
          <div>
            <div className="flex items-center gap-2">
              {isUpgrading ? (
                <span className="text-lg font-bold text-gray-400">Analyzing…</span>
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
              {!isUpgrading && receipt.evidence_label && (
                <Badge variant={
                  receipt.evidence_label === "STRONG" ? "primary" :
                  receipt.evidence_label === "MISSING" ? "warning" : "neutral"
                }>
                  {receipt.evidence_label} Evidence
                </Badge>
              )}
            </div>
            {vehicleDesc && (
              <p className="text-sm text-gray-700 mt-0.5">
                {vehicleDesc}
                {priceStr && <span className="font-semibold"> · {priceStr}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Photo strip — hero + thumbnail row, only when photos available */}
        {photos.length > 0 && (
          <div className="mt-3 -mx-5 relative">
            {/* Hero image */}
            <div
              className="relative w-full aspect-[16/7] overflow-hidden cursor-pointer group"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={photos[photoIndex]}
                alt={vehicleDesc ? `${vehicleDesc} — listing photo ${photoIndex + 1} of ${photos.length}` : `Listing photo ${photoIndex + 1} of ${photos.length}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              {/* Gradient overlay so text below stays readable */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
              {/* Expand hint */}
              <div className="absolute top-2 right-2 bg-black/40 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Expand className="w-3.5 h-3.5 text-white" />
              </div>
              {/* Prev/next on hero */}
              {photos.length > 1 && (
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
                {photoIndex + 1} / {photos.length}
              </div>
            </div>

            {/* Thumbnail strip — only when 2+ photos */}
            {photos.length > 1 && (
              <div className="flex gap-1.5 px-5 pt-2 pb-0 overflow-x-auto scrollbar-hide">
                {photos.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                      i === photoIndex ? "border-blue-500 opacity-100" : "border-transparent opacity-60 hover:opacity-90"
                    }`}
                  >
                    <img src={url} alt={vehicleDesc ? `${vehicleDesc} — photo ${i + 1}` : `Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className={`text-sm mt-3 ${isUpgrading ? "text-gray-400 italic" : "text-gray-700"}`}>
          {isUpgrading ? "Verdict and full reasoning will appear when analysis completes." : receipt.verdict_reason}
        </p>
        {region === "UK" && (
          <p className="text-xs text-gray-500 mt-1.5">UK Mode (beta) — prices in pounds, UK wording</p>
        )}
        {typeof receipt.fit_score === "number" && typeof receipt.evidence_score === "number" && (
          <div className="flex gap-4 mt-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>Fit</span>
                <span>{receipt.fit_score}/100</span>
              </div>
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  receipt.fit_score >= 75 ? "bg-green-500" : receipt.fit_score >= 45 ? "bg-yellow-500" : "bg-red-500"
                }`} style={{ width: `${receipt.fit_score}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>Evidence</span>
                <span>{receipt.evidence_score}/100</span>
              </div>
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  receipt.evidence_score >= 75 ? "bg-blue-500" : receipt.evidence_score >= 45 ? "bg-gray-400" : "bg-orange-500"
                }`} style={{ width: `${receipt.evidence_score}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vehicle Facts Bar — title status, accidents, live NHTSA recalls, battery estimate */}
      <VehicleFactsBar receipt={receipt} />

      {/* Why not GREEN? — gated for yellow/red; unlocked users see full list */}
      {receipt.why_not_green && receipt.why_not_green.length > 0 && receipt.verdict !== "GREEN" && (
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-1.5 mb-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Why not GREEN?
            </p>
            <div className="relative">
              <button
                onClick={() => setScoringTooltipOpen((o) => !o)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="How scoring works"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {scoringTooltipOpen && (
                <div className="absolute left-0 top-5 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-gray-700 space-y-1.5">
                  <p className="font-semibold text-gray-900">How verdicts are scored</p>
                  <p><span className="font-medium text-green-700">GREEN</span> — low risk, strong evidence (price fair, history clean, no flags)</p>
                  <p><span className="font-medium text-yellow-700">YELLOW</span> — moderate risk or missing proof (high mileage, no service records, price unclear)</p>
                  <p><span className="font-medium text-red-700">RED</span> — hard flag present (salvage title, accident history, severely overpriced)</p>
                  <p className="text-gray-500 pt-1 border-t border-gray-100">Categories: <span className="text-red-600">Risk</span> = confirmed concern · <span className="text-orange-600">Proof</span> = missing evidence · <span className="text-blue-600">Routine</span> = standard friction</p>
                  <button onClick={() => setScoringTooltipOpen(false)} className="text-gray-400 hover:text-gray-600 mt-1">Close</button>
                </div>
              )}
            </div>
          </div>
          {isUnlocked || !paymentsEnabled ? (
            <ul className="space-y-1">
              {receipt.why_not_green.map((reason: { signal_id: string; category: string; points: number; label: string }, i: number) => {
                const catStyle = REASON_CATEGORY_STYLES[reason.category] || REASON_CATEGORY_STYLES.listing_risk;
                return (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${catStyle.bg} ${catStyle.text}`}>
                      {catStyle.label}
                    </span>
                    <span className="flex-1">{reason.label}</span>
                    {reason.points !== 0 && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">{reason.points}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>
              <ul className="space-y-1 mb-2">
                {/* First reason shown unblurred — gives real value, earns trust */}
                {receipt.why_not_green.slice(0, 1).map((reason: { signal_id: string; category: string; points: number; label: string }, i: number) => {
                  const catStyle = REASON_CATEGORY_STYLES[reason.category] || REASON_CATEGORY_STYLES.listing_risk;
                  return (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${catStyle.bg} ${catStyle.text}`}>
                        {catStyle.label}
                      </span>
                      <span className="flex-1">{reason.label}</span>
                    </li>
                  );
                })}
                {/* Remaining reasons blurred */}
                {receipt.why_not_green.slice(1).map((reason: { signal_id: string; category: string; points: number; label: string }, i: number) => {
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
              {receipt.why_not_green.length > 1 && (
                <button
                  onClick={onPaywallClick}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  +{receipt.why_not_green.length - 1} more reason{receipt.why_not_green.length - 1 !== 1 ? "s" : ""} — see full analysis
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prominent Copy Checklist — above the fold, always free */}
      <div className="px-5 pt-4">
        <button
          onClick={() =>
            copySection(
              receipt.must_answer_questions
                .map((q, i) => `${i + 1}. ${q}`)
                .join("\n"),
              "must-ask"
            )
          }
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${
            copiedSection === "must-ask"
              ? "bg-blue-100 text-blue-700 border border-blue-200"
              : "border-2 border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          {copiedSection === "must-ask" ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Checklist copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Pre-Visit Checklist ({receipt.must_answer_questions.length} questions)
            </>
          )}
        </button>
      </div>

      {/* Lint Fallback: Quick Checklist */}
      {!lintPassed && (
        <div className="mx-5 mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Quick Checklist
            </h3>
            <span className="text-xs text-gray-500">(Reddit copy pending lint fix)</span>
          </div>

          {/* Risk flags (up to 3) */}
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Flags</p>
            <ul className="space-y-1">
              {receipt.risk_flags.slice(0, 3).map((flag, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">!</span>
                  <span>{humanizeFlag(flag)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* First must-ask question */}
          {receipt.must_answer_questions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Ask the seller</p>
              <p className="text-sm text-gray-700">
                <span className="text-blue-500 font-bold">1.</span>{" "}
                {receipt.must_answer_questions[0]}
              </p>
            </div>
          )}

          {/* Copy Quick Checklist — works even when lint fails */}
          <button
            onClick={() => {
              const lines: string[] = [];
              lines.push(`Verdict: ${receipt.verdict}`);
              receipt.risk_flags.slice(0, 3).forEach((f) => lines.push(`! ${humanizeFlag(f)}`));
              if (receipt.must_answer_questions[0]) {
                lines.push(`Ask: ${receipt.must_answer_questions[0]}`);
              }
              copySection(lines.join("\n"), "quick_checklist");
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
              copiedSection === "quick_checklist"
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "border-2 border-blue-300 text-blue-700 hover:bg-blue-100"
            }`}
          >
            {copiedSection === "quick_checklist" ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Quick Checklist
              </>
            )}
          </button>
        </div>
      )}

      {/* What would change the verdict */}
      {receipt.operator_notes?.what_would_change_verdict &&
        receipt.operator_notes.what_would_change_verdict.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              This becomes a different verdict if:
            </p>
            <ul className="space-y-1">
              {receipt.operator_notes.what_would_change_verdict.map(
                (item: string, i: number) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 flex items-start gap-2"
                  >
                    <span className="text-gray-400 mt-0.5">→</span>
                    <span>{item}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

      <div className="p-5 space-y-5">
        {/* Price Sanity */}
        {receipt.price_sanity && (
          <div className={`${price.bg} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className={`w-4 h-4 ${price.text}`} />
              <span className={`text-sm font-semibold ${price.text}`}>
                {price.label}
              </span>
              {receipt.price_sanity.confidence > 0 && (
                <span className="text-xs text-gray-500">
                  ({Math.round(receipt.price_sanity.confidence * 100)}% confidence)
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">
              {receipt.price_sanity.rationale_short}
            </p>
            {/* Market price range — from Auto.dev enrichment via listing_summary passthrough */}
            {(() => {
              const mpr = (receipt.listing_summary as Record<string, unknown>)?.market_price_range as { low: number; high: number; count: number } | undefined;
              if (!mpr || mpr.count === 0) return null;
              return (
                <p className="text-xs text-gray-500 mt-1.5">
                  Market range: <span className="font-semibold text-gray-700">{formatPrice(mpr.low, region)} – {formatPrice(mpr.high, region)}</span>
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
            <div className="flex items-start gap-2 text-xs text-gray-600 -mt-1">
              {sellerType === "dealer"
                ? <Store className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                : <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
              <span>
                {sellerLabel && <span className="font-medium text-gray-700">{sellerLabel}</span>}
                {zip && <span className="text-gray-400 ml-1">· {zip}</span>}
                {negotiationNote && <span className="text-gray-500 ml-1">— {negotiationNote}</span>}
              </span>
            </div>
          );
        })()}

        {/* Deal Watch (formerly Risk Flags) — first 1 free, rest locked */}
        {receipt.risk_flags.length > 0 && (() => {
          const isGreen = receipt.verdict === "GREEN";
          const showAll = isGreen || isUnlocked || !paymentsEnabled;
          const visibleFlags = showAll ? receipt.risk_flags : receipt.risk_flags.slice(0, 1);
          const lockedCount = showAll ? 0 : receipt.risk_flags.length - 1;

          return (
            <Section
              icon={isGreen
                ? <Search className="w-4 h-4 text-amber-500" />
                : <AlertTriangle className="w-4 h-4 text-red-500" />}
              title="Deal Watch"
            >
              {!isGreen && (
                <p className="text-xs text-gray-500 mb-2">
                  Pricing can be fair but other factors can still affect your overall verdict — watch these:
                </p>
              )}
              <ul className="space-y-2">
                {visibleFlags.map((flag, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    {isGreen
                      ? <span className="text-amber-400 font-bold mt-0.5">{i + 1}.</span>
                      : <span className="text-red-400 mt-0.5">!</span>}
                    <span>{humanizeFlag(flag)}</span>
                  </li>
                ))}
                {lockedCount > 0 && (
                  <>
                    {receipt.risk_flags.slice(1).map((flag, i) => {
                      const preview = humanizeFlag(flag);
                      const truncated = preview.length > 40 ? preview.slice(0, 40) + "…" : preview;
                      return (
                        <li key={`locked-flag-${i}`} className="text-sm flex items-start gap-2 select-none">
                          <span className="text-red-300 mt-0.5">!</span>
                          <span className="text-gray-400 blur-[3px]">{truncated}</span>
                        </li>
                      );
                    })}
                    <li>
                      <button
                        onClick={onPaywallClick}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors mt-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        See all {receipt.risk_flags.length} deal watch items
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </Section>
          );
        })()}

        {/* Must Answer Questions */}
        {(() => {
          const questions = receipt.must_answer_questions;
          const showAll = sellerPackUnlocked !== false || questions.length <= 2;
          const visibleQuestions = showAll ? questions : questions.slice(0, 2);
          const lockedCount = showAll ? 0 : questions.length - 2;

          return (
            <Section
              icon={<HelpCircle className="w-4 h-4 text-blue-500" />}
              title="Must-Ask Questions"
              onCopy={showAll ? () =>
                copySection(
                  questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
                  "must-ask"
                ) : undefined
              }
              copied={copiedSection === "must-ask"}
            >
              <ul className="space-y-2">
                {visibleQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
                {lockedCount > 0 && (
                  <>
                    {questions.slice(2).map((q, i) => {
                      const preview = q.length > 50 ? q.slice(0, 50) + "…" : q;
                      return (
                        <li key={`locked-${i}`} className="text-sm flex items-start gap-2 select-none">
                          <span className="text-gray-300 font-bold mt-0.5">{i + 3}.</span>
                          <span className="text-gray-400 blur-[3px]">{preview}</span>
                        </li>
                      );
                    })}
                    <li>
                      <button
                        onClick={onSellerPackUpgrade}
                        className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors mt-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        See all {questions.length} questions
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </Section>
          );
        })()}

        {/* Verify Before Visit — first 2 free, rest locked */}
        {(() => {
          const vbvItems = receipt.verify_before_visit || [];
          if (vbvItems.length === 0) return null;
          const showAllVbv = sellerPackUnlocked !== false || vbvItems.length <= 2;
          const visibleVbv = showAllVbv ? vbvItems : vbvItems.slice(0, 2);
          const lockedVbvCount = showAllVbv ? 0 : vbvItems.length - 2;
          return (
            <Section
              icon={<FileSearch className="w-4 h-4 text-purple-500" />}
              title="Verify Before Visit"
            >
              <ul className="space-y-2">
                {visibleVbv.map((item: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-purple-400 font-bold mt-0.5">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
                {lockedVbvCount > 0 && (
                  <>
                    {vbvItems.slice(2).map((item: string, i: number) => {
                      const preview = item.length > 50 ? item.slice(0, 50) + "…" : item;
                      return (
                        <li key={`locked-vbv-${i}`} className="text-sm flex items-start gap-2 select-none">
                          <span className="text-gray-300 font-bold mt-0.5">{i + 3}.</span>
                          <span className="text-gray-400 blur-[3px]">{preview}</span>
                        </li>
                      );
                    })}
                    <li>
                      <button
                        onClick={onSellerPackUpgrade}
                        className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors mt-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        See all {vbvItems.length} items
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </Section>
          );
        })()}


        {/* Lint errors — itemized list + auto-fix */}
        {!lintPassed && lintErrors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">
                {lintErrors.length} lint issue{lintErrors.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="space-y-1">
              {lintErrors.map((err, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">·</span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
            {onAutoFix && (
              <button
                onClick={onAutoFix}
                disabled={isFixing}
                className="mt-3 w-full py-2 text-sm font-medium rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-all disabled:opacity-50"
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
            className="w-full py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegenerating ? "Generating fresh analysis..." : "Regenerate analysis"}
          </button>
        </div>
      )}

      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && photos.length > 0 && (
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
                src={photos[photoIndex]}
                alt={vehicleDesc ? `${vehicleDesc} — photo ${photoIndex + 1} of ${photos.length}` : `Listing photo ${photoIndex + 1} of ${photos.length}`}
                className="w-full max-h-[75vh] object-contain rounded-xl"
              />
              {photos.length > 1 && (
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
                {photoIndex + 1} of {photos.length} · Click outside to close
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
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {onCopy && (
          <button
            onClick={onCopy}
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
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
