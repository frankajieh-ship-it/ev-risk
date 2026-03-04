"use client";

/**
 * AdComparePageClient — Reddit ad landing page for EV6 vs Model 3
 *
 * Renders:
 *  1. Hero section with headline and value prop
 *  2. Pre-populated CompareView with hardcoded receipt data
 *  3. CTA section funneling to /receipt
 *  4. Trust/social proof section
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Zap } from "lucide-react";
import CompareView from "@/components/receipt/CompareView";
import PasteBox from "@/components/seo/PasteBox";
import Header from "@/components/landing/Header";
import { KIA_EV6_RECEIPT, TESLA_MODEL3_RECEIPT } from "@/content/ad-listings";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

const PAGE_SOURCE = "ad:reddit:compare_ev6_model3";

export default function AdComparePageClient() {
  const { trackEvent, trackCTAClick, trackScrollDepth } = useEventTracking();
  useVisitorTracking();

  const hasTrackedView = useRef(false);
  const scrollMilestones = useRef(new Set<number>());

  // Track page view once
  useEffect(() => {
    if (!hasTrackedView.current) {
      trackEvent("ad_landing_view", {
        page_source: PAGE_SOURCE,
        ad_campaign: "compare_ev6_model3",
      });
      hasTrackedView.current = true;
    }
  }, [trackEvent]);

  // Scroll depth tracking (25%, 50%, 75%, 100%)
  useEffect(() => {
    const handleScroll = () => {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const scrollPct = Math.round((window.scrollY / scrollable) * 100);
      for (const milestone of [25, 50, 75, 100]) {
        if (scrollPct >= milestone && !scrollMilestones.current.has(milestone)) {
          scrollMilestones.current.add(milestone);
          trackScrollDepth(milestone, "/ad/compare-ev6-model3");
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [trackScrollDepth]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Section 1: Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <Shield className="w-3.5 h-3.5" />
            Side-by-Side Risk Comparison
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">
            2025 Kia EV6 vs 2023 Tesla Model 3
          </h1>
          <p className="text-base text-gray-600 leading-relaxed max-w-xl mx-auto">
            Same price range, very different risk profiles. One listing got a
            GREEN verdict. The other timed out entirely. See what OFFO found.
          </p>
        </div>

        {/* Section 2: Pre-populated CompareView */}
        <div className="mb-10">
          <CompareView
            receiptA={KIA_EV6_RECEIPT}
            receiptB={TESLA_MODEL3_RECEIPT}
          />
        </div>

        {/* Section 3: Primary CTA */}
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Try it with your own listing
            </h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Paste any used car listing and get a verdict, risk flags, and
            must-ask questions in seconds. Free, no sign-up.
          </p>
          <PasteBox
            pageSource={PAGE_SOURCE}
            ctaButtonText="Check My Listing"
            ctaPlaceholder={
              "Paste any listing here...\n\nExample:\n2024 Hyundai Ioniq 5 SE\n12,000 miles — $28,500\nClean title, 1 owner\nAustin, TX"
            }
          />
        </div>

        {/* Secondary CTA — direct link */}
        <div className="text-center mb-10">
          <Link
            href="/receipt"
            onClick={() => trackCTAClick("ad_try_own_listing")}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Or go to the full receipt tool
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Section 4: Trust / What is OFFO */}
        <div className="border-t border-gray-200 pt-8 mb-8">
          <h3 className="text-base font-bold text-gray-900 mb-4 text-center">
            What is OFFO?
          </h3>
          <div className="space-y-3">
            {[
              {
                title: "Paste any listing",
                desc: "From CarGurus, Autotrader, Facebook Marketplace, Craigslist, or any dealer site.",
              },
              {
                title: "Get a risk receipt",
                desc: "AI analyzes the listing for red flags, pricing issues, and missing information.",
              },
              {
                title: "Know what to ask",
                desc: "Get must-ask questions and a negotiation opener specific to the listing.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-6 border-t border-gray-100 pb-8">
          <p>
            OFFO provides AI-powered analysis for informational purposes only.
            Not financial, legal, or automotive advice.
          </p>
        </div>
      </div>
    </div>
  );
}
