import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

const title = "Best Used EVs Under $25K in 2025";
const description =
  "The used EV market has shifted dramatically. Here are the models that deliver the most range, reliability, and resale value under $25,000 — and the ones to avoid.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog/best-budget-evs-2025` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/blog/best-budget-evs-2025`,
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
            url: `${SITE_URL}/blog/best-budget-evs-2025`,
            datePublished: "2026-03-28",
            dateModified: "2026-03-28",
            author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/best-budget-evs-2025` },
          }),
        }}
      />
      {children}
    </>
  );
}
