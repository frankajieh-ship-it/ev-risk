import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "Is a Used Tesla Model 3 Worth It in 2026? Honest Buyer's Guide",
  description:
    "What to actually expect from a used Tesla Model 3 at 30k, 60k, and 100k miles. Common problems, battery degradation reality, insurance costs, and which model years to target.",
  alternates: {
    canonical: `${SITE_URL}/blog/used-tesla-model-3-worth-it`,
  },
  openGraph: {
    title: "Is a Used Tesla Model 3 Worth It in 2026? Honest Buyer's Guide",
    description:
      "What to actually expect from a used Tesla Model 3 at 30k, 60k, and 100k miles. Common problems, battery degradation reality, insurance costs, and which model years to target.",
    url: `${SITE_URL}/blog/used-tesla-model-3-worth-it`,
    type: "article",
    siteName: "OFFO",
  },
  twitter: {
    card: "summary",
    title: "Is a Used Tesla Model 3 Worth It in 2026? Honest Buyer's Guide",
    description:
      "What to actually expect from a used Tesla Model 3 at 30k, 60k, and 100k miles. Common problems, battery degradation reality, and which model years to target.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function UsedTeslaModel3Layout({
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
              "Is a Used Tesla Model 3 Worth It in 2026? Honest Buyer's Guide",
            description:
              "What to actually expect from a used Tesla Model 3 at 30k, 60k, and 100k miles. Common problems, battery degradation reality, insurance costs, and which model years to target.",
            url: `${SITE_URL}/blog/used-tesla-model-3-worth-it`,
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
              "@id": `${SITE_URL}/blog/used-tesla-model-3-worth-it`,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
