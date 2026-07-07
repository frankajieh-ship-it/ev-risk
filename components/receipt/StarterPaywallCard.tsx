"use client";

import { useState, useEffect } from "react";
import { Zap, CheckCircle, Camera, Lock } from "lucide-react";

interface StarterPaywallCardProps {
  receiptToken: string;
  scenarioId: string;
  onPaywallClick?: () => void;
  onFullUpgradeClick?: () => void;
  onTrackEvent?: (name: string, data?: Record<string, unknown>) => void;
}

const STARTER_FEATURES = [
  { icon: CheckCircle, text: "Verdict color revealed — GREEN, YELLOW, or RED" },
  { icon: CheckCircle, text: "Full AI summary — plain-language breakdown of what this listing means" },
  { icon: Camera, text: "Photo angle analysis — flag missing or suspicious photos" },
];

export default function StarterPaywallCard({
  receiptToken,
  scenarioId,
  onPaywallClick,
  onFullUpgradeClick,
  onTrackEvent,
}: StarterPaywallCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTrackEvent?.("paywall_seen", { tier: "starter", scenario_id: scenarioId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePay = async () => {
    onTrackEvent?.("paywall_cta_clicked", { tier: "starter", scenario_id: scenarioId });
    if (onPaywallClick) {
      onPaywallClick();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      onTrackEvent?.("checkout_opened", { tier: "starter", scenario_id: scenarioId });
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "receipt",
          scenario_id: scenarioId,
          anon_id: receiptToken,
          pack_tier: "receipt_single",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.status === "paid") {
        window.location.reload();
      } else {
        onTrackEvent?.("checkout_abandoned", { tier: "starter", reason: "api_error", scenario_id: scenarioId });
        setError(data.error || "Failed to start checkout. Please try again.");
      }
    } catch {
      onTrackEvent?.("checkout_abandoned", { tier: "starter", reason: "network_error", scenario_id: scenarioId });
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-[#161b22] border border-[#00d97e]/30 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#00d97e]/10 px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wide">
              Starter Report
            </span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">
            Reveal your verdict &amp; photo analysis
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Verdict color · AI summary · Photo analysis.
            <br />
            $3.99 · This listing · No subscription.
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 space-y-3">
          {STARTER_FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#00d97e]/10">
                <Icon className="w-3.5 h-3.5 text-[#00d97e]" />
              </div>
              <span className="text-sm text-white/70">{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-[#00d97e] hover:bg-[#00c970] disabled:opacity-40 disabled:cursor-not-allowed text-[#0d1117] font-bold text-base py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0d1117]/30 border-t-[#0d1117] rounded-full animate-spin" />
                Preparing checkout…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Unlock Starter Report — $3.99
              </>
            )}
          </button>
          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}
          <p className="text-white/25 text-xs text-center">
            Secure payment via Stripe · One listing · No recurring charges
          </p>
          <div className="text-center pt-1">
            <button
              onClick={onFullUpgradeClick}
              className="text-xs text-white/35 hover:text-white/60 transition-colors underline underline-offset-2"
            >
              $9.99 total — or pay $3.99 now and apply it toward the full report later →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
