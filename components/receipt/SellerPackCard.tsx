/**
 * SellerPackCard — Micro paywall for Seller Questions Pack
 *
 * Lightweight card offering the seller questions unlock at $2.99/$4.99 (A/B).
 * Simpler than DecisionPackCard — single CTA, no tier selection.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  ClipboardCheck,
  Copy,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface SellerPackCardProps {
  receiptToken: string;
  receiptId: string;
  displayPrice: string;
  questionCount: number;
  onDismiss?: () => void;
}

const BENEFITS = [
  { icon: MessageSquare, getText: (n: number) => `All ${n} must-ask questions for this listing` },
  { icon: ClipboardCheck, getText: () => "Complete pre-visit inspection checklist" },
  { icon: Copy, getText: () => "Copy & send directly to the seller" },
];

export default function SellerPackCard({
  receiptToken,
  receiptId,
  displayPrice,
  questionCount,
  onDismiss,
}: SellerPackCardProps) {
  const { trackEvent } = useEventTracking();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTrackedShow = useRef(false);

  useEffect(() => {
    if (!hasTrackedShow.current) {
      trackEvent("seller_pack_paywall_shown", {
        receipt_id: receiptId,
        display_price: displayPrice,
      });
      hasTrackedShow.current = true;
    }
  }, [trackEvent, receiptId, displayPrice]);

  const handleDismiss = () => {
    trackEvent("seller_pack_dismissed", { receipt_id: receiptId });
    onDismiss?.();
  };

  const handleUnlock = async () => {
    setCheckingOut(true);
    setError(null);

    trackEvent("teaser_cta_clicked", {
      receipt_id: receiptId,
      pack_tier: "seller_questions",
    });

    trackEvent("seller_pack_checkout_started", {
      receipt_id: receiptId,
      display_price: displayPrice,
    });

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "receipt",
          scenario_id: receiptId,
          anon_id: receiptToken,
          pack_tier: "seller_questions",
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
        setError("Receipt not saved yet — please regenerate and try again.");
      } else {
        setError(data.error || "Checkout failed. Please try again.");
      }
      trackEvent("checkout_failed", {
        receipt_id: receiptId,
        pack_tier: "seller_questions",
        error: data.error || "unknown",
      });
    } catch (err) {
      setError("Connection error. Please try again.");
      trackEvent("checkout_failed", {
        receipt_id: receiptId,
        pack_tier: "seller_questions",
        error: err instanceof Error ? err.message : "connection_error",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-2xl border border-green-200 shadow-sm overflow-hidden"
    >
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
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h3 className="text-base font-bold text-gray-900">
            Unlock All Seller Questions
          </h3>
        </div>

        <div className="border border-green-200 rounded-xl p-4 bg-white mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">Seller Questions Pack</h4>
            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              {displayPrice}
            </span>
          </div>
          <ul className="space-y-2 mb-4">
            {BENEFITS.map(({ icon: Icon, getText }, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <Icon className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{getText(questionCount)}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUnlock}
            disabled={checkingOut}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-xs text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-60 shadow-sm"
          >
            {checkingOut ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Get Seller Pack — {displayPrice}
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-2">{error}</p>
        )}

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
