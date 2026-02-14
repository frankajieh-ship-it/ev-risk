/**
 * ReceiptHistoryDrawer — Slide-out drawer showing past receipts
 *
 * Fixed overlay, slide from right, last 10 receipts.
 */

"use client";

import { X, Trash2, Shield, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReceiptHistoryEntry, Verdict } from "@/types/receipt";
import { clearReceiptHistory } from "@/lib/receipt-history";

interface ReceiptHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ReceiptHistoryEntry[];
  onSelect: (entry: ReceiptHistoryEntry) => void;
  onClear: () => void;
  isLoading?: boolean;
}

const VERDICT_BADGE: Record<
  Verdict,
  { bg: string; text: string; icon: typeof Shield }
> = {
  GREEN: { bg: "bg-green-100", text: "text-green-700", icon: Shield },
  YELLOW: { bg: "bg-yellow-100", text: "text-yellow-700", icon: AlertTriangle },
  RED: { bg: "bg-red-100", text: "text-red-700", icon: AlertCircle },
};

export default function ReceiptHistoryDrawer({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
  isLoading,
}: ReceiptHistoryDrawerProps) {
  const handleClear = () => {
    clearReceiptHistory();
    onClear();
  };

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
            onClick={onClose}
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
              <h2 className="text-lg font-semibold text-gray-900">
                Receipt History
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Syncing indicator */}
            {isLoading && history.length > 0 && (
              <div className="flex items-center gap-2 px-5 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing...
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-sm text-gray-400">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-gray-300 mb-2" />
                      Loading history...
                    </>
                  ) : (
                    "No receipts yet"
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {history.map((entry) => {
                    const badge = VERDICT_BADGE[entry.verdict];
                    const Icon = badge.icon;
                    const vehicle = [entry.year, entry.make, entry.model]
                      .filter(Boolean)
                      .join(" ");
                    const timeStr = formatRelative(entry.created_at);

                    return (
                      <button
                        key={entry.receipt_id}
                        onClick={() => onSelect(entry)}
                        className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                          >
                            <Icon className="w-3 h-3" />
                            {entry.verdict}
                          </div>
                          <span className="text-xs text-gray-400">{timeStr}</span>
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
              )}
            </div>

            {/* Footer */}
            {history.length > 0 && (
              <div className="border-t border-gray-200 px-5 py-3">
                <button
                  onClick={handleClear}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear History
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Helpers ---

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
