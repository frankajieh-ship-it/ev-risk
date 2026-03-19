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

import { Shield } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface FullRiskReportCardProps {
  receiptId: string;
  vehicleLabel?: string;
}

export default function FullRiskReportCard({ receiptId, vehicleLabel }: FullRiskReportCardProps) {
  const { trackEvent } = useEventTracking();

  const stripeLink = process.env.NEXT_PUBLIC_FULL_RISK_REPORT_STRIPE_LINK;
  const formLink = process.env.NEXT_PUBLIC_FULL_RISK_REPORT_FORM_LINK;

  const vehicleStr = vehicleLabel ? encodeURIComponent(vehicleLabel) : "My%20Vehicle";
  const intakeHref = formLink
    ? `${formLink}?receipt_id=${receiptId}`
    : `mailto:support@offolabs.com?subject=Full%20Risk%20Report%20%E2%80%94%20${vehicleStr}&body=Receipt%20ID%3A%20${receiptId}%0Alisting%20URL%20or%20VIN%3A%20`;

  const handleClick = () => {
    trackEvent("deep_dive_offer_clicked", {
      receipt_id: receiptId,
      offer_type: "full_risk_report_39",
      vehicle: vehicleLabel,
    });
    if (stripeLink) {
      window.open(`${stripeLink}?client_reference_id=${receiptId}`, "_blank", "noopener");
    } else {
      window.location.href = intakeHref;
    }
  };

  const handleIntakeClick = () => {
    trackEvent("deep_dive_offer_clicked", {
      receipt_id: receiptId,
      offer_type: "full_risk_report_intake",
      vehicle: vehicleLabel,
    });
  };

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Urgency banner */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold bg-amber-500 text-white px-2.5 py-1 rounded-full">
            This week only · Limited to first 15 reports
          </span>
        </div>

        {/* Headline */}
        <h3 className="text-base font-bold text-gray-900 mb-1">
          Your quick analysis is ready.
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Want the full risk report + personalized deal rating to avoid a costly mistake?{" "}
          <span className="font-semibold text-gray-800">$39 one-time.</span>
          {vehicleLabel && (
            <span className="text-gray-700"> For your {vehicleLabel}.</span>
          )}
        </p>

        {/* Single tight benefit line */}
        <p className="text-xs text-gray-500 mb-4">
          Full battery · accident · recall history + Fair / Good / Great deal rating. PDF delivered to your inbox in 48h.
        </p>

        {/* CTA */}
        <button
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
        >
          <Shield className="w-4 h-4" />
          Get Full Risk Report — $39 one-time
        </button>

        {/* Post-payment intake link — shown when Stripe link is configured */}
        {stripeLink && (
          <p className="text-center text-xs text-gray-400 mt-2">
            After payment,{" "}
            <a
              href={intakeHref}
              onClick={handleIntakeClick}
              className="underline hover:text-gray-600 transition-colors"
            >
              submit your listing here →
            </a>
          </p>
        )}

        {!stripeLink && (
          <p className="text-center text-xs text-gray-400 mt-2">
            One-time payment · No subscription · Manual delivery within 48h
          </p>
        )}
      </div>
    </div>
  );
}
