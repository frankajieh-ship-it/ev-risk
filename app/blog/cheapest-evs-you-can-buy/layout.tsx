import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "Cheapest EVs You Can Buy in 2026 (Under $15K, Real-World Tested)";
const ogSubtitle = "Chevy Bolt, Nissan Leaf, VW e-Golf, Kia Soul EV — the honest breakdown of which cheap EVs are actually worth it.";

export const metadata: Metadata = {
  title: "Cheapest EVs You Can Buy in 2026 (Under $15K) | OFFO",
  description:
    "The honest guide to cheap EVs under $15K in 2026 — Chevy Bolt, Nissan Leaf, VW e-Golf, and Kia Soul EV. Which ones are real deals and which are money pits.",
  alternates: {
    canonical: `${SITE_URL}/blog/cheapest-evs-you-can-buy`,
  },
  openGraph: {
    title: ogTitle,
    description: ogSubtitle,
    url: `${SITE_URL}/blog/cheapest-evs-you-can-buy`,
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

export default function CheapestEvsLayout({ children }: { children: React.ReactNode }) {
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
                "The honest guide to cheap EVs under $15K in 2026 — Chevy Bolt, Nissan Leaf, VW e-Golf, and Kia Soul EV.",
              url: `${SITE_URL}/blog/cheapest-evs-you-can-buy`,
              datePublished: "2026-05-09",
              dateModified: "2026-05-09",
              author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/cheapest-evs-you-can-buy` },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
                { "@type": "ListItem", position: 3, name: "Cheapest EVs You Can Buy", item: `${SITE_URL}/blog/cheapest-evs-you-can-buy` },
              ],
            },
          ]),
        }}
      />
      {children}
    </>
  );
}
