import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

const title = "How OFFO Scores EV Fit: The Full Methodology";
const description =
  "OFFO's EV fit score combines 8 factors: commute distance, climate zone, charging access, vehicle range, driving patterns, home ownership, budget, and flexibility.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog/ev-fit-score-explained` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/blog/ev-fit-score-explained`,
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
            url: `${SITE_URL}/blog/ev-fit-score-explained`,
            datePublished: "2026-02-01",
            dateModified: "2026-02-01",
            author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/ev-fit-score-explained` },
          }),
        }}
      />
      {children}
    </>
  );
}
