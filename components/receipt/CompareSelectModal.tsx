/**
 * CompareSelectModal — Receipt selection drawer for comparison
 *
 * Two modes:
 * 1. Free compare (no purchaseId): select receipt → compare immediately
 * 2. Paid compare (with purchaseId): select receipt → confirm credit use → bind
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  GitCompare,
  AlertTriangle,
  Shield,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { ReceiptHistoryEntry, Verdict } from "@/types/receipt";
import type { ListingReceipt } from "@/types/receipt";

interface CompareSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: ReceiptHistoryEntry[];
  currentReceiptId: string;
  purchaseId?: string;
  onCompareComplete: (compareReceipt: ListingReceipt) => void;
}

const VERDICT_BADGE: Record<
  Verdict,
  { bg: string; text: string; icon: typeof Shield }
> = {
  GREEN: { bg: "bg-green-100", text: "text-green-700", icon: Shield },
  YELLOW: { bg: "bg-yellow-100", text: "text-yellow-700", icon: AlertTriangle },
  RED: { bg: "bg-red-100", text: "text-red-700", icon: AlertCircle },
};

function formatRelative(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function CompareSelectModal({
  isOpen,
  onClose,
  history,
  currentReceiptId,
  purchaseId,
  onCompareComplete,
}: CompareSelectModalProps) {
  const { trackEvent } = useEventTracking();
  const [selectedEntry, setSelectedEntry] = useState<ReceiptHistoryEntry | null>(null);
  const [isBinding, setIsBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFreeCompare = !purchaseId;

  const availableReceipts = history.filter(
    (e) => e.receipt_id !== currentReceiptId
  );

  const handleSelect = (entry: ReceiptHistoryEntry) => {
    setError(null);
    trackEvent("compare_receipt_selected", {
      base_receipt_id: currentReceiptId,
      compare_receipt_id: entry.receipt_id,
    });

    if (isFreeCompare) {
      // Free compare: immediately load the comparison
      trackEvent("compare_started", {
        base_receipt_id: currentReceiptId,
        compare_receipt_id: entry.receipt_id,
        compare_mode: "free",
      });
      onCompareComplete(entry.receipt);
      handleClose();
    } else {
      // Paid compare: show confirmation step
      setSelectedEntry(entry);
    }
  };

  const handleConfirm = async () => {
    if (!selectedEntry || !purchaseId) return;
    setIsBinding(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/bind-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_id: purchaseId,
          compare_scenario_id: selectedEntry.receipt_id,
          compare_scenario_type: "receipt",
        }),
      });

      const data = await res.json();

      if (data.success) {
        trackEvent("compare_bound", {
          purchase_id: purchaseId,
          compare_receipt_id: selectedEntry.receipt_id,
        });
        onCompareComplete(selectedEntry.receipt);
        handleClose();
        return;
      }

      if (res.status === 409) {
        setError("Compare credit has already been used.");
      } else {
        setError(data.error || "Failed to bind compare credit.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsBinding(false);
    }
  };

  const handleClose = () => {
    setSelectedEntry(null);
    setError(null);
    setIsBinding(false);
    onClose();
  };

  const selectedVehicle = selectedEntry
    ? [selectedEntry.year, selectedEntry.make, selectedEntry.model].filter(Boolean).join(" ")
    : "";

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
            className="fixed inset-0 bg-black/30 z-40"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                {selectedEntry && (
                  <button
                    onClick={() => { setSelectedEntry(null); setError(null); }}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                <GitCompare className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedEntry ? "Confirm Compare" : "Select Receipt"}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {!selectedEntry ? (
                // Step 1: Select
                availableReceipts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                    <GitCompare className="w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500 mb-1 font-medium">
                      No other receipts available
                    </p>
                    <p className="text-xs text-gray-400">
                      Generate another receipt first to compare.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="px-5 py-3 text-xs text-gray-500 bg-gray-50">
                      {isFreeCompare
                        ? "Choose a receipt to compare against."
                        : "Choose a receipt to compare against. This will permanently use your compare credit."}
                    </p>
                    <div className="divide-y divide-gray-100">
                      {availableReceipts.map((entry) => {
                        const badge = VERDICT_BADGE[entry.verdict];
                        const Icon = badge.icon;
                        const vehicle = [entry.year, entry.make, entry.model]
                          .filter(Boolean)
                          .join(" ");
                        const timeStr = formatRelative(entry.created_at);

                        return (
                          <button
                            key={entry.receipt_id}
                            onClick={() => handleSelect(entry)}
                            className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                              >
                                <Icon className="w-3 h-3" />
                                {entry.verdict}
                              </div>
                              <span className="text-xs text-gray-400">
                                {timeStr}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {vehicle || "Unknown Vehicle"}
                            </p>
                            {entry.price && (
                              <p className="text-xs text-gray-500">
                                ${entry.price.toLocaleString()}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )
              ) : (
                // Step 2: Confirm (paid compare only)
                <div className="px-5 py-6 space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 mb-1">
                          This cannot be undone
                        </p>
                        <p className="text-xs text-amber-700">
                          Your compare credit will be permanently used to compare
                          against the <strong>{selectedVehicle}</strong> receipt.
                        </p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}

                  <button
                    onClick={handleConfirm}
                    disabled={isBinding}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60"
                  >
                    {isBinding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Binding compare credit...
                      </>
                    ) : (
                      <>
                        <GitCompare className="w-4 h-4" />
                        Confirm Compare
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => { setSelectedEntry(null); setError(null); }}
                    disabled={isBinding}
                    className="w-full py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
