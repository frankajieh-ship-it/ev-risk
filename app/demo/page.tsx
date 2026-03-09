/**
 * Demo Landing Page
 *
 * Shows 5 sample EV risk analysis scenarios.
 * Lets users explore OFFO's analysis without needing real VIN/listing data.
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DEMO_METADATA, type DemoMetadata } from "@/lib/demo-data";
import { ArrowRight, Zap, MapPin, Snowflake, TrendingUp, AlertTriangle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

const verdictColors = {
  "Good Fit": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", badge: "bg-green-500" },
  "Mixed Fit": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", badge: "bg-amber-500" },
  "High Friction": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", badge: "bg-red-500" },
};

const iconMap = {
  "tesla-model-3-green": Zap,
  "nissan-leaf-yellow": MapPin,
  "chevy-bolt-red": AlertTriangle,
  "ford-mach-e-winter": Snowflake,
  "tesla-model-y-commute": TrendingUp,
};

function DemoCard({ slug, meta, onCardClick }: { slug: string; meta: DemoMetadata; onCardClick: (slug: string, meta: DemoMetadata) => void }) {
  const colors = verdictColors[meta.expected_verdict];
  const Icon = iconMap[slug as keyof typeof iconMap] || Zap;

  return (
    <Link href={`/demo/${slug}`} onClick={() => onCardClick(slug, meta)}>
      <div className={`group relative rounded-2xl border-2 ${colors.border} ${colors.bg} overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer h-full`}>
        {/* Verdict Badge */}
        <div className="absolute top-4 right-4 z-10">
          <span className={`inline-block px-3 py-1 ${colors.badge} text-white text-xs font-semibold rounded-full`}>
            {meta.expected_verdict}
          </span>
        </div>

        <div className="p-6">
          {/* Icon */}
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colors.badge} bg-opacity-10 mb-4`}>
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
            {meta.title}
          </h3>

          {/* Vehicle */}
          <p className="text-sm font-medium text-gray-600 mb-3">
            {meta.vehicle}
          </p>

          {/* Routine */}
          <p className="text-sm text-gray-500 mb-4">
            {meta.routine}
          </p>

          {/* Key Insight */}
          <div className={`p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
            <p className="text-sm font-medium text-gray-700">
              {meta.key_insight}
            </p>
          </div>

          {/* CTA Arrow */}
          <div className="mt-4 flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
            View Full Analysis
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DemoPage() {
  const { trackEvent } = useEventTracking();

  // Track page view on mount
  useEffect(() => {
    trackEvent("demo_landing_viewed", {
      source: "organic",
    });
  }, [trackEvent]);

  const handleCardClick = (slug: string, meta: DemoMetadata) => {
    trackEvent("demo_card_clicked", {
      demo_slug: slug,
      demo_title: meta.title,
      demo_verdict: meta.expected_verdict,
    });
  };

  const handleConvertClick = () => {
    trackEvent("demo_convert_clicked", {
      source: "bottom_cta",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
              <span className="mr-2">✨</span> Try Before You Buy - 100% Free
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 text-center leading-tight">
            See <span className="text-blue-600">Exactly</span> What You Get
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 mb-6 text-center">
            Explore 5 real-world EV scenarios — no signup, no VIN required
          </p>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>Full analysis</strong> in 30 seconds</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>Real data</strong> from actual owners</strong></span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>Green/Yellow/Red</strong> verdicts</span>
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm mb-4">
            👇 Pick any scenario to see the complete OFFO report
          </p>
        </div>
      </div>

      {/* Demo Cards Grid */}
      <div className="container mx-auto px-4 pb-16">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            5 Real Scenarios, 5 Different Outcomes
          </h2>
          <p className="text-gray-600">
            From perfect fits to deal-breakers — see how OFFO catches what you'd miss
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {Object.entries(DEMO_METADATA).map(([slug, meta]) => (
            <DemoCard key={slug} slug={slug} meta={meta} onCardClick={handleCardClick} />
          ))}
        </div>

        {/* Social Proof */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-2">Trusted by EV shoppers nationwide</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
            <span>🔒 No credit card required</span>
            <span className="hidden sm:inline">•</span>
            <span>⚡ Results in &lt; 1 minute</span>
            <span className="hidden sm:inline">•</span>
            <span>📊 Transparent analysis</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Analyze Your Own Vehicle?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Get a personalized EV risk analysis in minutes
          </p>
          <Link href="/routine" onClick={handleConvertClick}>
            <button className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg">
              Start Your Analysis →
            </button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 text-sm mb-4">
            These are sample analyses for demonstration purposes.
          </p>
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
