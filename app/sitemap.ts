import type { MetadataRoute } from "next";
import { getAllChecklistSlugs } from "@/content/checklists";
import { getAllGuideSlugs } from "@/content/guides";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/receipt`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  const checklistPages = getAllChecklistSlugs().map((slug) => ({
    url: `${SITE_URL}/checklists/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const guidePages = getAllGuideSlugs().map((slug) => ({
    url: `${SITE_URL}/guides/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...checklistPages, ...guidePages];
}
