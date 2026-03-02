"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import ExampleAnalysisSection from "@/components/landing/ExampleAnalysisSection";
import UniqueAdvantageSection from "@/components/landing/UniqueAdvantageSection";
import PricingSection from "@/components/landing/PricingSection";

export default function Home() {
  const router = useRouter();
  const { trackEvent, trackLandingView, trackCTAClick } = useEventTracking();

  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  useEffect(() => {
    trackLandingView();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyzeListing = (url: string) => {
    trackCTAClick("landing_analyze_listing");
    trackEvent("landing_url_submitted", { url_length: url.length });
    router.push(`/receipt?url=${encodeURIComponent(url)}&src=landing`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />
      <HeroSection onAnalyze={handleAnalyzeListing} />
      <HowItWorksSection />
      <ExampleAnalysisSection />
      <UniqueAdvantageSection />
      <PricingSection />
      <Footer />
    </div>
  );
}
