/**
 * SeoToolPageTemplate — Server component for SEO landing pages
 *
 * Renders the full page layout from a SeoPageContent config.
 * Only PasteBox is a client component (interactive island).
 */

import {
  Receipt,
  ShieldCheck,
  Battery,
  FileWarning,
  CarFront,
  Zap,
  Wrench,
  DollarSign,
  UserCheck,
  AlertTriangle,
  Calendar,
  FileCheck,
  FileText,
  User,
  Building,
  Phone,
  HelpCircle,
  Thermometer,
  Activity,
  Gauge,
  Volume2,
  Smartphone,
  Plug,
  Ban,
  Clock,
  MapPin,
  Coffee,
  Snowflake,
  ArrowLeftRight,
  Brain,
  Smile,
  Heart,
  Target,
  MessageSquare,
  ThumbsUp,
} from "lucide-react";
import type { SeoPageContent } from "@/content/types";
import type { ComponentType } from "react";
import JsonLd from "./JsonLd";
import FaqSection from "./FaqSection";
import SamplePreview from "./SamplePreview";
import PasteBox from "./PasteBox";
import EvFitCta from "./EvFitCta";
import FeedbackWidget from "@/components/FeedbackWidget";

// Explicit icon map — only icons used in content registries
const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  Battery,
  FileWarning,
  CarFront,
  Zap,
  Wrench,
  DollarSign,
  UserCheck,
  AlertTriangle,
  Calendar,
  FileCheck,
  FileText,
  User,
  Building,
  Phone,
  HelpCircle,
  Thermometer,
  Activity,
  Gauge,
  Volume2,
  Smartphone,
  Plug,
  Ban,
  Clock,
  MapPin,
  Coffee,
  Snowflake,
  ArrowLeftRight,
  Brain,
  Smile,
  Heart,
  Target,
  MessageSquare,
  ThumbsUp,
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

interface SeoToolPageTemplateProps {
  content: SeoPageContent;
}

export default function SeoToolPageTemplate({
  content,
}: SeoToolPageTemplateProps) {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OFFO", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: content.routeType === "checklists" ? "Checklists" : "Guides",
        item: `${SITE_URL}/${content.routeType}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: content.title,
        item: `${SITE_URL}${content.canonical}`,
      },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: content.headline,
    description: content.metaDescription,
    url: `${SITE_URL}${content.canonical}`,
    ...(content.publishedDate && { datePublished: content.publishedDate }),
    ...(content.modifiedDate && { dateModified: content.modifiedDate }),
    author: { "@type": "Organization", name: "OFFO Lab" },
    publisher: {
      "@type": "Organization",
      name: "OFFO Lab",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={articleJsonLd} />

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <Receipt className="w-5 h-5 text-blue-600" />
          <a
            href="/"
            className="text-xs font-medium text-blue-600 uppercase tracking-wider hover:text-blue-800 transition-colors"
          >
            OFFO
          </a>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            {content.badgeText}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            {content.headline}
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            {content.subheadline}
          </p>
        </div>

        {/* CTA Section — ABOVE FOLD */}
        <div className="mb-10">
          {content.ctaType === "evfit" ? (
            <EvFitCta
              headline={content.ctaHeadline}
              description={content.ctaDescription}
              buttonText={content.ctaButtonText}
              pageSlug={content.slug}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {content.ctaHeadline}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {content.ctaDescription}
              </p>
              <PasteBox
                pageSource={content.pageSource}
                ctaButtonText={content.ctaButtonText}
                ctaPlaceholder={content.ctaPlaceholder}
              />
            </div>
          )}
        </div>

        {/* "What to verify" bullets */}
        <div className="space-y-4 mb-10">
          {content.bullets.map((item, i) => {
            const Icon = iconMap[item.icon] || ShieldCheck;
            return (
              <div
                key={i}
                className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sample Preview */}
        {content.showSamplePreview && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Example Analysis
            </h2>
            <SamplePreview />
          </div>
        )}

        {/* FAQ */}
        {content.faq.length > 0 && (
          <div className="mb-10">
            <FaqSection items={content.faq} />
          </div>
        )}

        {/* Feedback */}
        <div className="mb-10">
          <FeedbackWidget contextType="seo_page" contextId={content.slug} />
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-6 border-t border-gray-100">
          <p>
            OFFO provides AI-powered analysis for informational purposes only.
            Not financial, legal, or automotive advice.
          </p>
        </div>
      </div>
    </div>
  );
}
