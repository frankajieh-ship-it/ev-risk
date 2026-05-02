"use client";

import { useState } from "react";
import {
  Lock,
  TrendingDown,
  ClipboardList,
  FileText,
  Zap,
  DollarSign,
  AlertCircle,
  Shield,
} from "lucide-react";

interface PaywallGateProps {
  receiptToken: string;
  scenarioId: string;
  onCheckout?: (url: string) => void;
}

const LOCKED_SECTIONS = [
  {
    icon: Shield,
    label: "Title, accident & recall history",
    detail: "Clean title? Any accidents on record? Open recalls?",
  },
  {
    icon: TrendingDown,
    label: "Market price comparison",
    detail: "Is this listing overpriced vs. comparable EVs sold nearby?",
  },
  {
    icon: ClipboardList,
    label: "10-point inspection checklist",
    detail: "Exactly what to check before you hand over a dollar.",
  },
  {
    icon: FileText,
    label: "3 negotiation scripts",
    detail: "Copy-paste messages to get money off — for this exact listing.",
  },
  {
    icon: Zap,
    label: "Battery health deep dive",
    detail: "Estimated degradation, range loss, and red flags to ask about.",
  },
  {
    icon: DollarSign,
    label: "3-year cost of ownership",
    detail: "Insurance, maintenance, charging, depreciation — all in.",
  },
  {
    icon: AlertCircle,
    label: "Model-specific known issues",
    detail: "Common problems owners report for this exact make & model.",
  },
];

export default function PaywallGate({ receiptToken, scenarioId, onCheckout }: PaywallGateProps) {
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
    <div className="rounded-2xl border border-[#00d97e]/25 bg-[#0d1117] overflow-hidden">
      {/* Header */}
      <div className="bg-[#00d97e]/[0.07] border-b border-[#00d97e]/15 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Lock className="w-4 h-4 text-[#00d97e]" />
          <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wider">
            Full analysis ready
          </span>
        </div>
        <h2 className="text-lg font-bold text-white leading-snug">
          Get the complete deep dive — $3.99, one time
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Everything below is unlocked instantly. No subscription.
        </p>
      </div>

      {/* Locked section list */}
      <div className="divide-y divide-white/[0.05]">
        {LOCKED_SECTIONS.map(({ icon: Icon, label, detail }) => (
          <div key={label} className="flex items-start gap-3 px-5 py-3">
            <div className="w-7 h-7 rounded-lg bg-[#00d97e]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="w-3.5 h-3.5 text-[#00d97e]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-white/40 mt-0.5">{detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-5 py-5 border-t border-white/[0.06]">
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
              Unlock full deep dive — $3.99
            </>
          )}
        </button>
        {error && (
          <p className="text-red-400 text-xs text-center mt-3">{error}</p>
        )}
        <p className="text-white/20 text-xs text-center mt-3">
          Secure payment via Stripe · One listing · No recurring charges
        </p>
      </div>
    </div>
  );
}
