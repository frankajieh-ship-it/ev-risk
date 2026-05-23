import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "How to Price Your Used EV Inventory (The Dealer's Guide)";
const ogSubtitle = "Battery degradation, charging port generation, recall history — the 4 factors EV buyers actually use to judge your pricing.";

export const metadata: Metadata = {
  title: "How to Price Your Used EV Inventory | OFFO for Dealers",
  description:
    "Used EV pricing isn't like ICE. Battery degradation, mileage, charging port generation, and recall history all affect what a buyer will pay. Here's how to price competitively.",
  alternates: {
    canonical: `${SITE_URL}/blog/how-to-price-used-ev-inventory`,
  },
  openGraph: {
    title: ogTitle,
    description: ogSubtitle,
    url: `${SITE_URL}/blog/how-to-price-used-ev-inventory`,
    type: "article",
    siteName: "OFFO",
    images: [
      {
        url: `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
        width: 1200,
        height: 630,
        alt: ogTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogSubtitle,
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
  },
  robots: { index: true, follow: true },
};

export default function HowToPriceUsedEvInventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: ogTitle,
              description:
                "Used EV pricing isn't like ICE. Battery degradation, mileage, charging port generation, and recall history all affect what a buyer will pay.",
              url: `${SITE_URL}/blog/how-to-price-used-ev-inventory`,
              datePublished: "2026-05-23",
              dateModified: "2026-05-23",
              author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/how-to-price-used-ev-inventory` },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
                { "@type": "ListItem", position: 3, name: "How to Price Your Used EV Inventory", item: `${SITE_URL}/blog/how-to-price-used-ev-inventory` },
              ],
            },
          ]),
        }}
      />
      {children}
    </>
  );
}
