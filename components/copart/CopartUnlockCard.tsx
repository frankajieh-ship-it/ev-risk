"use client";

/**
 * CopartUnlockCard — Full-strength upsell card for the /auction/[resultId] arbitrage lock gate.
 *
 * Replaces the minimal blur treatment with a prominent card showing:
 * - 3 blurred number slots (ARV, repair cost, max safe bid)
 * - Feature list
 * - Strong $49 CTA
 */

import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Zap, BarChart2, FileDown, Loader2, Calculator, MapPin, Lock } from "lucide-react";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";

interface CopartUnlockCardProps {
  resultId: string;
  onDismiss?: () => void;
}

const BENEFITS = [
  { icon: Calculator, text: "Market value (ARV), repair cost range, max safe bid" },
  { icon: BarChart2, text: "Component-by-component repair cost breakdown" },
  { icon: MapPin, text: "State-specific rebuilt title requirements" },
  { icon: Zap, text: "Battery health projection & thermal damage assessment" },
  { icon: ShieldCheck, text: "Repair impact on EV range and charging capability" },
  { icon: FileDown, text: "PDF export of full report" },
];

export default function CopartUnlockCard({ resultId, onDismiss }: CopartUnlockCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!shownRef.current) {
      shownRef.current = true;
      // Fire-and-forget impression event
      fetch("/api/track-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "auction_teaser_shown",
          event_data: { result_id: resultId, source: "unlock_card" },
          visitor_id: getOrCreatePersistentSessionId(),
        }),
      }).catch(() => {});
    }
  }, [resultId]);

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);

    // Track checkout start
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "checkout_started",
        event_data: { result_id: resultId, pack_tier: "copart_report", display_price: "$49", page_source: "auction_result" },
        visitor_id: getOrCreatePersistentSessionId(),
      }),
    }).catch(() => {});

    try {
      const anonId = getOrCreatePersistentSessionId();
      const res = await fetch(`/api/auction/purchase/${resultId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anon_id: anonId }),
      });
      const json = await res.json();
      if (json.checkout_url) {
        window.location.href = json.checkout_url;
      } else if (json.success === false && json.error === "Already purchased") {
        window.location.reload();
      } else {
        setError(json.error ?? "Checkout failed — please try again");
        setLoading(false);
      }
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-amber-50 border-b border-amber-100 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Auction Audit — $49
          </span>
        </div>
        <h3 className="text-base font-bold text-gray-900 leading-snug">
          Know your numbers before you bid
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          ARV, repair cost range, and max safe bid computed from real auction comparables.
        </p>
      </div>

      {/* Blurred number slots */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Market Value</p>
          <p className="text-base font-bold text-gray-200 blur-sm select-none">$28,500</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Repair Cost</p>
          <p className="text-base font-bold text-gray-200 blur-sm select-none">$4,200–$6,800</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Max Safe Bid</p>
          <p className="text-base font-bold text-gray-200 blur-sm select-none">$21,750</p>
        </div>
      </div>

      {/* Benefits */}
      <div className="px-5 py-4 border-b border-gray-100">
        <ul className="space-y-2">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-xs text-gray-600">
              <Icon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-5 py-4">
        {error && <p className="text-xs text-red-600 mb-3 text-center">{error}</p>}
        <button
          onClick={handleUnlock}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to checkout...</>
          ) : (
            <><Lock className="w-4 h-4" /> Unlock Auction Audit — $49</>
          )}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">
          One-time · No subscription · Instant access
        </p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
          >
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
