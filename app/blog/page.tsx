"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { getSortedPosts } from "@/lib/blog";

export default function BlogPage() {
  useVisitorTracking();
  const { trackEvent } = useEventTracking();
  const posts = getSortedPosts();

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      <Header variant="homepage" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">OFFO Labs Blog</h1>
          <p className="text-white/40">Systems thinking about decisions that matter</p>
        </div>

        {/* Why this exists */}
        <div className="bg-[#161b22] border-l-4 border-[#00d97e] rounded-lg p-5 mb-10">
          <h3 className="text-xs font-semibold text-white/50 mb-1 uppercase tracking-wide">Why this exists</h3>
          <p className="text-white/50 text-sm leading-relaxed">
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
              className="bg-[#161b22] rounded-xl border border-white/[0.08] p-6 hover:border-white/[0.18] transition-all"
            >
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${post.badgeColor}`}>
                {post.badge}
              </span>
              <Link href={`/blog/${post.slug}`}>
                <h2 className="mt-3 text-xl font-bold text-white/90 hover:text-[#00d97e] transition-colors leading-snug">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-2 text-white/40 text-sm leading-relaxed">{post.excerpt}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-white/30">
                <span>
                  {post.readTime}
                  {post.datePublished && ` · ${new Date(post.datePublished).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
                </span>
                <Link
                  href={`/blog/${post.slug}`}
                  onClick={() => trackEvent("blog_post_clicked", { slug: post.slug })}
                  className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm transition-colors"
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
