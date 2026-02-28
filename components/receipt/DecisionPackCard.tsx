/**
 * BuyerPassCard — Single-tier paywall for OFFO Buyer Pass
 *
 * Shows a single Buyer Pass ($9.99) card with benefits.
 * 10 receipts with full AI analysis, deep-dive, and PDF export.
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  MessageSquare,
  FileDown,
  Search,
  Sparkles,
  X,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { BUYER_PASS_PRICE } from "@/lib/price-assignment";
import { useEventTracking } from "@/hooks/useEventTracking";

interface DecisionPackCardProps {
  receiptToken: string;
  receiptId: string;
  triggerReason?: string | null;
  onDismiss?: () => void;
}

const BUYER_PASS_BENEFITS = [
  { icon: ShoppingBag, text: "10 receipt credits" },
  { icon: Search, text: "Full AI analysis with deep-dive" },
  { icon: MessageSquare, text: "3 ready-to-use negotiation scripts" },
  { icon: BarChart2, text: "Market comparison with similar listings" },
  { icon: FileDown, text: "PDF export of every receipt" },
];

export default function DecisionPackCard({
  receiptToken,
  receiptId,
  triggerReason,
  onDismiss,
}: DecisionPackCardProps) {
  const { trackEvent } = useEventTracking();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDismiss = () => {
    trackEvent("paywall_dismissed", {
      receipt_id: receiptId,
      trigger_reason: triggerReason || "unknown",
    });
    onDismiss?.();
  };

  const handleUnlock = async () => {
    setCheckingOut(true);
    setError(null);

    trackEvent("checkout_started", {
      receipt_id: receiptId,
      pack_tier: "buyer_pass",
      display_price: BUYER_PASS_PRICE,
      trigger_reason: triggerReason || "unknown",
    });

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "receipt",
          scenario_id: receiptId,
          anon_id: receiptToken,
          page_source: "receipt_page",
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.status === "paid") {
        window.location.reload();
        return;
      }

      if (data.error === "Scenario not found") {
        setError("Receipt not saved yet — please regenerate your receipt and try again.");
      } else {
        setError(data.error || "Checkout failed. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-2xl border border-blue-200 shadow-sm overflow-hidden"
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 z-10 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-gray-900">
            Unlock the Full Picture
          </h3>
        </div>

        {/* Single Buyer Pass card */}
        <div className="border-2 border-indigo-300 rounded-xl p-4 bg-white mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">OFFO Buyer Pass</h4>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {BUYER_PASS_PRICE}
            </span>
          </div>
          <ul className="space-y-2 mb-4">
            {BUYER_PASS_BENEFITS.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <Icon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUnlock}
            disabled={checkingOut}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-sm"
          >
            {checkingOut ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Get Buyer Pass — {BUYER_PASS_PRICE}
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 mb-2">{error}</p>
        )}

        {/* Dismiss link */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Not now
          </button>
        )}
      </div>
    </motion.div>
  );
}
