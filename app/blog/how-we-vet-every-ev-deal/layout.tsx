import type { Metadata } from "next";
import { getPostBySlug } from "@/lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const post = getPostBySlug("how-we-vet-every-ev-deal")!;
const ogTitle = post.title;
const ogSubtitle = "From listing page to GREEN verdict — here's exactly what happens before a deal appears on our site.";

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: `${SITE_URL}/blog/${post.slug}`,
  },
  openGraph: {
    title: ogTitle,
    description: post.description,
    url: `${SITE_URL}/blog/${post.slug}`,
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
    description: post.description,
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
  },
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
            headline: post.title,
            description: post.description,
            url: `${SITE_URL}/blog/${post.slug}`,
            datePublished: post.datePublished,
            dateModified: post.dateModified ?? post.datePublished,
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
              "@id": `${SITE_URL}/blog/${post.slug}`,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
