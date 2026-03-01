"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function BlogPage() {
  // Track blog page visits
  useVisitorTracking();
  const { trackEvent } = useEventTracking();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-2 inline-block"
          >
            ← Back to OFFO Labs
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">OFFO Labs Blog</h1>
          <p className="text-gray-600">Systems thinking about decisions that matter</p>
        </div>
      </header>

      {/* Blog Posts List */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Context Box */}
        <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Why this exists</h3>
          <p className="text-gray-700 leading-relaxed">
            After analyzing dozens of real EV regret stories, a pattern kept repeating:
            the problem wasn't range — it was routine mismatch. These posts explore the
            behavioral patterns behind high-stakes decisions and how to make them less stressful.
          </p>
        </div>

        <div className="space-y-8">
          {/* Featured Post */}
          <article className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="mb-4">
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                Featured
              </span>
            </div>
            <Link href="/blog/ev-regret-routine">
              <h2 className="text-3xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
                EV Regret Isn't About Range. It's About Routine.
              </h2>
            </Link>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Why some people love their EVs and others quietly regret them—despite driving the
              same car in the same city. The difference isn't range. It's whether charging fits
              their routine without constant thinking.
            </p>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>8 min read</span>
              <Link
                href="/blog/ev-regret-routine"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Read article →
              </Link>
            </div>
          </article>

          {/* Post 2 */}
          <article className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="mb-4">
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                Buyer&apos;s Guide
              </span>
            </div>
            <Link href="/blog/used-tesla-model-3-worth-it">
              <h2 className="text-3xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
                Is a Used Tesla Model 3 Worth It in 2026?
              </h2>
            </Link>
            <p className="text-gray-600 mb-4 leading-relaxed">
              What to actually expect at 30k, 60k, and 100k miles. Common problems, battery
              degradation reality, insurance costs, and which model years to target vs avoid.
            </p>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>12 min read</span>
              <Link
                href="/blog/used-tesla-model-3-worth-it"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Read article &rarr;
              </Link>
            </div>
          </article>

          {/* Post 3 */}
          <article className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="mb-4">
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
                Checklist
              </span>
            </div>
            <Link href="/blog/used-ev-buying-checklist">
              <h2 className="text-3xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
                Used EV Buying Checklist: 10 Things to Check Before You Buy
              </h2>
            </Link>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Battery health, charging capability, software updates, 12V battery, recalls, warranty
              transfer, and 4 more things most used car guides miss for EVs.
            </p>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>10 min read</span>
              <Link
                href="/blog/used-ev-buying-checklist"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Read article &rarr;
              </Link>
            </div>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        <p>
          OFFO Labs · Building decision intelligence that reduces regret
        </p>
        <p className="mt-2">
          Questions, feedback, or bugs?{" "}
          <Link
            href="/contact"
            onClick={() => trackEvent("contact_click_footer", { page: "/blog" })}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Contact us
          </Link>
        </p>
      </footer>
    </div>
  );
}
