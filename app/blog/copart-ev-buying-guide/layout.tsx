import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

const title = "Buying a Salvage EV at Copart: What the Auction Report Actually Tells You";
const description =
  "Not all salvage EVs are disasters. Hail-damaged Teslas and minor collision Bolts can be exceptional value — if you know how to read the auction report.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog/copart-ev-buying-guide` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/blog/copart-ev-buying-guide`,
    type: "article",
    siteName: "OFFO",
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}`, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/api/og?title=${encodeURIComponent(title)}`] },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: title,
            description,
            url: `${SITE_URL}/blog/copart-ev-buying-guide`,
            datePublished: "2026-04-04",
            dateModified: "2026-04-04",
            author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/copart-ev-buying-guide` },
          }),
        }}
      />
      {children}
    </>
  );
}
