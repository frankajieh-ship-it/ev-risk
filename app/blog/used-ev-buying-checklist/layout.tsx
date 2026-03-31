import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "Used EV Buying Checklist: 10 Things to Check Before You Buy";
const ogSubtitle = "10 things to check before buying a used EV.";

export const metadata: Metadata = {
  title: "Used EV Buying Checklist: 10 Things to Check Before You Buy",
  description:
    "Buying a used electric car? This 10-point checklist covers battery health, charging capability, recall status, and everything else you need to verify before signing.",
  alternates: {
    canonical: `${SITE_URL}/blog/used-ev-buying-checklist`,
  },
  openGraph: {
    title: ogTitle,
    description:
      "Buying a used electric car? This 10-point checklist covers battery health, charging capability, recall status, and everything else you need to verify before signing.",
    url: `${SITE_URL}/blog/used-ev-buying-checklist`,
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
    description:
      "Buying a used electric car? This 10-point checklist covers battery health, charging capability, recall status, and everything else you need to verify before signing.",
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function UsedEVChecklistLayout({
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
            headline:
              "Used EV Buying Checklist: 10 Things to Check Before You Buy",
            description:
              "Buying a used electric car? This 10-point checklist covers battery health, charging capability, recall status, and everything else you need to verify before signing.",
            url: `${SITE_URL}/blog/used-ev-buying-checklist`,
            datePublished: "2026-03-01",
            dateModified: "2026-03-01",
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
              "@id": `${SITE_URL}/blog/used-ev-buying-checklist`,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
