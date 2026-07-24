"use client";

import { useState, useEffect } from "react";
import { Zap, CheckCircle, Camera, Lock, Gift, Shield, TrendingDown, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface StarterPaywallCardProps {
  receiptToken: string;
  scenarioId: string;
  availableCredits?: number;
  onPaywallClick?: () => void;
  onFullUpgradeClick?: () => void;
  onTrackEvent?: (name: string, data?: Record<string, unknown>) => void;
  onCreditRedeemed?: () => void;
  listingFirstSeenDays?: number;
  listingPriceDropCents?: number;
}

const STARTER_FEATURES = [
  { icon: Shield, text: "VIN history — theft, salvage & accident records" },
  { icon: CheckCircle, text: "Full AI analysis — risk verdict, deal quality score, red flags" },
  { icon: Camera, text: "Photo angle analysis — missing or suspicious angles flagged" },
  { icon: CheckCircle, text: "Negotiation talking points for this exact listing" },
];

export default function StarterPaywallCard({
  receiptToken,
  scenarioId,
  availableCredits = 0,
  onPaywallClick,
  onFullUpgradeClick,
  onTrackEvent,
  onCreditRedeemed,
  listingFirstSeenDays,
  listingPriceDropCents,
}: StarterPaywallCardProps) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [creditLoading, setCreditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTrackEvent?.("paywall_seen", { tier: "starter", scenario_id: scenarioId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRedeemCredit = async () => {
    onTrackEvent?.("referral_credit_redeemed", { scenario_id: scenarioId });
    setCreditLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/redeem-credit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ scenario_id: scenarioId, anon_id: receiptToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onCreditRedeemed?.();
      } else {
        setError(data.error || "Failed to redeem credit. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreditLoading(false);
    }
  };

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
        try { localStorage.setItem("offo_active_receipt_id", scenarioId); } catch {}
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

  const handleFullUpgrade = async () => {
    onTrackEvent?.("paywall_cta_clicked", { tier: "buyer_pass", scenario_id: scenarioId });
    if (onFullUpgradeClick) {
      onFullUpgradeClick();
      return;
    }
    setFullLoading(true);
    setError(null);
    try {
      onTrackEvent?.("checkout_opened", { tier: "buyer_pass", scenario_id: scenarioId });
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "receipt",
          scenario_id: scenarioId,
          anon_id: receiptToken,
          pack_tier: "buyer_pass",
        }),
      });
      const data = await res.json();
      if (data.url) {
        try { localStorage.setItem("offo_active_receipt_id", scenarioId); } catch {}
        window.location.href = data.url;
      } else if (data.status === "paid") {
        window.location.reload();
      } else {
        setError(data.error || "Failed to start checkout. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setFullLoading(false);
    }
  };

  // Listing signal — price drop takes priority over age
  const priceDrop = (listingPriceDropCents ?? 0) >= 5000
    ? `Price dropped $${Math.round(listingPriceDropCents! / 100)} since listed — seller may be motivated`
    : null;
  const ageSignal = !priceDrop && (listingFirstSeenDays ?? 0) >= 14
    ? `Listed ${listingFirstSeenDays} days ago — still available`
    : null;
  const listingSignal = priceDrop ?? ageSignal;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-[#161b22] border border-[#00d97e]/30 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#00d97e]/10 px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wide">
              Unlock Your Report
            </span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">
            Get the full analysis for this listing
          </h2>
          <p className="text-sm text-white/50 mt-1">
            VIN history · theft · salvage · title check · AI deep-dive · negotiation scripts
          </p>
        </div>

        {/* Listing signal bar */}
        {listingSignal && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-[#e3a537]/10 border-b border-[#e3a537]/20">
            <AlertTriangle className="w-3.5 h-3.5 text-[#e3a537] flex-shrink-0" />
            <span className="text-xs text-[#e3a537]">{listingSignal}</span>
          </div>
        )}

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

        {/* Social proof quote */}
        <div className="mx-6 mb-5 pl-3 border-l-2 border-[#00d97e]/50">
          <p className="text-xs text-white/60 italic leading-relaxed">
            &ldquo;I was about to pay asking price. OFFO flagged a prior accident the CarFax missed — I got $1,200 off.&rdquo;
          </p>
          <p className="text-xs text-white/35 mt-1">— Marcus T., 2024 Chevy Bolt buyer</p>
        </div>

        {/* CTAs */}
        <div className="px-6 pb-6 space-y-3">
          {/* Referral credit redemption — shown when user has credits */}
          {availableCredits > 0 && (
            <button
              onClick={handleRedeemCredit}
              disabled={creditLoading}
              className="w-full bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/40 disabled:opacity-40 disabled:cursor-not-allowed text-[#00d97e] font-bold text-base py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {creditLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#00d97e]/30 border-t-[#00d97e] rounded-full animate-spin" />
                  Redeeming credit…
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Use 1 referral credit — free ({availableCredits} available)
                </>
              )}
            </button>
          )}

          {/* $9.99 full report — shown first as the anchor */}
          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-0.5">Full Report</p>
                <p className="text-sm text-white/80 leading-snug">
                  VIN history + deep dive + negotiation scripts
                </p>
              </div>
              <span className="text-lg font-bold text-white ml-3 flex-shrink-0">$9.99</span>
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingDown className="w-3 h-3 text-[#00d97e]" />
              <span className="text-xs text-white/40">Everything in Starter, plus ownership history &amp; PDF export</span>
            </div>
            <button
              onClick={handleFullUpgrade}
              disabled={fullLoading}
              className="w-full bg-[#00d97e] hover:bg-[#00c970] disabled:opacity-40 disabled:cursor-not-allowed text-[#0d1117] font-bold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {fullLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#0d1117]/30 border-t-[#0d1117] rounded-full animate-spin" />
                  Preparing checkout…
                </>
              ) : (
                "Get the Full Report — $9.99"
              )}
            </button>
          </div>

          {/* $3.99 single listing — lighter secondary option */}
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-white/[0.06] hover:bg-white/[0.10] border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white/80 font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                Preparing checkout…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-white/50" />
                Or just this listing — $3.99
              </>
            )}
          </button>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}
          <p className="text-white/20 text-xs text-center mt-1">
            Secure payment via Stripe · One listing · No recurring charges
          </p>
        </div>
      </div>
    </div>
  );
}
