"use client";

/**
 * PasteBox — Client island for SEO pages
 *
 * Tiny interactive component: textarea + submit button.
 * Stores listing text and page_source in sessionStorage,
 * then navigates to /receipt.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

interface PasteBoxProps {
  pageSource: string;
  ctaButtonText: string;
  ctaPlaceholder: string;
}

export default function PasteBox({
  pageSource,
  ctaButtonText,
  ctaPlaceholder,
}: PasteBoxProps) {
  const router = useRouter();
  const { trackEvent } = useEventTracking();
  useVisitorTracking();

  const [listingText, setListingText] = useState("");

  useEffect(() => {
    trackEvent("page_view", { page_source: pageSource });
  }, [trackEvent, pageSource]);

  const handleSubmit = () => {
    if (!listingText.trim() || listingText.trim().length < 20) return;

    trackEvent("listing_paste_submitted", {
      page_source: pageSource,
      text_length: listingText.trim().length,
    });

    sessionStorage.setItem("offo_listing_text", listingText.trim());
    sessionStorage.setItem("offo_page_source", pageSource);
    router.push("/receipt");
  };

  return (
    <div>
      <textarea
        value={listingText}
        onChange={(e) => setListingText(e.target.value)}
        placeholder={ctaPlaceholder}
        rows={6}
        maxLength={8000}
        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm resize-none focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 mb-3"
      />
      <button
        onClick={handleSubmit}
        disabled={listingText.trim().length < 20}
        className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
          listingText.trim().length >= 20
            ? "bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg hover:shadow-blue-200"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        {ctaButtonText}
        <ArrowRight className="w-4 h-4" />
      </button>
      <p className="text-xs text-gray-400 text-center mt-2">
        Free &mdash; no sign-up required
      </p>
    </div>
  );
}
