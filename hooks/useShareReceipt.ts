/**
 * useShareReceipt
 *
 * Owns share modal state and handleShareClick. Extracted from receipt/page.tsx.
 */

import { useState, useCallback } from "react";
import type { ListingReceipt } from "@/types/receipt";

export type TrackEventFn = (event: string, props?: { [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | unknown[] }) => void | Promise<void>;

export function useShareReceipt({
  receipt,
  receiptToken,
  trackEvent,
}: {
  receipt: ListingReceipt | null;
  receiptToken: string;
  trackEvent: TrackEventFn;
}) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareSlug, setShareSlug] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const handleShareClick = useCallback(async () => {
    if (!receipt?.receipt_id || !receiptToken || isSharing) return;
    setIsSharing(true);
    trackEvent("share_qr_clicked", { receipt_id: receipt.receipt_id });

    try {
      const res = await fetch("/api/share/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receipt.receipt_id,
          receipt_token: receiptToken,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setShareUrl(data.share_url);
        setShareSlug(data.share_slug);
        setShowShareModal(true);
      }
    } catch {
      // Silently fail — share is non-critical
    } finally {
      setIsSharing(false);
    }
  }, [receipt, receiptToken, isSharing, trackEvent]);

  return {
    showShareModal,
    setShowShareModal,
    shareUrl,
    shareSlug,
    isSharing,
    handleShareClick,
  };
}
