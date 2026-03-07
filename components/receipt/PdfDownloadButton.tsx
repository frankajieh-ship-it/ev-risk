/**
 * PdfDownloadButton — PDF download for receipt (free for all users)
 */

"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface PdfDownloadButtonProps {
  receiptId: string;
  receiptToken: string;
  isUnlocked?: boolean;
  onCheckoutRedirect?: () => void;
  compact?: boolean;
}

export default function PdfDownloadButton({
  receiptId,
  receiptToken,
  compact = false,
}: PdfDownloadButtonProps) {
  const { trackEvent } = useEventTracking();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleClick = () => {
    trackEvent("download_pdf_clicked", {
      receipt_id: receiptId,
    });

    setIsDownloading(true);
    window.open(
      `/api/receipt/${receiptId}/pdf?anon_id=${encodeURIComponent(receiptToken)}`,
      "_blank"
    );
    setTimeout(() => setIsDownloading(false), 3000);
  };

  const baseCompact = "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all";
  const baseFull = "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all";

  const base = compact ? baseCompact : baseFull;
  const className = isDownloading
    ? `${base} bg-blue-50 text-blue-400 border border-blue-200 cursor-wait`
    : `${base} ${compact ? "border" : "border-2"} border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300`;

  return (
    <button
      onClick={handleClick}
      disabled={isDownloading}
      className={className}
    >
      {isDownloading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {!compact && "Preparing PDF..."}
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4" />
          {compact ? "PDF" : "Download PDF"}
        </>
      )}
    </button>
  );
}
