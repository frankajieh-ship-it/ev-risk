/**
 * Blog post registry
 *
 * Single source of truth for all blog post metadata.
 * Used by:
 *  - app/blog/page.tsx (post listing)
 *  - app/sitemap.ts (dynamic sitemap entries)
 *  - Individual post layouts (JSON-LD)
 *
 * To add a new post:
 *  1. Add an entry here
 *  2. Create app/blog/{slug}/page.tsx with the content
 *  3. Create app/blog/{slug}/layout.tsx with metadata + JSON-LD
 *     (copy from an existing post layout and update the fields)
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  badge: string;
  badgeColor: string;
  readTime: string;
  datePublished: string;   // ISO 8601 date, e.g. "2026-04-01"
  dateModified?: string;   // defaults to datePublished if omitted
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "deterministic-first-multi-llm-second",
    badge: "Engineering",
    badgeColor: "bg-indigo-100 text-indigo-800",
    title: "Deterministic First, Multi-LLM Second: How OFFO's Deal Intelligence Pipeline Works",
    description:
      "How OFFO built a two-layer EV deal intelligence pipeline: a deterministic rule engine that responds in under 500ms, upgraded asynchronously by a three-model AI chain. The user never sees a loading state for the AI.",
    excerpt:
      "How we built a two-layer EV deal intelligence pipeline: a deterministic rule engine that responds in under 500ms, upgraded asynchronously by a three-model AI chain. The user never sees a loading state for the AI.",
    readTime: "14 min read",
    datePublished: "2026-04-01",
  },
  {
    slug: "offo-ev-fit-check-insights",
    badge: "Data Report",
    badgeColor: "bg-purple-100 text-purple-800",
    title: "Three Months of OFFO: What 286 Real EV Fit Checks Revealed",
    description:
      "Data from 286 real EV fit checks: which vehicles buyers compare most, what questionnaire fields predict readiness, and the one signal that surprised us.",
    excerpt:
      "Data from 286 real EV fit checks: which vehicles buyers compare most, what questionnaire fields predict readiness, and the one signal that surprised us — only 2 listings saved to My Garage out of 286 completed checks.",
    readTime: "7 min read",
    datePublished: "2026-03-17",
  },
  {
    slug: "ev-regret-routine",
    badge: "Featured",
    badgeColor: "bg-blue-100 text-blue-800",
    title: "EV Regret Isn't About Range. It's About Routine.",
    description:
      "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
    excerpt:
      "Why some people love their EVs and others quietly regret them — despite driving the same car in the same city. The difference isn't range. It's whether charging fits their routine without constant thinking.",
    readTime: "8 min read",
    datePublished: "2025-05-01",
  },
  {
    slug: "used-tesla-model-3-worth-it",
    badge: "Buyer's Guide",
    badgeColor: "bg-green-100 text-green-800",
    title: "Is a Used Tesla Model 3 Worth It in 2026?",
    description:
      "What to actually expect at 30k, 60k, and 100k miles. Common problems, battery degradation reality, insurance costs, and which model years to target vs avoid.",
    excerpt:
      "What to actually expect at 30k, 60k, and 100k miles. Common problems, battery degradation reality, insurance costs, and which model years to target vs avoid.",
    readTime: "12 min read",
    datePublished: "2025-04-01",
  },
  {
    slug: "used-ev-buying-checklist",
    badge: "Checklist",
    badgeColor: "bg-amber-100 text-amber-800",
    title: "Used EV Buying Checklist: 10 Things to Check Before You Buy",
    description:
      "Battery health, charging capability, software updates, 12V battery, recalls, warranty transfer, and 4 more things most used car guides miss for EVs.",
    excerpt:
      "Battery health, charging capability, software updates, 12V battery, recalls, warranty transfer, and 4 more things most used car guides miss for EVs.",
    readTime: "10 min read",
    datePublished: "2025-03-01",
  },
];

/** Returns posts sorted newest-first */
export function getSortedPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) =>
      new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
