import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "Used Tesla Model Y Buyer Checklist (2026): 12 Things to Check Before You Buy";
const ogSubtitle = "Recalls, battery health, FSD transfer, known problems — full pre-purchase checklist.";

export const metadata: Metadata = {
  title: "Used Tesla Model Y Buyer Checklist (2026): 12 Things to Check Before You Buy",
  description:
    "Before buying a used Tesla Model Y, check these 12 things: open recalls, battery health estimate, FSD transfer status, heat pump issues, MCU generation, and the 4 model years to target vs. avoid.",
  alternates: {
    canonical: `${SITE_URL}/blog/used-model-y-buyer-checklist`,
  },
  openGraph: {
    title: ogTitle,
    description:
      "Before buying a used Tesla Model Y, check these 12 things: open recalls, battery health estimate, FSD transfer status, heat pump issues, MCU generation, and the 4 model years to target vs. avoid.",
    url: `${SITE_URL}/blog/used-model-y-buyer-checklist`,
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
      "Before buying a used Tesla Model Y, check these 12 things: open recalls, battery health estimate, FSD transfer status, heat pump issues, and model years to target vs. avoid.",
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function UsedModelYChecklistLayout({
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
            headline: ogTitle,
            description:
              "Before buying a used Tesla Model Y, check these 12 things: open recalls, battery health estimate, FSD transfer status, heat pump issues, MCU generation, and the 4 model years to target vs. avoid.",
            url: `${SITE_URL}/blog/used-model-y-buyer-checklist`,
            datePublished: "2026-05-02",
            dateModified: "2026-05-02",
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
              "@id": `${SITE_URL}/blog/used-model-y-buyer-checklist`,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
