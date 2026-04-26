"use client";

import { useState } from "react";
import { Zap, ShieldCheck, TrendingDown, FileText, Lock } from "lucide-react";

interface ReceiptPaywallCardProps {
  receiptToken: string;
  scenarioId: string;
  /** Called when Stripe checkout URL is ready — redirect happens here */
  onCheckout?: (url: string) => void;
}

const FEATURES = [
  { icon: ShieldCheck, text: "Full risk verdict — GREEN / YELLOW / RED" },
  { icon: TrendingDown, text: "Deal quality score & price vs. market" },
  { icon: Zap, text: "Battery assessment & recall check" },
  { icon: FileText, text: "Negotiation insights & seller questions" },
];

export default function ReceiptPaywallCard({
  receiptToken,
  scenarioId,
  onCheckout,
}: ReceiptPaywallCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
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
        if (onCheckout) onCheckout(data.url);
        else window.location.href = data.url;
      } else if (data.status === "paid") {
        // Already paid — reload to trigger generation
        window.location.reload();
      } else {
        setError(data.error || "Failed to start checkout. Please try again.");
      }
    } catch {
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
              Analysis ready
            </span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">
            Unlock your full EV deal report
          </h2>
          <p className="text-sm text-white/50 mt-1">
            One-time payment. No subscription. Instant results.
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#00d97e]/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#00d97e]" />
              </div>
              <span className="text-sm text-white/70">{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-[#00d97e] hover:bg-[#00c970] disabled:opacity-60 disabled:cursor-not-allowed text-[#0d1117] font-bold text-base py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0d1117]/30 border-t-[#0d1117] rounded-full animate-spin" />
                Preparing checkout…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Unlock for $3.99
              </>
            )}
          </button>
          {error && (
            <p className="text-red-400 text-xs text-center mt-3">{error}</p>
          )}
          <p className="text-white/25 text-xs text-center mt-3">
            Secure payment via Stripe · One listing · No recurring charges
          </p>
        </div>
      </div>
    </div>
  );
}
