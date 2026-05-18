/**
 * BuyerPassCard — Single-tier paywall for OFFO Buyer Pass
 *
 * Shows a single Buyer Pass ($9.99) card with benefits.
 * 10 receipts with full analysis, deep-dive, and PDF export.
 */

"use client";

import { useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  MessageSquare,
  FileDown,
  Search,
  X,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { getDisplayPriceForRegion } from "@/lib/price-assignment";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { Region } from "@/lib/region";

export type UpgradeContext = "listing_analysis" | "ev_routine_check" | "compare";

interface DecisionPackCardProps {
  receiptToken: string;
  receiptId: string;
  triggerReason?: string | null;
  onDismiss?: () => void;
  region?: Region;
  upgradeContext?: UpgradeContext;
}

const BENEFITS_BY_CONTEXT: Record<UpgradeContext, { icon: React.ElementType; text: string }[]> = {
  listing_analysis: [
    { icon: Search, text: "Full deep-dive analysis" },
    { icon: MessageSquare, text: "3 ready-to-use negotiation scripts" },
    { icon: BarChart2, text: "Market comparison with similar listings" },
    { icon: FileDown, text: "PDF export — share or print" },
  ],
  ev_routine_check: [
    { icon: Search, text: "Full routine fit breakdown with stress flags" },
    { icon: MessageSquare, text: "Charging gap analysis for your daily schedule" },
    { icon: BarChart2, text: "Range confidence by season and commute" },
    { icon: FileDown, text: "PDF export — share or print" },
  ],
  compare: [
    { icon: Search, text: "Side-by-side deep-dive on both listings" },
    { icon: MessageSquare, text: "Negotiation scripts for each vehicle" },
    { icon: BarChart2, text: "Which is the better deal for your routine" },
    { icon: FileDown, text: "PDF export for both reports" },
  ],
};

const HEADLINE_BY_CONTEXT: Record<UpgradeContext, string> = {
  listing_analysis: "Get the full analysis",
  ev_routine_check: "See how this EV fits your routine",
  compare: "Compare both listings in depth",
};

const ADDITIONAL_BENEFITS = BENEFITS_BY_CONTEXT.listing_analysis;

export default function DecisionPackCard({
  receiptToken,
  receiptId,
  triggerReason,
  onDismiss,
  region = "US",
  upgradeContext = "listing_analysis",
}: DecisionPackCardProps) {
  const { trackEvent } = useEventTracking();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const benefits = BENEFITS_BY_CONTEXT[upgradeContext] ?? ADDITIONAL_BENEFITS;
  const headline = HEADLINE_BY_CONTEXT[upgradeContext] ?? HEADLINE_BY_CONTEXT.listing_analysis;

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

    const displayPrice = getDisplayPriceForRegion("999", region);

    trackEvent("teaser_cta_clicked", {
      receipt_id: receiptId,
      pack_tier: "buyer_pass",
    });

    trackEvent("checkout_started", {
      receipt_id: receiptId,
      pack_tier: "buyer_pass",
      display_price: displayPrice,
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
      trackEvent("checkout_failed", {
        receipt_id: receiptId,
        pack_tier: "buyer_pass",
        error: data.error || "unknown",
      });
    } catch (err) {
      setError("Connection error. Please try again.");
      trackEvent("checkout_failed", {
        receipt_id: receiptId,
        pack_tier: "buyer_pass",
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
      transition={{ duration: 0.4, delay: 0.2 }}
      className="relative bg-gradient-to-br from-slate-50 via-white to-indigo-50 rounded-2xl border border-indigo-200 shadow-sm overflow-hidden"
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
        {/* Price badge */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full">
            OFFO Buyer Pass
          </span>
          <span className="text-base font-bold text-gray-900">
            {getDisplayPriceForRegion("999", region)}
          </span>
        </div>

        {/* Hero feature block */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-4 mb-4 text-white">
          <div className="flex items-start gap-3">
            <div className="bg-white/20 rounded-lg p-2 flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">{headline}</h3>
              {upgradeContext === "listing_analysis" && (
                <p className="text-xs text-indigo-100 leading-relaxed">
                  Verify the car&apos;s identity, check open recalls, and detect listing mismatches — before you hand over a deposit.
                </p>
              )}
              {upgradeContext === "ev_routine_check" && (
                <p className="text-xs text-indigo-100 leading-relaxed">
                  See exactly how this EV handles your daily commute, charging access, and climate — with real-world range data.
                </p>
              )}
              {upgradeContext === "compare" && (
                <p className="text-xs text-indigo-100 leading-relaxed">
                  Run a full side-by-side comparison of both listings including risk flags, pricing, and routine fit.
                </p>
              )}
            </div>
          </div>
          {upgradeContext === "listing_analysis" && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>1 in 5 listings has a detail that doesn&apos;t match the VIN record</span>
            </div>
          )}
        </div>

        {/* Benefits */}
        <ul className="space-y-2 mb-4">
          {benefits.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <Icon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleUnlock}
          disabled={checkingOut}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-60 shadow-sm"
        >
          {checkingOut ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Run VIN Check — {getDisplayPriceForRegion("999", region)}
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}

        {/* Dismiss link */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors mt-3"
          >
            Not now
          </button>
        )}
      </div>
    </motion.div>
  );
}
