/**
 * DecisionPackCard — Soft paywall for the OFFO Decision Pack
 *
 * Shows below free receipt output. Displays price from deterministic
 * A/B assignment and redirects to Stripe Checkout on click.
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  MessageSquare,
  FileDown,
  GitCompare,
  Search,
  DollarSign,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { assignPriceVariant, getDisplayPrice } from "@/lib/price-assignment";
import { useEventTracking } from "@/hooks/useEventTracking";

interface DecisionPackCardProps {
  receiptToken: string;
  receiptId: string;
  onDismiss?: () => void;
}

const BENEFITS = [
  { icon: BarChart2, text: "Market comparison with 3–5 similar listings" },
  { icon: MessageSquare, text: "3 ready-to-use negotiation scripts" },
  { icon: FileDown, text: "PDF download of your complete receipt" },
  { icon: GitCompare, text: "1 compare credit — put two cars side-by-side" },
  { icon: Search, text: "Extended 10-point inspection checklist" },
  { icon: DollarSign, text: "3-year cost of ownership estimate" },
];

export default function DecisionPackCard({
  receiptToken,
  receiptId,
  onDismiss,
}: DecisionPackCardProps) {
  const { trackEvent } = useEventTracking();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variant = assignPriceVariant(receiptToken, receiptId);
  const displayPrice = getDisplayPrice(variant);

  // Track offer viewed on mount
  useEffect(() => {
    const ctx = {
      receipt_id: receiptId,
      price_variant: variant,
      display_price: displayPrice,
    };
    trackEvent("deep_dive_offer_viewed", ctx);
    trackEvent("paywall_shown", ctx);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlock = async () => {
    setIsCheckingOut(true);
    setError(null);

    const ctx = {
      receipt_id: receiptId,
      price_variant: variant,
      display_price: displayPrice,
    };
    trackEvent("deep_dive_offer_clicked", ctx);
    trackEvent("checkout_started", ctx);

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "receipt",
          scenario_id: receiptId,
          anon_id: receiptToken,
          price_variant: variant,
          page_source: "receipt_page",
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Already paid
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
      setIsCheckingOut(false);
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
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-gray-900">
            Unlock the Full Picture
          </h3>
          <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {displayPrice} one-time
          </span>
        </div>

        {/* Benefits */}
        <ul className="space-y-2 mb-4">
          {BENEFITS.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
              <Icon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleUnlock}
          disabled={isCheckingOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-sm"
        >
          {isCheckingOut ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to checkout...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Unlock Decision Pack — {displayPrice}
            </>
          )}
        </button>

        {/* Dismiss link */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Not now
          </button>
        )}
      </div>
    </motion.div>
  );
}
