/**
 * PdfDownloadButton — PDF download for receipt, gated by purchase status
 */

"use client";

import { useState } from "react";
import { FileDown, Lock, Loader2 } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface PdfDownloadButtonProps {
  receiptId: string;
  receiptToken: string;
  isUnlocked: boolean;
  onCheckoutRedirect?: () => void;
}

export default function PdfDownloadButton({
  receiptId,
  receiptToken,
  isUnlocked,
  onCheckoutRedirect,
}: PdfDownloadButtonProps) {
  const { trackEvent } = useEventTracking();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleClick = () => {
    trackEvent("download_pdf_clicked", {
      receipt_id: receiptId,
      is_unlocked: isUnlocked,
    });

    if (isUnlocked) {
      setIsDownloading(true);
      window.open(
        `/api/receipt/${receiptId}/pdf?anon_id=${encodeURIComponent(receiptToken)}`,
        "_blank"
      );
      // Reset after a short delay (download starts in new tab)
      setTimeout(() => setIsDownloading(false), 3000);
    } else {
      onCheckoutRedirect?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDownloading}
      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
        isUnlocked
          ? isDownloading
            ? "bg-blue-50 text-blue-400 border border-blue-200 cursor-wait"
            : "border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
          : "border-2 border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {isDownloading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Preparing PDF...
        </>
      ) : isUnlocked ? (
        <>
          <FileDown className="w-4 h-4" />
          Download PDF
        </>
      ) : (
        <>
          <Lock className="w-4 h-4" />
          Unlock to Download PDF
        </>
      )}
    </button>
  );
}
