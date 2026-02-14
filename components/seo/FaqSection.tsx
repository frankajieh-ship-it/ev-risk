/**
 * FaqSection — Server component for FAQ accordion + JSON-LD
 */

import type { FaqItem } from "@/content/types";
import JsonLd from "./JsonLd";

interface FaqSectionProps {
  items: FaqItem[];
  includeJsonLd?: boolean;
}

export default function FaqSection({
  items,
  includeJsonLd = true,
}: FaqSectionProps) {
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section>
      {includeJsonLd && <JsonLd data={jsonLdData} />}
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="group bg-white border border-gray-200 rounded-xl overflow-hidden"
          >
            <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors list-none flex items-center justify-between">
              {item.question}
              <span className="text-gray-400 group-open:rotate-180 transition-transform ml-2">
                &#9662;
              </span>
            </summary>
            <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
