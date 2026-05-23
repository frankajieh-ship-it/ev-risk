import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "What OFFO Buyers Look for in a Used EV (Dealer Edition)";
const ogSubtitle = "Battery health, title status, range vs. charging fit, price vs. market — the 5 things every data-driven EV buyer checks before contacting a dealer.";

export const metadata: Metadata = {
  title: "What OFFO Buyers Look for in a Used EV | For Dealers",
  description:
    "OFFO buyers are data-driven and charging-aware. Here are the 5 things they check on every receipt — and how dealers can optimize listings to score well.",
  alternates: {
    canonical: `${SITE_URL}/blog/what-offo-buyers-look-for`,
  },
  openGraph: {
    title: ogTitle,
    description: ogSubtitle,
    url: `${SITE_URL}/blog/what-offo-buyers-look-for`,
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

export default function WhatOFFOBuyersLookForLayout({ children }: { children: React.ReactNode }) {
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
                "OFFO buyers are data-driven and charging-aware. Here are the 5 things they check on every receipt — and how dealers can optimize listings to score well.",
              url: `${SITE_URL}/blog/what-offo-buyers-look-for`,
              datePublished: "2026-05-23",
              dateModified: "2026-05-23",
              author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/what-offo-buyers-look-for` },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
                { "@type": "ListItem", position: 3, name: "What OFFO Buyers Look For", item: `${SITE_URL}/blog/what-offo-buyers-look-for` },
              ],
            },
          ]),
        }}
      />
      {children}
    </>
  );
}
