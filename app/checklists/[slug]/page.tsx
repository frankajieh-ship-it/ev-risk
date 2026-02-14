import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChecklist, getAllChecklistSlugs } from "@/content/checklists";
import SeoToolPageTemplate from "@/components/seo/SeoToolPageTemplate";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllChecklistSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = getChecklist(slug);
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

export default async function ChecklistPage({ params }: PageProps) {
  const { slug } = await params;
  const content = getChecklist(slug);
  if (!content) notFound();

  return <SeoToolPageTemplate content={content} />;
}
