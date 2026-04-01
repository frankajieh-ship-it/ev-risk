"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const posts = [
  {
    slug: "deterministic-first-multi-llm-second",
    badge: "Engineering",
    badgeColor: "bg-indigo-100 text-indigo-800",
    title: "Deterministic First, Multi-LLM Second: How OFFO's Deal Intelligence Pipeline Works",
    excerpt:
      "How we built a two-layer EV deal intelligence pipeline: a deterministic rule engine that responds in under 500ms, upgraded asynchronously by a three-model AI chain. The user never sees a loading state for the AI.",
    meta: "14 min read · April 2026",
  },
  {
    slug: "offo-ev-fit-check-insights",
    badge: "Data Report",
    badgeColor: "bg-purple-100 text-purple-800",
    title: "Three Months of OFFO: What 286 Real EV Fit Checks Revealed",
    excerpt:
      "Data from 286 real EV fit checks: which vehicles buyers compare most, what questionnaire fields predict readiness, and the one signal that surprised us — only 2 listings saved to My Garage out of 286 completed checks.",
    meta: "7 min read · March 2026",
  },
  {
    slug: "ev-regret-routine",
    badge: "Featured",
    badgeColor: "bg-blue-100 text-blue-800",
    title: "EV Regret Isn't About Range. It's About Routine.",
    excerpt:
      "Why some people love their EVs and others quietly regret them — despite driving the same car in the same city. The difference isn't range. It's whether charging fits their routine without constant thinking.",
    meta: "8 min read",
  },
  {
    slug: "used-tesla-model-3-worth-it",
    badge: "Buyer's Guide",
    badgeColor: "bg-green-100 text-green-800",
    title: "Is a Used Tesla Model 3 Worth It in 2026?",
    excerpt:
      "What to actually expect at 30k, 60k, and 100k miles. Common problems, battery degradation reality, insurance costs, and which model years to target vs avoid.",
    meta: "12 min read",
  },
  {
    slug: "used-ev-buying-checklist",
    badge: "Checklist",
    badgeColor: "bg-amber-100 text-amber-800",
    title: "Used EV Buying Checklist: 10 Things to Check Before You Buy",
    excerpt:
      "Battery health, charging capability, software updates, 12V battery, recalls, warranty transfer, and 4 more things most used car guides miss for EVs.",
    meta: "10 min read",
  },
];

export default function BlogPage() {
  useVisitorTracking();
  const { trackEvent } = useEventTracking();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header variant="receipt" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">OFFO Labs Blog</h1>
          <p className="text-gray-500">Systems thinking about decisions that matter</p>
        </div>

        {/* Why this exists */}
        <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-5 mb-10">
          <h3 className="text-sm font-semibold text-gray-900 mb-1 uppercase tracking-wide">Why this exists</h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            After analyzing dozens of real EV regret stories, a pattern kept repeating:
            the problem wasn&apos;t range — it was routine mismatch. These posts explore the
            behavioral patterns behind high-stakes decisions and how to make them less stressful.
          </p>
        </div>

        {/* Posts */}
        <div className="space-y-6">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${post.badgeColor}`}>
                {post.badge}
              </span>
              <Link href={`/blog/${post.slug}`}>
                <h2 className="mt-3 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors leading-snug">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-2 text-gray-500 text-sm leading-relaxed">{post.excerpt}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span>{post.meta}</span>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Read &rarr;
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
