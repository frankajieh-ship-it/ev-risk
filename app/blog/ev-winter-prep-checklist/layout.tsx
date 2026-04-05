import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

const title = "Winter EV Prep: 10 Things to Do Before the First Frost";
const description =
  "Cold weather cuts EV range 20–40%. These 10 steps — done once before winter — prevent most cold-weather surprises and keep your battery healthy through spring.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog/ev-winter-prep-checklist` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/blog/ev-winter-prep-checklist`,
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
            url: `${SITE_URL}/blog/ev-winter-prep-checklist`,
            datePublished: "2026-03-10",
            dateModified: "2026-03-10",
            author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/ev-winter-prep-checklist` },
          }),
        }}
      />
      {children}
    </>
  );
}
