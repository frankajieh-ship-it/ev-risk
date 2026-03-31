"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsent } from "@/hooks/useConsent";

/**
 * CCPA/GDPR cookie consent banner.
 * - Hidden until consent state is unknown (avoids flash on return visits).
 * - "Accept" fires GA via window.gtag consent update.
 * - "Decline" keeps GA in denied state.
 * - Shown once; choice persists in localStorage.
 */
export default function CookieConsent() {
  const { consent, grant, deny } = useConsent();
  const [visible, setVisible] = useState(false);

  // Only show after hydration and only if no stored choice
  useEffect(() => {
    if (consent === null) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [consent]);

  const handleAccept = () => {
    grant();
    setVisible(false);
    // Upgrade GA consent
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      (window as any).gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
      });
    }
  };

  const handleDecline = () => {
    deny();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
    >
      <div className="max-w-2xl mx-auto bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-300 flex-1 leading-relaxed">
          We use cookies to analyze traffic and improve your experience.{" "}
          <Link
            href="/privacy"
            className="underline text-gray-400 hover:text-white transition-colors"
          >
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
