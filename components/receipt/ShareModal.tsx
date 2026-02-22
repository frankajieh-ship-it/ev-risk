"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Copy, Download, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { generateShareCard } from "@/lib/share-card-renderer";
import type { ListingReceipt } from "@/types/receipt";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  shareSlug: string;
  receiptId: string;
  receipt: ListingReceipt;
}

export default function ShareModal({
  isOpen,
  onClose,
  shareUrl,
  shareSlug,
  receiptId,
  receipt,
}: ShareModalProps) {
  const { trackEvent } = useEventTracking();
  const [copied, setCopied] = useState(false);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const fullUrl = typeof window !== "undefined"
    ? `${window.location.origin}${shareUrl}?utm_source=offo_share&utm_medium=qr&utm_campaign=receipt_share`
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

        // Load OFFO logo
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject(new Error("Logo load failed"));
          logoImg.src = "/offo-lab-logo.png";
        });

        // Create offscreen canvas
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1080;

        generateShareCard(canvas, {
          verdict: receipt.verdict as "GREEN" | "YELLOW" | "RED",
          verdictReason: receipt.verdict_reason,
          riskFlags: (receipt.risk_flags || []).slice(0, 3),
          year: receipt.listing_summary?.year ?? null,
          make: receipt.listing_summary?.make ?? null,
          model: receipt.listing_summary?.model ?? null,
          price: receipt.listing_summary?.price ?? null,
          mileage: receipt.listing_summary?.mileage ?? null,
          shareSlug,
        }, qrCanvas as HTMLCanvasElement, logoImg);

        setCardDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("[ShareCard] Generation failed:", err);
      } finally {
        setIsGeneratingCard(false);
      }
    }, 150); // delay for QRCodeCanvas to finish rendering

    return () => clearTimeout(timer);
  }, [isOpen, receipt, shareSlug]); // eslint-disable-line react-hooks/exhaustive-deps

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
                  size={360}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Card preview */}
              <div className="flex justify-center mb-4">
                {isGeneratingCard ? (
                  <div className="w-full aspect-square bg-gray-50 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : cardDataUrl ? (
                  <img
                    src={cardDataUrl}
                    alt="OFFO Result Card"
                    className="w-full rounded-xl shadow-sm border border-gray-100"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-50 rounded-xl flex items-center justify-center text-sm text-gray-400">
                    Generating card...
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
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
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
