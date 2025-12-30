"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function BlogPage() {
  // Track blog page visits
  useVisitorTracking();

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

          {/* Coming Soon Placeholder */}
          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
            <p className="text-gray-600 text-center">
              More posts coming soon. We write when we have something useful to say.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        <p>
          OFFO Labs · Building decision intelligence that reduces regret
        </p>
      </footer>
    </div>
  );
}
