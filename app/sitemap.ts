import type { MetadataRoute } from "next";
import { getAllChecklistSlugs } from "@/content/checklists";
import { getAllGuideSlugs } from "@/content/guides";
import { getAllCitySlugs } from "@/content/cities";
import { getSortedPosts } from "@/lib/blog";

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
    {
      url: `${SITE_URL}/answers`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/deals`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/routine`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/local`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const checklistPages = getAllChecklistSlugs().map((slug) => ({
    url: `${SITE_URL}/checklists/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const guidePriorityOverrides: Record<string, number> = {
    "budget-evs": 0.80,
    "used-ev-proof-checklist": 0.80,
    "no-home-charging": 0.75,
  };
  const guidePages = getAllGuideSlugs().map((slug) => ({
    url: `${SITE_URL}/guides/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: guidePriorityOverrides[slug] ?? 0.7,
  }));

  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...getSortedPosts().map((post) => {
      const pillarSlugs: Record<string, number> = {
        "best-carfax-alternatives-2026": 0.85,
        "carfax-alternative-used-ev": 0.80,
        "ev-vin-report-guide": 0.80,
        "best-budget-evs-2025": 0.75,
        "cheapest-evs-you-can-buy": 0.75,
        "used-ev-buying-checklist": 0.75,
      };
      return {
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: post.dateModified ?? post.datePublished,
        changeFrequency: "monthly" as const,
        priority: pillarSlugs[post.slug] ?? 0.7,
      };
    }),
  ];

  const localPages = getAllCitySlugs().map((slug) => ({
    url: `${SITE_URL}/local/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const guidesIndex: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/guides`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ];

  return [...staticPages, ...guidesIndex, ...checklistPages, ...guidePages, ...blogPages, ...localPages];
}
