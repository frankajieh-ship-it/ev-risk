"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Zap, BarChart2, FileDown, Loader2, X, Calculator, MapPin } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface CopartUnlockCardProps {
  receiptToken: string;
  receiptId: string;
  onDismiss?: () => void;
  teaserArvLow?: number | null;
  teaserArvHigh?: number | null;
}

const BENEFITS = [
  { icon: Calculator, text: "Arbitrage calculator: ARV, repair cost, max safe bid" },
  { icon: MapPin, text: "State-specific rebuilt title requirements" },
  { icon: Zap, text: "Battery health projection & thermal damage assessment" },
  { icon: ShieldCheck, text: "Repair impact on EV range and charging capability" },
  { icon: BarChart2, text: "Post-repair routine fit estimate" },
  { icon: FileDown, text: "Full AI deep-dive + PDF export" },
];

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

export default function CopartUnlockCard({ receiptToken: _receiptToken, receiptId, onDismiss, teaserArvLow, teaserArvHigh }: CopartUnlockCardProps) {
  const { trackEvent } = useEventTracking();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTrackedShow = useRef(false);

  useEffect(() => {
    if (!hasTrackedShow.current) {
      trackEvent("copart_unlock_shown", { receipt_id: receiptId });
      hasTrackedShow.current = true;
    }
  }, [trackEvent, receiptId]);

  const handleDismiss = () => {
    trackEvent("copart_unlock_dismissed", { receipt_id: receiptId });
    onDismiss?.();
  };

  const handleUnlock = async () => {
    setCheckingOut(true);
    setError(null);

    trackEvent("checkout_started", {
      receipt_id: receiptId,
      pack_tier: "copart_report",
      display_price: "$19.99",
      page_source: "copart_page",
    });

    try {
      const res = await fetch(`/api/auction/purchase/${receiptId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success_url: window.location.href + (window.location.href.includes("?") ? "&" : "?") + "checkout=success",
          cancel_url: window.location.href,
        }),
      });

      const data = await res.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      if (data.success === false && data.error === "Already purchased") {
        window.location.reload();
        return;
      }

      setError(data.error || "Checkout failed. Please try again.");
      trackEvent("checkout_failed", {
        receipt_id: receiptId,
        pack_tier: "copart_report",
        error: data.error || "unknown",
        page_source: "copart_page",
      });
    } catch (err) {
      setError("Connection error. Please try again.");
      trackEvent("checkout_failed", {
        receipt_id: receiptId,
        pack_tier: "copart_report",
        error: err instanceof Error ? err.message : "connection_error",
        page_source: "copart_page",
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
      className="relative bg-gradient-to-br from-orange-50 via-white to-amber-50 rounded-2xl border border-orange-200 shadow-sm overflow-hidden"
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-900">Full Copart Risk Report</h3>
          <span className="text-sm font-bold text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full">
            $19.99 one-time
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Get the complete salvage analysis — battery projection, repair impact, and post-auction routine fit.
        </p>

        {/* Teaser preview with blurred numbers */}
        {(teaserArvLow != null || teaserArvHigh != null) && (
          <div className="bg-white/60 rounded-xl border border-orange-100 p-3 mb-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What you&apos;ll unlock</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500">Est. ARV</p>
                <p className="text-sm font-bold text-gray-900 blur-[3px] select-none">
                  {teaserArvLow ? fmt(teaserArvLow) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Repair Est.</p>
                <p className="text-sm font-bold text-gray-900 blur-[3px] select-none">$8,200</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Max Safe Bid</p>
                <p className="text-sm font-bold text-green-700 blur-[3px] select-none">$27,400</p>
              </div>
            </div>
            <p className="text-xs text-center text-orange-600 font-medium">Unlock to see your numbers →</p>
          </div>
        )}

        <ul className="space-y-2 mb-5">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-xs text-gray-700">
              <Icon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
              {text}
            </li>
          ))}
        </ul>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={checkingOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm disabled:opacity-60"
        >
          {checkingOut ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
          ) : (
            <><ShieldCheck className="w-4 h-4" /> Unlock Full Report — $19.99</>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">
          One-time payment · No subscription · Instant access
        </p>

        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors mt-2"
          >
            Not now
          </button>
        )}
      </div>
    </motion.div>
  );
}
