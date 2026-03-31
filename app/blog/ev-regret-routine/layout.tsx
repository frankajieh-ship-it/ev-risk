import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "EV Regret Isn't About Range. It's About Routine.";
const ogSubtitle = "Why EV regret is about routine, not range.";

export const metadata: Metadata = {
  title: "EV Regret Isn't About Range. It's About Routine.",
  description:
    "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
  alternates: {
    canonical: `${SITE_URL}/blog/ev-regret-routine`,
  },
  openGraph: {
    title: ogTitle,
    description:
      "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
    url: `${SITE_URL}/blog/ev-regret-routine`,
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
      "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
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
