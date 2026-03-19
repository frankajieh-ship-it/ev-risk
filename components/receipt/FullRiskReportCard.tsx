/**
 * FullRiskReportCard — $39 manual "Full Risk Report" upsell
 *
 * Shows after the basic receipt result for non-unlocked users.
 * Clicking CTA opens an inline intake form (email + listing URL/VIN),
 * submits those details to /api/full-risk-report/intake, then redirects
 * to the Stripe Payment Link (or mailto fallback).
 */

"use client";

import { useState } from "react";
import { Shield, Loader2, ChevronDown } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface FullRiskReportCardProps {
  receiptId: string;
  vehicleLabel?: string;
}

export default function FullRiskReportCard({ receiptId, vehicleLabel }: FullRiskReportCardProps) {
  const { trackEvent } = useEventTracking();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [listingInput, setListingInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const stripeLink = process.env.NEXT_PUBLIC_FULL_RISK_REPORT_STRIPE_LINK;

  const handleCTAClick = () => {
    trackEvent("deep_dive_offer_clicked", {
      receipt_id: receiptId,
      offer_type: "full_risk_report_39",
      vehicle: vehicleLabel,
    });
    setShowForm(true);
    setTimeout(() => {
      document.getElementById("frr-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !listingInput.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await fetch("/api/full-risk-report/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receiptId,
          email: email.trim(),
          listing_input: listingInput.trim(),
          vehicle_label: vehicleLabel,
        }),
      });
    } catch {
      // Non-blocking — still proceed to payment
    }

    trackEvent("deep_dive_purchase_succeeded", {
      receipt_id: receiptId,
      offer_type: "full_risk_report_39",
      vehicle: vehicleLabel,
    });

    // Redirect to Stripe or mailto
    if (stripeLink) {
      window.location.href = `${stripeLink}?client_reference_id=${receiptId}&prefilled_email=${encodeURIComponent(email.trim())}`;
    } else {
      const vehicleStr = vehicleLabel ? encodeURIComponent(vehicleLabel) : "My%20Vehicle";
      const body = encodeURIComponent(
        `Receipt ID: ${receiptId}\nEmail: ${email.trim()}\nListing URL / VIN: ${listingInput.trim()}\nVehicle: ${vehicleLabel || "Not specified"}`
      );
      window.location.href = `mailto:support@offolabs.com?subject=Full%20Risk%20Report%20%E2%80%94%20${vehicleStr}&body=${body}`;
    }

    setSubmitting(false);
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

        {/* CTA or intake form */}
        {!showForm ? (
          <button
            onClick={handleCTAClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
          >
            <Shield className="w-4 h-4" />
            Get Full Risk Report — $39 one-time
          </button>
        ) : (
          <form id="frr-form" onSubmit={handleSubmit} className="space-y-3">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
              Where should we send your report?
            </p>
            <input
              type="email"
              required
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
            />
            <input
              type="text"
              required
              placeholder="Listing URL or VIN"
              value={listingInput}
              onChange={(e) => setListingInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none font-mono"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm disabled:opacity-60"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to payment...</>
              ) : (
                <><Shield className="w-4 h-4" /> Continue to Payment — $39</>
              )}
            </button>
            <p className="text-center text-xs text-gray-400">
              One-time payment · No subscription · Report in 48h
            </p>
          </form>
        )}

        {!showForm && (
          <p className="text-center text-xs text-gray-400 mt-2">
            One-time payment · No subscription · Manual delivery within 48h
          </p>
        )}
      </div>
    </div>
  );
}
