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
import { REQUIRED_ANGLES } from "@/lib/photo-due-diligence-types";

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
  isStarterUnlocked?: boolean;
  paymentsEnabled?: boolean;
  onPaywallClick?: () => void;
  onStarterClick?: () => void;
  onFullUpgradeClick?: () => void;
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
  onPhotosFailed?: () => void;
  onAddPhotos?: (dataUrls: string[]) => void;
  serverRecalls?: import("@/lib/nhtsa-recalls").RecallResult | null;
  vinHistory?: import("@/lib/vinaudit-client").VinAuditLiteResult | null;
  emailUnlocked?: boolean;
  emailCaptured?: boolean;
  onEmailGateOpen?: () => void;
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
  isStarterUnlocked = false,
  paymentsEnabled = false,
  onPaywallClick,
  onStarterClick,
  onFullUpgradeClick,
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
  onPhotosFailed,
  onAddPhotos,
  serverRecalls,
  vinHistory,
  emailUnlocked = false,
  emailCaptured = false,
  onEmailGateOpen,
}: ReceiptOutputCardProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [scoringTooltipOpen, setScoringTooltipOpen] = useState(false);
  const [whyNotGreenOpen, setWhyNotGreenOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fallbackFiredRef = useRef(false);
  const photoFailedRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    // Dedup by name+size before reading — catches the same file dropped multiple times
    const seen = new Set<string>();
    const unique = imageFiles.filter(f => {
      const key = `${f.name}:${f.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const readers = unique.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(dataUrls => { onAddPhotos?.(dataUrls); });
  }, [onAddPhotos]);

  const handleUploadPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }, [processFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
      return;
    }
    // No File objects — user dragged an image element from another tab.
    // Browsers deliver dragged images as URI lists, not Files.
    const uriList = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (uriList) {
      const existing = new Set(photos); // dedup against current photo list
      const urls = uriList.split(/\r?\n/).map(u => u.trim()).filter(u => {
        if (!u.startsWith("http")) return false;
        if (existing.has(u)) return false; // already in strip
        const lower = u.toLowerCase();
        // Reject dealer logos, banners, watermarks, and other non-car images
        return !lower.includes("logo") && !lower.includes("banner") && !lower.includes("dealer") &&
               !lower.includes("badge") && !lower.includes("icon") && !lower.includes("/site/") &&
               !lower.includes("watermark") && !lower.includes("overlay");
      });
      if (urls.length > 0) onAddPhotos?.(urls);
    }
  }, [processFiles, onAddPhotos, photos]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // Normalize AI-returned array field — AI can return why_not_green as non-array
  const whyNotGreen = Array.isArray(receipt.why_not_green) ? receipt.why_not_green : [];

  const userUploaded = useMemo(() => photos.filter(u => u.startsWith("data:")), [photos]);
  const photoSrcs = useMemo(() => {
    const scraped = photos.filter(u => !u.startsWith("data:")).slice(0, 20);
    return [...scraped, ...userUploaded];
  }, [photos, userUploaded]);

  // Reset failed flag when a new photo set arrives
  useEffect(() => {
    photoFailedRef.current = false;
  }, [photos]);

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
    // data: URLs are already in-memory — no proxy needed
    if (url.startsWith("data:")) return url;
    // Already routed through our proxy — don't double-wrap
    if (url.startsWith("/api/img")) return url;
    // Use canonical non-www domain to avoid the www→offolab.com 301 redirect.
    const base = typeof window !== "undefined" && window.location.hostname === "www.offolab.com"
      ? "https://offolab.com"
      : "";
    return `${base}/api/img?url=${encodeURIComponent(url)}`;
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
  const verdictLocked = paymentsEnabled && !isStarterUnlocked;
  const verdictEmailLocked = verdictLocked && !emailCaptured;

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
      <div className={`${(isUpgrading || verdictLocked) ? "bg-[#161b22] border-white/[0.08]" : `${verdict.bg} ${verdict.border}`} border-b px-5 py-4`}>
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
          {verdictEmailLocked ? (
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-white/30 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white/20 blur-[6px] select-none">GREEN</span>
                    <span className="text-sm text-white/20 blur-[6px] select-none">— Good Deal</span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">Enter your email to reveal your verdict</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onEmailGateOpen}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970] transition-colors shrink-0"
                >
                  Reveal verdict — free
                </button>
                <span className="text-white/20 text-xs">no payment required</span>
              </div>
            </div>
          ) : verdictLocked ? (
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-white/30 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white/20 blur-[6px] select-none">GREEN</span>
                    <span className="text-sm text-white/20 blur-[6px] select-none">— Good Deal</span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">Unlock to reveal your verdict</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onStarterClick ?? onPaywallClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970] transition-colors shrink-0"
                >
                  Starter — $3.99
                </button>
                <span className="text-white/20 text-xs">verdict · summary · photos</span>
                <span className="text-white/15 text-xs mx-1">·</span>
                <button
                  onClick={onFullUpgradeClick ?? onPaywallClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white/80 transition-colors shrink-0"
                >
                  Everything — $9.99
                </button>
                <span className="text-white/20 text-xs">+ history · deep dive</span>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Photo strip — empty state CTA when no photos, otherwise hero + thumbnails */}
        {photoSrcs.length === 0 ? (
          <div
            className={`mt-3 border border-dashed rounded-xl overflow-hidden transition-colors ${
              dragOver ? "border-[#00d97e]/50 bg-[#00d97e]/[0.04]" : "border-white/15"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Selling point header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.07]">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  dragOver ? "bg-[#00d97e]/20" : "bg-[#00d97e]/[0.10]"
                }`}>
                  <svg className="w-4 h-4 text-[#00d97e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Add listing photos for AI analysis</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    Open the listing in another tab, right-click each photo → Copy Image, then drag or paste them here. OFFO will scan for damage and missing angles.
                  </p>
                  <p className="text-xs text-white/35 mt-2">
                    Or{" "}
                    <button
                      onClick={() => uploadInputRef.current?.click()}
                      className="text-[#00d97e]/80 hover:text-[#00d97e] underline underline-offset-2 transition-colors"
                    >
                      click to upload photos from your device
                    </button>
                  </p>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="mt-3 -mx-5 relative">
            {/* Hero image — also a drop target for drag-and-drop photo uploads */}
            <div
              className={`relative w-full aspect-[16/7] overflow-hidden cursor-pointer group transition-all ${dragOver ? "ring-2 ring-[#00d97e] ring-inset brightness-75" : ""}`}
              onClick={() => setLightboxOpen(true)}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <img
                src={resolveImgSrc(photoSrcs[photoIndex])}
                alt={vehicleDesc ? `${vehicleDesc} — listing photo ${photoIndex + 1} of ${photoSrcs.length}` : `Listing photo ${photoIndex + 1} of ${photoSrcs.length}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  if (!photoFailedRef.current) {
                    photoFailedRef.current = true;
                    onPhotosFailed?.();
                  }
                }}
              />
              {/* Gradient overlay so text below stays readable */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
              {/* Drag-over hint */}
              {dragOver && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/70 rounded-xl px-4 py-2 text-white text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#00d97e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Drop to add photo
                  </div>
                </div>
              )}
              {/* Top-right: add photos button + expand icon */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); uploadInputRef.current?.click(); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/70 transition-colors text-[11px] font-medium"
                  title="Click or drag photos from the listing"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {userUploaded.length > 0 ? `+${userUploaded.length} added` : "Add photo from listing"}
                </button>
                <div className="bg-black/40 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Expand className="w-3.5 h-3.5 text-white" />
                </div>
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

            {/* Drag-and-drop invite — prominent CTA below thumbnail strip */}
            <div
              className={`mx-5 mt-2 mb-0.5 rounded-xl border px-4 py-3 cursor-default select-none transition-all ${
                dragOver
                  ? "border-[#00d97e]/60 bg-[#00d97e]/[0.06] text-[#00d97e]"
                  : "border-[#00d97e]/25 bg-[#00d97e]/[0.03] text-white/60"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="flex items-center gap-2.5 mb-1">
                <svg className={`w-3.5 h-3.5 flex-shrink-0 ${dragOver ? "text-[#00d97e]" : "text-[#00d97e]/60"}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-semibold">
                  Add more listing photos for better coverage
                </span>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed pl-6">
                Open the listing in another tab, right-click each photo → Copy Image, then drag them here. OFFO scans for damage and missing angles.{" "}
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="text-[#00d97e]/70 hover:text-[#00d97e] underline underline-offset-2 transition-colors"
                >
                  Or click to upload
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Hidden file input — always in DOM so clicks work from both empty state and photo strip */}
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUploadPhotos}
        />

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
      {receiptId && (
        <PhotoDueDiligenceCard
          receiptId={receiptId}
          photoUrls={photoSrcs}
          onHighlightPhoto={(index) => { setPhotoIndex(index); }}
          isUnlocked={isUnlocked}
          isStarterUnlocked={isStarterUnlocked}
          paymentsEnabled={paymentsEnabled}
          onPaywallClick={onPaywallClick}
        />
      )}

      {/* Vehicle Facts Bar — title status, accidents, live NHTSA recalls, battery estimate */}
      <VehicleFactsBar receipt={receipt} isUnlocked={isUnlocked} paymentsEnabled={paymentsEnabled} onPaywallClick={onPaywallClick} serverRecalls={serverRecalls} vinHistory={vinHistory} />

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
