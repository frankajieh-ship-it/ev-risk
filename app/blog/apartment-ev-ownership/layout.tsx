import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

const title = "Can You Own an EV Without a Garage? A Realistic Guide";
const description =
  "Over 40 million Americans rent without private parking. Here's an honest look at apartment EV ownership: when it works, when it doesn't, and what infrastructure you actually need.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog/apartment-ev-ownership` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/blog/apartment-ev-ownership`,
    type: "article",
    siteName: "OFFO",
  },
  twitter: { card: "summary_large_image", title, description },
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
            url: `${SITE_URL}/blog/apartment-ev-ownership`,
            datePublished: "2026-02-20",
            dateModified: "2026-02-20",
            author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/apartment-ev-ownership` },
          }),
        }}
      />
      {children}
    </>
  );
}
