import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "EV Regret Isn't About Range. It's About Routine.",
  description:
    "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
  alternates: {
    canonical: `${SITE_URL}/blog/ev-regret-routine`,
  },
  openGraph: {
    title: "EV Regret Isn't About Range. It's About Routine.",
    description:
      "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
    url: `${SITE_URL}/blog/ev-regret-routine`,
    type: "article",
    siteName: "OFFO",
  },
  twitter: {
    card: "summary",
    title: "EV Regret Isn't About Range. It's About Routine.",
    description:
      "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function EVRegretRoutineLayout({
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
            headline: "EV Regret Isn't About Range. It's About Routine.",
            description:
              "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
            url: `${SITE_URL}/blog/ev-regret-routine`,
            datePublished: "2025-05-01",
            dateModified: "2025-05-01",
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
              "@id": `${SITE_URL}/blog/ev-regret-routine`,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
