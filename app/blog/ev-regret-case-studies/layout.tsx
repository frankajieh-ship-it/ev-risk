import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

const title = "5 People Who Regretted Buying an EV — And Exactly Why";
const description =
  "Real stories from EV owners who didn't love the experience. Common threads: no home charging, underestimated cold weather, wrong model for the use case.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog/ev-regret-case-studies` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/blog/ev-regret-case-studies`,
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
            url: `${SITE_URL}/blog/ev-regret-case-studies`,
            datePublished: "2026-01-15",
            dateModified: "2026-01-15",
            author: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            publisher: { "@type": "Organization", name: "OFFO Lab", url: SITE_URL },
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/ev-regret-case-studies` },
          }),
        }}
      />
      {children}
    </>
  );
}
