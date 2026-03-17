import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "Three Months of OFFO: What 286 Real EV Fit Checks Revealed",
  description:
    "Data from 286 real EV fit checks: which vehicles buyers compare most, what questionnaire fields matter, and what the numbers say about EV readiness in 2026.",
  alternates: {
    canonical: `${SITE_URL}/blog/offo-ev-fit-check-insights`,
  },
  openGraph: {
    title: "Three Months of OFFO: What 286 Real EV Fit Checks Revealed",
    description:
      "Data from 286 real EV fit checks: which vehicles buyers compare most, what questionnaire fields matter, and what the numbers say about EV readiness in 2026.",
    url: `${SITE_URL}/blog/offo-ev-fit-check-insights`,
    type: "article",
    siteName: "OFFO",
  },
  twitter: {
    card: "summary",
    title: "Three Months of OFFO: What 286 Real EV Fit Checks Revealed",
    description:
      "Data from 286 real EV fit checks: which vehicles buyers compare most, what questionnaire fields matter, and what the numbers say about EV readiness in 2026.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function OFFOInsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: "Three Months of OFFO: What 286 Real EV Fit Checks Revealed",
            description:
              "Data from 286 real EV fit checks: which vehicles buyers compare most, what questionnaire fields matter, and what the numbers say about EV readiness in 2026.",
            url: `${SITE_URL}/blog/offo-ev-fit-check-insights`,
            datePublished: "2026-03-17",
            dateModified: "2026-03-17",
            author: {
              "@type": "Organization",
              name: "OFFO Lab",
              url: SITE_URL,
            },
            publisher: {
              "@type": "Organization",
              name: "OFFO Lab",
              url: SITE_URL,
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `${SITE_URL}/blog/offo-ev-fit-check-insights`,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
