"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "offo_copart_banner_dismissed";

export default function CopartBanner() {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    try {
      setDismissed(!!localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800">
      <span>
        New:{" "}
        <a href="/copart" className="font-semibold underline hover:text-orange-900">
          Copart Auction Fit &amp; Risk Checks
        </a>{" "}
        — paste any Copart lot link for instant analysis
      </span>
      <button onClick={handleDismiss} aria-label="Dismiss" className="flex-shrink-0 text-orange-400 hover:text-orange-600">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
