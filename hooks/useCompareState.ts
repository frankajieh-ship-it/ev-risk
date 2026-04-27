/**
 * useCompareState
 *
 * Owns compare receipt state and auto-loads a bound comparison when
 * compareBoundTo is set. Extracted from receipt/page.tsx.
 */

import { useState, useEffect } from "react";
import type { ListingReceipt } from "@/types/receipt";

interface HistoryEntry {
  receipt_id: string;
  receipt: ListingReceipt;
}

export function useCompareState({
  compareBoundTo,
  receiptId,
  receiptToken,
  history,
}: {
  compareBoundTo: string | null | undefined;
  receiptId: string | null | undefined;
  receiptToken: string;
  history: HistoryEntry[];
}) {
  const [compareReceipt, setCompareReceipt] = useState<ListingReceipt | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showCompareView, setShowCompareView] = useState(false);
  const [showCompareLoginModal, setShowCompareLoginModal] = useState(false);

  // Auto-load bound comparison when compareBoundTo is set
  useEffect(() => {
    if (!compareBoundTo || compareReceipt) return;

    // Try localStorage first
    const fromHistory = history.find((e) => e.receipt_id === compareBoundTo);
    if (fromHistory) {
      setCompareReceipt(fromHistory.receipt); // eslint-disable-line react-hooks/set-state-in-effect
      setShowCompareView(true);  
      return;
    }

    // Server fallback
    if (!receiptId || !receiptToken) return;
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({ anon_id: receiptToken });
        const res = await fetch(`/api/receipt/${receiptId}/compare?${params}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data.compare_receipt) {
          setCompareReceipt(data.compare_receipt);
          setShowCompareView(true);
        }
      } catch {
        // Silently fail — compare view just won't show
      }
    })();

    return () => { cancelled = true; };
  }, [compareBoundTo, receiptId, receiptToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    compareReceipt,
    setCompareReceipt,
    showCompareModal,
    setShowCompareModal,
    showCompareView,
    setShowCompareView,
    showCompareLoginModal,
    setShowCompareLoginModal,
  };
}
