"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Copy, Download, Check, Loader2, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { generateShareCard } from "@/lib/share-card-renderer";
import { humanizeFlag } from "@/lib/receipt-rules";
import { buildTweetText } from "@/lib/tweet-share";
import type { ListingReceipt } from "@/types/receipt";

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.26 5.632 5.905-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  shareSlug: string;
  receiptId: string;
  receipt: ListingReceipt;
  userId?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  shareUrl,
  shareSlug,
  receiptId,
  receipt,
  userId,
}: ShareModalProps) {
  const { trackEvent } = useEventTracking();
  const [copied, setCopied] = useState(false);
  const [redditCopied, setRedditCopied] = useState(false);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const refSuffix = userId ? `&ref=${encodeURIComponent(userId)}` : "";
  const fullUrl = typeof window !== "undefined"
    ? `${window.location.origin}${shareUrl}?utm_source=offo_share&utm_medium=qr&utm_campaign=receipt_share${refSuffix}`
    : shareUrl;

  // Track modal open
  useEffect(() => {
    if (isOpen) {
      trackEvent("share_modal_opened", { share_slug: shareSlug, receipt_id: receiptId });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate branded card when modal opens
  useEffect(() => {
    if (!isOpen) {
      setCardDataUrl(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeneratingCard(true);
      try {
        const qrCanvas = qrRef.current?.querySelector("canvas");
        if (!qrCanvas) return;

        // Create offscreen canvas (landscape for social sharing)
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 900;

        // Derive short verdict tagline from first risk flag
        const firstFlag = humanizeFlag(receipt.risk_flags?.[0] || "");
        const verdictShort = firstFlag.length > 35
          ? firstFlag.slice(0, 32) + "..."
          : firstFlag || receipt.verdict_reason.slice(0, 35);

        generateShareCard(canvas, {
          verdict: receipt.verdict as "GREEN" | "YELLOW" | "RED",
          verdictReason: receipt.verdict_reason,
          verdictShort,
          riskFlags: (receipt.risk_flags || []).slice(0, 3).map(humanizeFlag),
          year: receipt.listing_summary?.year ?? null,
          make: receipt.listing_summary?.make ?? null,
          model: receipt.listing_summary?.model ?? null,
          price: receipt.listing_summary?.price ?? null,
          mileage: receipt.listing_summary?.mileage ?? null,
          shareSlug,
        }, qrCanvas as HTMLCanvasElement);

        setCardDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("[ShareCard] Generation failed:", err);
      } finally {
        setIsGeneratingCard(false);
      }
    }, 150); // delay for QRCodeCanvas to finish rendering

    return () => clearTimeout(timer);
  }, [isOpen, receipt, shareSlug]);  

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      trackEvent("share_link_copied", { share_slug: shareSlug, receipt_id: receiptId });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = fullUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [fullUrl, shareSlug, receiptId, trackEvent]);

  const handleDownloadCard = useCallback(() => {
    if (!cardDataUrl) return;

    const a = document.createElement("a");
    a.href = cardDataUrl;
    a.download = `offo-verdict-${shareSlug}.png`;
    a.click();

    trackEvent("share_card_downloaded", { share_slug: shareSlug, receipt_id: receiptId });
  }, [cardDataUrl, shareSlug, receiptId, trackEvent]);

  const handleTweetShare = useCallback(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://offolab.com";
    const text = buildTweetText(receipt, shareSlug, baseUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    trackEvent("share_tweet_clicked", { share_slug: shareSlug, receipt_id: receiptId, verdict: receipt.verdict });
  }, [receipt, shareSlug, receiptId, trackEvent]);

  const handleRedditShare = useCallback(async () => {
    const verdictEmoji = receipt.verdict === "GREEN" ? "🟢" : receipt.verdict === "RED" ? "🔴" : "🟡";
    const vehicle = [receipt.listing_summary?.year, receipt.listing_summary?.make, receipt.listing_summary?.model]
      .filter(Boolean).join(" ");
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://offolab.com";
    const redditText = `Checked a ${vehicle || "used EV"} on OFFO — ${verdictEmoji} ${receipt.verdict_reason}\n\n${baseUrl}${shareUrl}?utm_source=reddit&utm_medium=share&utm_campaign=receipt_share`;
    try {
      await navigator.clipboard.writeText(redditText);
      setRedditCopied(true);
      trackEvent("share_reddit_copied", { share_slug: shareSlug, receipt_id: receiptId, verdict: receipt.verdict });
      setTimeout(() => setRedditCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  }, [receipt, shareSlug, shareUrl, receiptId, trackEvent]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Share Receipt</h3>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Hidden QR source — offscreen, not display:none */}
              <div ref={qrRef} className="absolute -left-[9999px]">
                <QRCodeCanvas
                  value={fullUrl}
                  size={330}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Card preview */}
              <div className="flex justify-center mb-4">
                {isGeneratingCard ? (
                  <div className="w-full aspect-[4/3] bg-gray-50 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : cardDataUrl ? (
                  <img
                    src={cardDataUrl}
                    alt="OFFO Result Card"
                    className="w-full rounded-xl shadow-sm border border-gray-100"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] bg-gray-50 rounded-xl flex items-center justify-center text-sm text-gray-400">
                    Generating card...
                  </div>
                )}
              </div>

              {/* Action buttons — row 1: primary actions */}
              <div className="flex gap-2 mb-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadCard}
                  disabled={!cardDataUrl}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                  Card
                </button>

                <button
                  onClick={handleTweetShare}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-black text-white hover:bg-gray-900 transition-colors"
                >
                  <XIcon />
                  Post
                </button>
              </div>

              {/* Action buttons — row 2: Reddit */}
              <button
                onClick={handleRedditShare}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-[#FF4500] text-white hover:bg-[#e03d00] transition-colors"
              >
                {redditCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied for Reddit!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Copy for Reddit
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
