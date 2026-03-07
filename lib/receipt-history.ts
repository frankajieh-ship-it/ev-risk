/**
 * Receipt History — localStorage persistence
 *
 * Stores the last 10 receipts for quick re-display.
 * Client-side only.
 */

import type { ListingReceipt, ReceiptHistoryEntry } from "@/types/receipt";

const RECEIPT_HISTORY_KEY = "offo_receipt_history";
const MAX_HISTORY = 10;

export function getReceiptHistory(): ReceiptHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(RECEIPT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function addToReceiptHistory(receipt: ListingReceipt): void {
  if (typeof window === "undefined") return;

  try {
    const history = getReceiptHistory();

    // Don't add duplicate receipt_ids
    if (history.some((e) => e.receipt_id === receipt.receipt_id)) return;

    const entry: ReceiptHistoryEntry = {
      receipt_id: receipt.receipt_id,
      created_at: new Date().toISOString(),
      verdict: receipt.verdict,
      evidence_label: receipt.evidence_label,
      fit_score: receipt.fit_score,
      year: receipt.listing_summary?.year || null,
      make: receipt.listing_summary?.make || null,
      model: receipt.listing_summary?.model || null,
      price: receipt.listing_summary?.price || null,
      receipt,
    };

    // Prepend and limit
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(RECEIPT_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage might be full
  }
}

export function deleteReceiptFromHistory(receiptId: string): void {
  if (typeof window === "undefined") return;

  try {
    const history = getReceiptHistory();
    const updated = history.filter((e) => e.receipt_id !== receiptId);
    localStorage.setItem(RECEIPT_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage error
  }
}

export function clearReceiptHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RECEIPT_HISTORY_KEY);
}
