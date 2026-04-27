import type { Metadata } from "next";
import { getPostBySlug } from "@/lib/blog";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const post = getPostBySlug("best-carfax-alternatives-2026")!;
const ogTitle = post.title;
const ogSubtitle = "We tested 7 VIN report services head-to-head. Here are the ones that actually surface the risks Carfax can miss.";

export const metadata: Metadata = {
  title: "Best Carfax Alternatives of 2026 — Tested Head-to-Head | OFFO",
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
      <div className="min-h-screen bg-[#0d1117] flex flex-col">
        <Header variant="homepage" />
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </>
  );
}
