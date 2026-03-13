/**
 * SEO Page Content Types
 *
 * Shared interfaces for the checklist and guide content registries.
 * Used by SeoToolPageTemplate and dynamic route pages.
 */

export interface ChecklistItem {
  icon: string; // lucide-react icon name (e.g. "Battery")
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SeoPageContent {
  slug: string;
  routeType: "checklists" | "guides";

  // Metadata
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  canonical: string;

  // Hero
  headline: string;
  subheadline: string;
  badgeText: string;

  // Body
  bullets: ChecklistItem[];

  // FAQ
  faq: FaqItem[];

  // CTA
  ctaHeadline: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaPlaceholder: string;

  // Sample preview
  showSamplePreview: boolean;

  // Attribution
  pageSource: string;

  // Dates (for Article JSON-LD)
  publishedDate?: string;
  modifiedDate?: string;

  // CTA type: "paste" = PasteBox (default), "evfit" = EVFit link button
  ctaType?: "evfit" | "paste";

  // Pillar grouping for hub index
  pillar?: "no-home-charging" | "winter-ev-routine" | "budget-evs" | "used-ev-proof-checklist";
}
