/**
 * DecisionPackCard — Two-tier paywall for OFFO paid packs
 *
 * Shows Starter Pack ($4.99) and Decision Pack ($9.99) side by side.
 * Starter: seller questions, negotiation scripts, PDF.
 * Decision: everything in Starter plus market comparison, cost estimate, compare credit.
 */

"use client";

import { useState } from "react";
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
  Check,
  Crown,
} from "lucide-react";
import { getDisplayPrice, getVariantForTier } from "@/lib/price-assignment";
import type { PackTier } from "@/lib/price-assignment";
import { useEventTracking } from "@/hooks/useEventTracking";

interface DecisionPackCardProps {
  receiptToken: string;
  receiptId: string;
  triggerReason?: string | null;
  onDismiss?: () => void;
}

const STARTER_BENEFITS = [
  { icon: Search, text: "Extended 10-point inspection checklist" },
  { icon: MessageSquare, text: "3 ready-to-use negotiation scripts" },
  { icon: FileDown, text: "PDF download of your receipt" },
];

const DECISION_ONLY_BENEFITS = [
  { icon: BarChart2, text: "Market comparison with 3–5 similar listings" },
  { icon: DollarSign, text: "3-year cost of ownership estimate" },
  { icon: GitCompare, text: "1 compare credit — side-by-side analysis" },
];

export default function DecisionPackCard({
  receiptToken,
  receiptId,
  triggerReason,
  onDismiss,
}: DecisionPackCardProps) {
  const { trackEvent } = useEventTracking();
  const [checkingOutTier, setCheckingOutTier] = useState<PackTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const starterPrice = getDisplayPrice(getVariantForTier("starter_pack"));
  const decisionPrice = getDisplayPrice(getVariantForTier("decision_pack"));

  const handleDismiss = () => {
    trackEvent("paywall_dismissed", {
      receipt_id: receiptId,
      trigger_reason: triggerReason || "unknown",
    });
    onDismiss?.();
  };

  const handleUnlock = async (tier: PackTier) => {
    setCheckingOutTier(tier);
    setError(null);

    trackEvent("checkout_started", {
      receipt_id: receiptId,
      pack_tier: tier,
      display_price: getDisplayPrice(getVariantForTier(tier)),
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
          pack_tier: tier,
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
      setCheckingOutTier(null);
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

        {/* Two-tier grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Starter Pack */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-800">Starter Pack</h4>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                {starterPrice}
              </span>
            </div>
            <ul className="space-y-2 mb-4">
              {STARTER_BENEFITS.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <Icon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUnlock("starter_pack")}
              disabled={checkingOutTier !== null}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all disabled:opacity-60"
            >
              {checkingOutTier === "starter_pack" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>Get Starter — {starterPrice}</>
              )}
            </button>
          </div>

          {/* Decision Pack */}
          <div className="relative border-2 border-indigo-300 rounded-xl p-4 bg-white">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                <Crown className="w-3 h-3" /> Best value
              </span>
            </div>
            <div className="flex items-center justify-between mb-3 mt-1">
              <h4 className="text-sm font-semibold text-gray-800">Decision Pack</h4>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                {decisionPrice}
              </span>
            </div>
            <ul className="space-y-2 mb-1">
              {STARTER_BENEFITS.map(({ text }, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-2 mb-4">
              {DECISION_ONLY_BENEFITS.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                  <Icon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUnlock("decision_pack")}
              disabled={checkingOutTier !== null}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-sm"
            >
              {checkingOutTier === "decision_pack" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Get Decision Pack — {decisionPrice}
                </>
              )}
            </button>
          </div>
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
