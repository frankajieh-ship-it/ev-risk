import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "Navigating the Used EV Market: Inventory Lows & Charging Challenges";
const ogSubtitle = "Tight inventory, elevated prices, charging anxiety — how to find a real deal without buying a lemon.";

export const metadata: Metadata = {
  title: "Navigating the Used EV Market: Inventory Lows & Charging Challenges [Podcast]",
  description:
    "A discussion on low used EV inventory, what's driving it, and how to find deals without getting burned on charging infrastructure or battery health.",
  alternates: {
    canonical: `${SITE_URL}/blog/navigating-used-ev-market`,
  },
  openGraph: {
    title: ogTitle,
    description:
      "Inventory is tight, prices are still elevated, and charging anxiety is real. Here's how to navigate the used EV market right now — without overpaying or buying a lemon.",
    url: `${SITE_URL}/blog/navigating-used-ev-market`,
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
      "Inventory is tight, prices are still elevated, and charging anxiety is real. How to navigate the used EV market without overpaying or buying a lemon.",
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function NavigatingUsedEvMarketLayout({
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
            "@type": "PodcastEpisode",
            name: ogTitle,
            description:
              "A discussion on low used EV inventory, what's driving it, and how to find deals without getting burned on charging infrastructure or battery health.",
            url: `${SITE_URL}/blog/navigating-used-ev-market`,
            datePublished: "2026-05-09",
            associatedMedia: {
              "@type": "MediaObject",
              contentUrl: `${SITE_URL}/podcasts/navigating-used-ev-market.mp3`,
              encodingFormat: "audio/mpeg",
            },
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
              "@id": `${SITE_URL}/blog/navigating-used-ev-market`,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
