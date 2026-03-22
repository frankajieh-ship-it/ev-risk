/**
 * PersonalConsultationCard — Book a personal EV buying consultation
 *
 * Replaces the $39 Full Risk Report card. Users leave their contact info
 * and preferred time, and arrange a 1-on-1 session with an OFFO advisor.
 */

"use client";

import { useState } from "react";
import { Phone, Loader2, ChevronDown, CheckCircle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface PersonalConsultationCardProps {
  receiptId: string;
  vehicleLabel?: string;
}

export default function PersonalConsultationCard({
  receiptId,
  vehicleLabel,
}: PersonalConsultationCardProps) {
  const { trackEvent } = useEventTracking();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleCTAClick = () => {
    trackEvent("consultation_offer_clicked", {
      receipt_id: receiptId,
      vehicle: vehicleLabel,
    });
    setShowForm(true);
    setTimeout(() => {
      document.getElementById("consultation-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please fill in your name and email.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await fetch("/api/consultation/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receiptId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          preferred_time: preferredTime.trim() || undefined,
          message: message.trim() || undefined,
          vehicle_label: vehicleLabel,
        }),
      });
    } catch {
      // Non-blocking
    }

    trackEvent("consultation_request_submitted", {
      receipt_id: receiptId,
      vehicle: vehicleLabel,
    });

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Request received!</p>
            <p className="text-xs text-gray-600 mt-0.5">
              We&apos;ll reach out to <span className="font-medium">{email}</span> within 24 hours to confirm your session.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-sm overflow-hidden">
      <div className="p-5">
        {/* Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold bg-emerald-600 text-white px-2.5 py-1 rounded-full">
            1-on-1 · Expert Session
          </span>
        </div>

        {/* Headline */}
        <h3 className="text-base font-bold text-gray-900 mb-1">
          Talk to an EV buying advisor
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Get personalised guidance on this listing — pricing, negotiation strategy, what to inspect, and whether to walk away.
          {vehicleLabel && (
            <span className="text-gray-700"> For your {vehicleLabel}.</span>
          )}
        </p>

        {/* Benefits */}
        <ul className="text-xs text-gray-500 space-y-1 mb-4">
          <li>✓ <span className="font-medium text-gray-700">30-min video or call</span> — schedule at your convenience</li>
          <li>✓ <span className="font-medium text-gray-700">VIN & listing review</span> — we dig into the details before your session</li>
          <li>✓ <span className="font-medium text-gray-700">Negotiation script</span> — personalised to this exact deal</li>
          <li>✓ Walk-away triggers + what questions to ask at the test drive</li>
        </ul>

        {/* CTA or inline form */}
        {!showForm ? (
          <button
            onClick={handleCTAClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm"
          >
            <Phone className="w-4 h-4" />
            Book a Free Consultation
          </button>
        ) : (
          <form id="consultation-form" onSubmit={handleSubmit} className="space-y-3">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />
              Leave your details and we&apos;ll reach out to arrange a time
            </p>
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
            />
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
            />
            <input
              type="tel"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
            />
            <input
              type="text"
              placeholder="Preferred time, e.g. weekday evenings (optional)"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
            />
            <textarea
              placeholder="Any specific questions or concerns? (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none resize-none"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm disabled:opacity-60"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <><Phone className="w-4 h-4" /> Request Consultation</>
              )}
            </button>
            <p className="text-center text-xs text-gray-400">
              Free · No obligation · We&apos;ll confirm within 24 hours
            </p>
          </form>
        )}

        {!showForm && (
          <p className="text-center text-xs text-gray-400 mt-2">
            Free · No obligation · We&apos;ll confirm within 24 hours
          </p>
        )}
      </div>
    </div>
  );
}
