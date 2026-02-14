import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuide, getAllGuideSlugs } from "@/content/guides";
import SeoToolPageTemplate from "@/components/seo/SeoToolPageTemplate";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = getGuide(slug);
  if (!content) return {};

  return {
    title: content.title,
    description: content.metaDescription,
    alternates: {
      canonical: `${SITE_URL}${content.canonical}`,
    },
    openGraph: {
      title: content.ogTitle,
      description: content.ogDescription,
      url: `${SITE_URL}${content.canonical}`,
      type: "article",
      siteName: "OFFO",
    },
    twitter: {
      card: "summary",
      title: content.ogTitle,
      description: content.ogDescription,
    },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const content = getGuide(slug);
  if (!content) notFound();

  return <SeoToolPageTemplate content={content} />;
}
