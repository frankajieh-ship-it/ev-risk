"use client";

import { useEventTracking } from "@/hooks/useEventTracking";

interface EvFitCtaProps {
  headline: string;
  description: string;
  buttonText: string;
  pageSlug: string;
}

export default function EvFitCta({
  headline,
  description,
  buttonText,
  pageSlug,
}: EvFitCtaProps) {
  const { trackEvent } = useEventTracking();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-1">{headline}</h2>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <a
        href="/routine"
        onClick={() =>
          trackEvent("content_cta_clicked", { page_slug: pageSlug, cta_type: "evfit" })
        }
        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
      >
        {buttonText} →
      </a>
    </div>
  );
}
