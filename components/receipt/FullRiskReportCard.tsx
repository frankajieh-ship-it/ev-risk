/**
 * FullRiskReportCard — $39 manual "Full Risk Report" upsell
 *
 * Inline upsell card shown after the basic receipt result.
 * Manually fulfilled by the team — links to a Stripe Payment Link
 * configured via NEXT_PUBLIC_FULL_RISK_REPORT_STRIPE_LINK env var.
 *
 * Urgency: limited to first 15 reports per week (copy only — not enforced).
 */

"use client";

import { Shield, FileText, Star, Clock, Zap } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface FullRiskReportCardProps {
  receiptId: string;
  vehicleLabel?: string;
}

const BENEFITS = [
  { icon: Shield, text: "Full battery degradation + accident + recall history" },
  { icon: Star, text: "Personalized Fair / Good / Great Deal rating" },
  { icon: FileText, text: "Professional PDF report delivered to your email" },
  { icon: Clock, text: "Delivered within 48 hours" },
  { icon: Zap, text: "48-hour email support from our team" },
];

export default function FullRiskReportCard({ receiptId, vehicleLabel }: FullRiskReportCardProps) {
  const { trackEvent } = useEventTracking();

  const stripeLink = process.env.NEXT_PUBLIC_FULL_RISK_REPORT_STRIPE_LINK;

  const handleClick = () => {
    trackEvent("deep_dive_offer_clicked", {
      receipt_id: receiptId,
      offer_type: "full_risk_report_39",
      vehicle: vehicleLabel,
    });
    if (stripeLink) {
      window.open(
        `${stripeLink}?client_reference_id=${receiptId}`,
        "_blank",
        "noopener"
      );
    } else {
      // Fallback: open email pre-filled with receipt ID
      window.location.href = `mailto:support@offolabs.com?subject=Full%20Risk%20Report%20Request&body=Receipt%20ID%3A%20${receiptId}%0A%0APlease%20send%20payment%20instructions%20for%20the%20%2439%20Full%20Risk%20Report.`;
    }
  };

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Urgency banner */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold bg-amber-500 text-white px-2.5 py-1 rounded-full">
            This week only · Limited to first 15 reports
          </span>
        </div>

        {/* Headline */}
        <h3 className="text-base font-bold text-gray-900 mb-1">
          Want the full risk report?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Your quick analysis is ready. Avoid a costly mistake — get a full battery, accident, recall + personalized deal rating from our team.
          {vehicleLabel && (
            <span className="font-medium text-gray-800"> For your {vehicleLabel}.</span>
          )}
        </p>

        {/* Benefits */}
        <ul className="space-y-2 mb-5">
          {BENEFITS.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <Icon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
        >
          <Shield className="w-4 h-4" />
          Get Full Risk Report — $39 one-time
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">
          One-time payment · No subscription · Manual delivery within 48h
        </p>
      </div>
    </div>
  );
}
