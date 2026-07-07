import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Used EV Buying Guide 2026 — Everything You Need to Know | OFFO",
  description:
    "The complete hub for used EV buyers: vehicle history reports, battery health checks, model comparisons, negotiation scripts, and the free tool that does it all in under 30 seconds.",
  alternates: {
    canonical: "https://offolab.com/guides/buying-a-used-ev",
  },
};

const BUYING_POSTS = [
  {
    slug: "used-ev-buying-checklist",
    title: "Used EV Buying Checklist: 10 Things to Check Before You Buy",
    excerpt: "Battery health, charging capability, software updates, 12V battery, recalls, warranty transfer.",
    badge: "Checklist",
    time: "10 min",
  },
  {
    slug: "ev-vin-report-guide",
    title: "EV VIN Report: What It Shows, What It Misses, and the Free Tool That Does It Better",
    excerpt: "Standard VIN reports miss battery degradation, DCFC speed, and EV-specific recalls.",
    badge: "Buyer's Guide",
    time: "8 min",
  },
  {
    slug: "offo-carfax-for-evs",
    title: "We Built the Carfax for EVs — Because Carfax Can't",
    excerpt: "Battery health, charging fit, and EV-specific recall data aren't in Carfax's model. We built the report that is.",
    badge: "Industry First",
    time: "8 min",
  },
  {
    slug: "best-carfax-alternatives-2026",
    title: "Best Carfax Alternatives of 2026 — Tested Head-to-Head",
    excerpt: "We tested 7 VIN report services. OFFO ranks #1 for used EV buyers.",
    badge: "Comparison",
    time: "12 min",
  },
  {
    slug: "carfax-alternative-used-ev",
    title: "I Was Paying $45 for Carfax Reports. Then I Found a Better Way.",
    excerpt: "After testing every major VIN report on real EV listings, one free tool changed everything.",
    badge: "Buyer's Guide",
    time: "6 min",
  },
  {
    slug: "cheapest-evs-you-can-buy",
    title: "Cheapest EVs You Can Buy in 2026 (Under $15K, Real-World Tested)",
    excerpt: "Sub-$15K used EVs are real now. But not all cheap EVs are good deals.",
    badge: "Buyer's Guide",
    time: "7 min",
  },
  {
    slug: "best-budget-evs-2025",
    title: "Best Used EVs Under $25K in 2025",
    excerpt: "The models that deliver the most range, reliability, and resale value under $25,000.",
    badge: "Buyer's Guide",
    time: "9 min",
  },
  {
    slug: "used-tesla-model-3-worth-it",
    title: "Is a Used Tesla Model 3 Worth It in 2026?",
    excerpt: "What to expect at 30k, 60k, and 100k miles. Battery degradation reality and which years to target.",
    badge: "Buyer's Guide",
    time: "12 min",
  },
  {
    slug: "used-model-y-buyer-checklist",
    title: "Used Tesla Model Y Buyer Checklist (2026): 12 Things to Check Before You Buy",
    excerpt: "Open recalls, battery health, FSD transfer, heat pump issues, and 3 negotiation scripts.",
    badge: "Checklist",
    time: "11 min",
  },
  {
    slug: "used-ioniq5-buyer-checklist",
    title: "Used Hyundai Ioniq 5 Buyer Checklist (2026): 11 Things to Check",
    excerpt: "12V battery drain recalls, 800V charging verification, heat pump failures — the complete pre-purchase list.",
    badge: "Checklist",
    time: "10 min",
  },
  {
    slug: "copart-ev-buying-guide",
    title: "Buying a Salvage EV at Copart: What the Auction Report Actually Tells You",
    excerpt: "Not all salvage EVs are disasters. Here's how to read the auction report.",
    badge: "Buyer's Guide",
    time: "11 min",
  },
];

export default function BuyingAUsedEvGuidePage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Breadcrumb */}
        <nav className="text-sm text-white/40 mb-8">
          <Link href="/" className="hover:text-white/70 transition-colors">OFFO</Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="hover:text-white/70 transition-colors">Guides</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Buying a Used EV</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold text-[#00d97e] uppercase tracking-wider mb-3">Complete Guide</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Used EV Buying Guide 2026
          </h1>
          <p className="text-lg text-white/50 max-w-2xl">
            Everything you need to research, evaluate, and buy a used EV without getting burned on battery, charging, or price. Includes vehicle history, model-specific checklists, and the free tool that replaces Carfax for EVs.
          </p>
        </div>

        {/* CTA */}
        <div className="bg-[#00d97e]/10 border border-[#00d97e]/25 rounded-2xl px-6 py-5 mb-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-0.5">Ready to check a specific listing?</p>
            <p className="text-sm text-white/50">Paste any CarGurus, AutoTrader, or Cars.com URL — get a battery verdict in 30 seconds. Free.</p>
          </div>
          <Link
            href="/receipt"
            className="shrink-0 bg-[#00d97e] hover:bg-[#00c970] text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            Check a listing →
          </Link>
        </div>

        {/* Post grid */}
        <div className="grid gap-4">
          {BUYING_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block bg-[#161b22] border border-white/[0.08] hover:border-[#00d97e]/30 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{post.badge}</span>
                    <span className="text-[11px] text-white/25">·</span>
                    <span className="text-[11px] text-white/30">{post.time} read</span>
                  </div>
                  <h2 className="text-base font-semibold text-white group-hover:text-[#00d97e] transition-colors leading-snug mb-1.5">
                    {post.title}
                  </h2>
                  <p className="text-sm text-white/40 leading-relaxed">{post.excerpt}</p>
                </div>
                <span className="shrink-0 text-white/20 group-hover:text-[#00d97e] transition-colors text-lg mt-0.5">→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-white/[0.06] flex flex-wrap gap-4 text-sm">
          <Link href="/guides/ev-battery-health" className="text-[#00d97e] hover:text-[#00c970] transition-colors">
            Battery health guide →
          </Link>
          <Link href="/blog" className="text-white/40 hover:text-white/70 transition-colors">
            All blog posts →
          </Link>
        </div>
      </div>
    </div>
  );
}
