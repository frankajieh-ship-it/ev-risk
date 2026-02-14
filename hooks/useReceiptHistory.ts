/**
 * OFFO Receipt History — Merged Server + localStorage Hook
 *
 * Fetches receipt history from the server on mount, merges with
 * localStorage entries, and syncs the merged result back to localStorage
 * for instant display on future page loads.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getReceiptHistory,
  addToReceiptHistory,
  clearReceiptHistory,
} from "@/lib/receipt-history";
import type { ListingReceipt, ReceiptHistoryEntry } from "@/types/receipt";

export interface UseReceiptHistoryReturn {
  history: ReceiptHistoryEntry[];
  isLoading: boolean;
  addReceipt: (receipt: ListingReceipt) => void;
  clearHistory: () => void;
  refetch: () => Promise<void>;
}

/**
 * Merge server + localStorage entries.
 * Server entries win on receipt_id conflict (they have DB timestamps).
 * Result is sorted by created_at descending.
 */
function mergeHistories(
  serverEntries: ReceiptHistoryEntry[],
  localEntries: ReceiptHistoryEntry[]
): ReceiptHistoryEntry[] {
  const map = new Map<string, ReceiptHistoryEntry>();

  // Local first so server overwrites on conflict
  for (const entry of localEntries) {
    map.set(entry.receipt_id, entry);
  }
  for (const entry of serverEntries) {
    map.set(entry.receipt_id, entry);
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function useReceiptHistory(
  receiptToken: string
): UseReceiptHistoryReturn {
  const [history, setHistory] = useState<ReceiptHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchingRef = useRef(false);

  // Hydrate from localStorage on mount (client-only, avoids SSR mismatch)
  useEffect(() => {
    setHistory(getReceiptHistory());
  }, []);

  const fetchAndMerge = useCallback(async () => {
    if (!receiptToken || receiptToken.length < 5) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ anon_id: receiptToken });
      const res = await fetch(`/api/receipt/history?${params}`);

      if (!res.ok) return;

      const data = await res.json();
      const serverEntries: ReceiptHistoryEntry[] = data.entries || [];
      const localEntries = getReceiptHistory();

      const merged = mergeHistories(serverEntries, localEntries);

      // Sync merged result back to localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "offo_receipt_history",
            JSON.stringify(merged.slice(0, 10))
          );
        } catch {
          // localStorage might be full
        }
      }

      setHistory(merged);
    } catch {
      // Network error — keep localStorage entries
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [receiptToken]);

  useEffect(() => {
    fetchAndMerge();
  }, [fetchAndMerge]);

  const addReceipt = useCallback(
    (receipt: ListingReceipt) => {
      addToReceiptHistory(receipt);

      const entry: ReceiptHistoryEntry = {
        receipt_id: receipt.receipt_id,
        created_at: new Date().toISOString(),
        verdict: receipt.verdict,
        year: receipt.listing_summary?.year || null,
        make: receipt.listing_summary?.make || null,
        model: receipt.listing_summary?.model || null,
        price: receipt.listing_summary?.price || null,
        receipt,
      };

      setHistory((prev) => {
        if (prev.some((e) => e.receipt_id === receipt.receipt_id)) return prev;
        return [entry, ...prev];
      });
    },
    []
  );

  const clearHistoryFn = useCallback(() => {
    clearReceiptHistory();
    setHistory([]);
  }, []);

  return {
    history,
    isLoading,
    addReceipt,
    clearHistory: clearHistoryFn,
    refetch: fetchAndMerge,
  };
}
