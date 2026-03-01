import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "Used EV Buying Checklist: 10 Things to Check Before You Buy",
  description:
    "Buying a used electric car? This 10-point checklist covers battery health, charging capability, recall status, and everything else you need to verify before signing.",
  alternates: {
    canonical: `${SITE_URL}/blog/used-ev-buying-checklist`,
  },
  openGraph: {
    title: "Used EV Buying Checklist: 10 Things to Check Before You Buy",
    description:
      "Buying a used electric car? This 10-point checklist covers battery health, charging capability, recall status, and everything else you need to verify before signing.",
    url: `${SITE_URL}/blog/used-ev-buying-checklist`,
    type: "article",
    siteName: "OFFO",
  },
  twitter: {
    card: "summary",
    title: "Used EV Buying Checklist: 10 Things to Check Before You Buy",
    description:
      "Buying a used electric car? This 10-point checklist covers battery health, charging capability, recall status, and everything else you need to verify before signing.",
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
