"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DEMO_REPORTS, DEMO_METADATA } from "@/lib/demo-data";
import { ResultPageV2Split } from "@/components/ResultPageV2Split";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface DemoReportClientProps {
  slug: string;
}

export default function DemoReportClient({ slug }: DemoReportClientProps) {
  const { trackEvent } = useEventTracking();
  const demoReport = DEMO_REPORTS[slug];
  const metadata = DEMO_METADATA[slug];

  // Track demo report view on mount
  useEffect(() => {
    trackEvent("demo_report_viewed", {
      demo_slug: slug,
      demo_title: metadata.title,
      demo_verdict: metadata.expected_verdict,
    });
  }, [slug, metadata.title, metadata.expected_verdict, trackEvent]);

  // Mock tracking function for demo (no analytics sent)
  const mockTrackEvent = (name: string, data?: Record<string, any>) => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Demo] Track event:", name, data);
    }
  };

  const handleBannerCTA = () => {
    trackEvent("demo_cta_clicked", {
      cta_location: "top_banner",
      demo_slug: slug,
    });
  };

  const handleFooterCTA = () => {
    trackEvent("demo_cta_clicked", {
      cta_location: "bottom_footer",
      demo_slug: slug,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Banner - Always Visible */}
      <div className="sticky top-0 z-50 bg-blue-600 border-b border-blue-700 shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-white font-semibold text-sm md:text-base">
                  Demo Report - {metadata.vehicle}
                </p>
                <p className="text-blue-100 text-xs md:text-sm">
                  This is a sample analysis. Your real report will look exactly like this.
                </p>
              </div>
            </div>
            <Link href="/routine" onClick={handleBannerCTA}>
              <button className="bg-white text-blue-600 px-4 py-2 md:px-6 md:py-2.5 rounded-lg font-semibold text-sm md:text-base hover:bg-blue-50 transition-colors whitespace-nowrap">
                Analyze Your Vehicle →
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Back to Demo Grid */}
      <div className="container mx-auto px-4 py-4">
        <Link href="/demo" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to All Demos
        </Link>
      </div>

      {/* Actual Report Display - Reuses Production Component */}
      <ResultPageV2Split
        contract={demoReport}
        trackEvent={mockTrackEvent}
        sessionId={null}
        isUnlocked={true}  // Always unlocked in demo
        paymentsEnabled={false}  // No payment gate
        anonId="demo-user"
        reportId={null}  // No PDF download for demos
        isPollingPayment={false}
      />

      {/* Sticky CTA Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-t border-blue-700 shadow-2xl z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="text-center md:text-left">
              <p className="text-white font-semibold text-base md:text-lg">
                Ready to analyze your own vehicle?
              </p>
              <p className="text-blue-100 text-xs md:text-sm">
                Get your personalized EV risk analysis in minutes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/demo">
                <button className="bg-blue-500 bg-opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-opacity-70 transition-colors">
                  View Other Demos
                </button>
              </Link>
              <Link href="/routine" onClick={handleFooterCTA}>
                <button className="bg-white text-blue-600 px-6 py-2.5 rounded-lg font-semibold text-base hover:bg-blue-50 transition-colors flex items-center gap-2">
                  Start Your Analysis
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Add bottom padding to prevent content from being hidden behind sticky footer */}
      <div className="h-24"></div>
    </div>
  );
}
