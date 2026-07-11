"use client";

import { useState, useEffect } from "react";
import { Zap, TrendingDown, FileText, Lock, Search, ClipboardList, Shield, Download, AlertCircle } from "lucide-react";

interface ReceiptPaywallCardProps {
  receiptToken: string;
  scenarioId: string;
  onPaywallClick?: () => void;
  /** True when user already paid $3.99 Starter — changes price copy to "$9.99 more" */
  isUpgrade?: boolean;
  onTrackEvent?: (name: string, data?: Record<string, unknown>) => void;
}

const VIN_HISTORY_UNAVAILABLE = false;

const FEATURES = [
  { icon: Search, text: "Market comparables — is this listing overpriced?" },
  { icon: Shield, text: "VIN history — theft, salvage & accident records (NMVTIS)", unavailable: VIN_HISTORY_UNAVAILABLE },
  { icon: ClipboardList, text: "10-point inspection checklist for this exact model" },
  { icon: FileText, text: "3 negotiation scripts ready to copy & send" },
  { icon: TrendingDown, text: "Battery health deep dive & recall status" },
  { icon: Download, text: "PDF export of the full report" },
];

export default function ReceiptPaywallCard({
  receiptToken,
  scenarioId,
  onPaywallClick,
  isUpgrade = false,
  onTrackEvent,
}: ReceiptPaywallCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTrackEvent?.("paywall_seen", { tier: "full", is_upgrade: isUpgrade, scenario_id: scenarioId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePay = async () => {
    onTrackEvent?.("paywall_cta_clicked", { tier: "full", is_upgrade: isUpgrade, scenario_id: scenarioId });
    if (onPaywallClick) {
      onPaywallClick();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      onTrackEvent?.("checkout_opened", { tier: "full", is_upgrade: isUpgrade, scenario_id: scenarioId });
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
        onTrackEvent?.("checkout_abandoned", { tier: "full", reason: "api_error", scenario_id: scenarioId });
        setError(data.error || "Failed to start checkout. Please try again.");
      }
    } catch {
      onTrackEvent?.("checkout_abandoned", { tier: "full", reason: "network_error", scenario_id: scenarioId });
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
              {isUpgrade ? "Upgrade to Full Report" : "Full analysis ready"}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">
            {isUpgrade ? "Add ownership history, deep dive & negotiation scripts" : "Unlock the complete report for this listing"}
          </h2>
          <p className="text-sm text-white/50 mt-1">
            VIN history · deep dive · negotiation scripts · PDF export.
            <br />
            {isUpgrade ? "$6.00 more · $3.99 Starter credit applied." : "$9.99 · This listing · No subscription."}
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 space-y-3">
          {FEATURES.map(({ icon: Icon, text, unavailable }) => (
            <div key={text} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${unavailable ? "bg-amber-500/10" : "bg-[#00d97e]/10"}`}>
                <Icon className={`w-3.5 h-3.5 ${unavailable ? "text-amber-400" : "text-[#00d97e]"}`} />
              </div>
              <span className={`text-sm ${unavailable ? "text-white/40" : "text-white/70"}`}>
                {text}
                {unavailable && <span className="ml-2 text-[11px] text-amber-400 font-medium">· temporarily unavailable</span>}
              </span>
            </div>
          ))}
        </div>

        {/* VIN history outage notice */}
        {VIN_HISTORY_UNAVAILABLE && (
          <div className="mx-6 mb-5 flex items-start gap-2.5 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/70 leading-relaxed">
              VIN history is temporarily unavailable due to a provider issue. We&apos;ll notify you when it&apos;s back online. All other features are working normally.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={handlePay}
            disabled={loading || VIN_HISTORY_UNAVAILABLE}
            className="w-full bg-[#00d97e] hover:bg-[#00c970] disabled:opacity-40 disabled:cursor-not-allowed text-[#0d1117] font-bold text-base py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0d1117]/30 border-t-[#0d1117] rounded-full animate-spin" />
                Preparing checkout…
              </>
            ) : VIN_HISTORY_UNAVAILABLE ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Payments paused — provider issue
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {isUpgrade ? "Upgrade for $6.00" : "Unlock everything — $9.99"}
              </>
            )}
          </button>
          {isUpgrade && !error && (
            <p className="text-white/30 text-xs text-center mt-3">Stripe will show $9.99 — your $3.99 Starter credit is applied at checkout.</p>
          )}
          {error && (
            <p className="text-red-400 text-xs text-center mt-3">{error}</p>
          )}
          <p className="text-white/25 text-xs text-center mt-3">
            {VIN_HISTORY_UNAVAILABLE ? "Payments temporarily disabled until VIN history is restored" : "Secure payment via Stripe · One listing · No recurring charges"}
          </p>
        </div>
      </div>
    </div>
  );
}
