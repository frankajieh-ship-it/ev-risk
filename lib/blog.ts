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
  audioUrl?: string;       // if present, this is a podcast episode
  duration?: string;       // e.g. "22 min"
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "ev-vin-report-guide",
    badge: "Buyer's Guide",
    badgeColor: "bg-blue-500/20 text-blue-300",
    title: "EV VIN Report: What It Shows, What It Misses, and the Free Tool That Does It Better",
    description:
      "A standard VIN report doesn't show battery degradation, DC fast charge capability, or EV-specific recalls. Here's what an EV VIN report should cover — and the free tool that does it.",
    excerpt:
      "Carfax and AutoCheck miss battery degradation, DCFC speed, chemistry type, and EV-specific recalls. Here's what a real EV VIN report should include.",
    readTime: "8 min read",
    datePublished: "2026-05-09",
  },
  {
    slug: "cheapest-evs-you-can-buy",
    badge: "Buyer's Guide",
    badgeColor: "bg-green-500/20 text-green-300",
    title: "Cheapest EVs You Can Buy in 2026 (Under $15K, Real-World Tested)",
    description:
      "The honest guide to cheap EVs under $15K in 2026 — Chevy Bolt, Nissan Leaf, VW e-Golf, and Kia Soul EV. Which ones are real deals and which are money pits.",
    excerpt:
      "Sub-$15K used EVs are real now. But not all cheap EVs are good deals — some have fire-risk recalls, fading charging networks, or range too low for real life. Here's the honest breakdown.",
    readTime: "7 min read",
    datePublished: "2026-05-09",
  },
  {
    slug: "navigating-used-ev-market",
    badge: "Podcast",
    badgeColor: "bg-purple-500/20 text-purple-300",
    title: "Navigating the Used EV Market: Inventory Lows & Charging Challenges",
    description:
      "A discussion on low used EV inventory, what's driving it, and how to find deals without getting burned on charging infrastructure or battery health.",
    excerpt:
      "Inventory is tight, prices are still elevated, and charging anxiety is real. Here's how to navigate the used EV market right now — without overpaying or buying a lemon.",
    readTime: "22 min listen",
    datePublished: "2026-05-09",
    audioUrl: "/podcasts/navigating-used-ev-market.mp3",
    duration: "22 min",
  },
  {
    slug: "used-model-y-buyer-checklist",
    badge: "Buyer's Checklist",
    badgeColor: "bg-green-100 text-green-800",
    title: "Used Tesla Model Y Buyer Checklist (2026): 12 Things to Check Before You Buy",
    description:
      "Before buying a used Tesla Model Y, check these 12 things: open recalls, battery health estimate, FSD transfer status, heat pump issues, MCU generation, and the 4 model years to target vs. avoid.",
    excerpt:
      "Open recalls, battery health, FSD transfer, heat pump issues, panel gaps, market price, and 3 negotiation scripts — everything you need before handing over a dollar.",
    readTime: "11 min read",
    datePublished: "2026-05-02",
  },
  {
    slug: "used-ioniq5-buyer-checklist",
    badge: "Buyer's Checklist",
    badgeColor: "bg-blue-100 text-blue-800",
    title: "Used Hyundai Ioniq 5 Buyer Checklist (2026): 11 Things to Check Before You Buy",
    description:
      "Before buying a used Hyundai Ioniq 5, check these 11 things: battery degradation rate, open recalls, 800V charging compatibility, heat pump status, software updates, and which model years to target vs. avoid.",
    excerpt:
      "12V battery drain recalls, 800V charging verification, V2L adapter, heat pump failures, and the exact model years to target — the complete Ioniq 5 pre-purchase checklist.",
    readTime: "10 min read",
    datePublished: "2026-05-02",
  },
  {
    slug: "best-carfax-alternatives-2026",
    badge: "Comparison",
    badgeColor: "bg-green-100 text-green-800",
    title: "Best Carfax Alternatives of 2026",
    description:
      "We tested 7 VIN report services head-to-head. Here are the ones that actually surface the risks Carfax can miss — especially for used EV buyers.",
    excerpt:
      "We tested 7 VIN report services head-to-head. OFFO ranks #1 for used EV buyers — the only service with EV-specific signals, AI verdict, and free access.",
    readTime: "12 min read",
    datePublished: "2026-04-27",
  },
  {
    slug: "how-we-vet-every-ev-deal",
    badge: "How It Works",
    badgeColor: "bg-indigo-100 text-indigo-800",
    title: "How We Find and Vet Every Used EV Deal on OFFO",
    description:
      "From listing page to GREEN verdict — here's exactly what happens before a deal appears on our site. The full sourcing, VIN audit, and AI scoring pipeline explained.",
    excerpt:
      "From listing page to GREEN verdict — here's exactly what happens before a deal appears on our site.",
    readTime: "6 min read",
    datePublished: "2026-04-26",
  },
  {
    slug: "carfax-alternative-used-ev",
    badge: "Buyer's Guide",
    badgeColor: "bg-green-100 text-green-800",
    title: "I Was Paying $45 for Carfax Reports. Then I Found a Better Way to Shop for Used EVs.",
    description:
      "After testing every major VIN report service on real EV listings, one tool completely changed how I evaluate deals — and it's free.",
    excerpt:
      "After testing every major VIN report service on real EV listings, one tool completely changed how I evaluate deals — and it's free.",
    readTime: "6 min read",
    datePublished: "2026-04-26",
  },
  {
    slug: "hybrid-ai-system-used-ev-buying",
    badge: "Engineering",
    badgeColor: "bg-indigo-100 text-indigo-800",
    title: "We Built a Hybrid AI System That Actually Helps People Buy Used EVs Without the Regret",
    description:
      "How a deterministic-first scoring layer plus a hedged multi-LLM chain turned messy CarGurus listings and Copart auctions into actionable results buyers can trust.",
    excerpt:
      "How a deterministic-first scoring layer + hedged multi-LLM chain turned messy CarGurus listings and Copart auctions into actionable results.",
    readTime: "4 min read",
    datePublished: "2026-04-11",
  },
  {
    slug: "copart-ev-buying-guide",
    badge: "Buyer's Guide",
    badgeColor: "bg-orange-100 text-orange-800",
    title: "Buying a Salvage EV at Copart: What the Auction Report Actually Tells You",
    description:
      "Not all salvage EVs are disasters. Hail-damaged Teslas and minor collision Bolts can be exceptional value — if you know how to read the auction report. Here's what to look for.",
    excerpt:
      "Not all salvage EVs are disasters. Hail-damaged Teslas and minor collision Bolts can be exceptional value — if you know how to read the auction report.",
    readTime: "11 min read",
    datePublished: "2026-04-04",
  },
  {
    slug: "best-budget-evs-2025",
    badge: "Buyer's Guide",
    badgeColor: "bg-green-100 text-green-800",
    title: "Best Used EVs Under $25K in 2025",
    description:
      "The used EV market has shifted dramatically. Here are the models that deliver the most range, reliability, and resale value under $25,000 — and the ones to avoid.",
    excerpt:
      "The used EV market has shifted dramatically. Here are the models that deliver the most range, reliability, and resale value under $25,000.",
    readTime: "9 min read",
    datePublished: "2026-03-28",
  },
  {
    slug: "ev-winter-prep-checklist",
    badge: "Checklist",
    badgeColor: "bg-blue-100 text-blue-800",
    title: "Winter EV Prep: 10 Things to Do Before the First Frost",
    description:
      "Cold weather cuts EV range 20–40%. These 10 steps — done once before winter — prevent most cold-weather surprises and keep your battery healthy through spring.",
    excerpt:
      "Cold weather cuts EV range 20–40%. These 10 steps — done once before winter — prevent most cold-weather surprises.",
    readTime: "7 min read",
    datePublished: "2026-03-10",
  },
  {
    slug: "apartment-ev-ownership",
    badge: "Guide",
    badgeColor: "bg-purple-100 text-purple-800",
    title: "Can You Own an EV Without a Garage? A Realistic Guide",
    description:
      "Over 40 million Americans rent without private parking. Here's an honest look at apartment EV ownership: when it works, when it doesn't, and what infrastructure you actually need.",
    excerpt:
      "Over 40 million Americans rent without private parking. Here's an honest look at apartment EV ownership: when it works and when it doesn't.",
    readTime: "8 min read",
    datePublished: "2026-02-20",
  },
  {
    slug: "ev-fit-score-explained",
    badge: "Methodology",
    badgeColor: "bg-indigo-100 text-indigo-800",
    title: "How OFFO Scores EV Fit: The Full Methodology",
    description:
      "OFFO's EV fit score combines 8 factors: commute distance, climate zone, charging access, vehicle range, driving patterns, home ownership, budget, and flexibility. Here's exactly how each is weighted.",
    excerpt:
      "OFFO's EV fit score combines 8 factors. Here's exactly how each is weighted and why.",
    readTime: "6 min read",
    datePublished: "2026-02-01",
  },
  {
    slug: "ev-regret-case-studies",
    badge: "Case Studies",
    badgeColor: "bg-red-100 text-red-800",
    title: "5 People Who Regretted Buying an EV — And Exactly Why",
    description:
      "Real stories from EV owners who didn't love the experience. Common threads: no home charging, underestimated cold weather, wrong model for the use case. What each person should have done differently.",
    excerpt:
      "Real stories from EV owners who didn't love the experience — and what each person should have done differently.",
    readTime: "10 min read",
    datePublished: "2026-01-15",
  },
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
