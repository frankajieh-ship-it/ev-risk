import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "EV VIN Report: What It Shows, What It Misses, and the Free Tool That Does It Better";
const ogSubtitle = "Standard VIN reports miss battery degradation, DCFC capability, and EV-specific recalls. Here's what to check instead.";

export const metadata: Metadata = {
  title: "EV VIN Report: What It Shows, What It Misses, and the Free Tool That Does It Better | OFFO",
  description:
    "A standard VIN report doesn't show battery degradation, DC fast charge capability, or EV-specific recalls. Here's what an EV VIN report should cover — and the free tool that does it.",
  alternates: {
    canonical: `${SITE_URL}/blog/ev-vin-report-guide`,
  },
  openGraph: {
    title: ogTitle,
    description: ogSubtitle,
    url: `${SITE_URL}/blog/ev-vin-report-guide`,
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

export default function EvVinReportGuideLayout({ children }: { children: React.ReactNode }) {
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
                "A standard VIN report doesn't show battery degradation, DC fast charge capability, or EV-specific recalls. Here's what an EV VIN report should cover — and the free tool that does it.",
              url: `${SITE_URL}/blog/ev-vin-report-guide`,
              datePublished: "2026-05-09",
              dateModified: "2026-05-09",
              author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
              mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/ev-vin-report-guide` },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
                { "@type": "ListItem", position: 3, name: "EV VIN Report Guide", item: `${SITE_URL}/blog/ev-vin-report-guide` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What is an EV VIN report?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "An EV VIN report is a vehicle history report that includes electric-vehicle-specific data points beyond what standard services like Carfax show — including battery degradation estimates, DC fast charge capability, EV-specific recall completion, and charging connector type. Services like OFFO generate EV VIN reports for free.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Does Carfax show battery health for used EVs?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "No. Carfax does not show battery health, state of health (SOH), battery chemistry, or charging speed capability for used electric vehicles. You need an EV-specific service like OFFO to get that information.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is an EV VIN report free?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "OFFO provides a free EV VIN report by pasting any used EV listing URL. The free report includes open recalls, accident history, battery health estimate, and market price comparison. A full detailed report with negotiation scripts is available free.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What should an EV VIN report include?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "A thorough EV VIN report should include: (1) open recall status and completion rate, (2) accident and title history, (3) battery degradation estimate or state-of-health, (4) DC fast charge capability in kW, (5) connector type (NACS, CCS, CHAdeMO), (6) battery chemistry (LFP vs NMC), (7) market price vs comparables, and (8) EV-specific red flags like flood exposure or salvage title.",
                  },
                },
              ],
            },
          ]),
        }}
      />
      {children}
    </>
  );
}
