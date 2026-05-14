"use client";

import Link from "next/link";
import PodcastPlayer from "@/components/PodcastPlayer";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function NavigatingUsedEvMarketEpisode() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href="/blog"
            className="text-[#00d97e] hover:text-[#00d97e]/80 font-medium text-sm mb-5 inline-block transition-colors"
          >
            &larr; Back to Blog
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300">
              Podcast
            </span>
            <span className="text-white/30 text-xs">22 min listen</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Navigating the Used EV Market: Inventory Lows &amp; Charging Challenges
          </h1>
          <p className="text-lg text-white/60 mb-6 leading-relaxed">
            Inventory is tight, prices are still elevated, and charging anxiety is real.
            We break down what&rsquo;s driving the used EV squeeze — and how to find a real deal
            without overpaying or buying a lemon.
          </p>
          <div className="flex items-center gap-3 text-white/30 text-sm">
            <span>OFFO Labs</span>
            <span>&middot;</span>
            <span>May 2026</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-10">

        {/* Player */}
        <div className="mb-10">
          <PodcastPlayer
            src="/podcasts/navigating-used-ev-market.mp3"
            title="Navigating the Used EV Market: Inventory Lows & Charging Challenges"
            duration="~22 min"
          />
        </div>

        {/* Show Notes */}
        <div className="prose prose-invert prose-lg max-w-none">

          <h2 className="text-xl font-bold text-white mb-4">What we cover</h2>
          <ul className="space-y-2 text-white/70 text-sm list-none pl-0 mb-10">
            {[
              "Why used EV inventory has tightened — leasing trends, early adopter hold rates, and fleet dynamics",
              "How inventory lows are keeping prices elevated even as new EV prices drop",
              "The charging anxiety problem: what buyers fear vs. what actually breaks deals",
              "DC fast charging network reliability — which networks are actually improving",
              "Battery health as the hidden pricing variable — what dealers aren't disclosing",
              "Where the real deals are: off-lease Chevy Bolts, early Ioniq 5s, pre-Highland Model 3s",
              "How to vet a used EV listing in under 10 minutes using OFFO",
              "Negotiation leverage when battery health isn't disclosed",
              "What charging access looks like for apartment dwellers buying used",
            ].map((topic, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#00d97e] flex-shrink-0" />
                <span>{topic}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="rounded-2xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] p-6 mb-10">
            <p className="text-white font-semibold mb-2">Check any listing mentioned in this episode</p>
            <p className="text-white/50 text-sm mb-4">
              Paste a listing URL and get a full risk receipt — open recalls, battery health estimate,
              pricing vs. market, and a plain-English verdict. No sign-up required.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#00d97e] text-[#0d1117] font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#00d97e]/90 transition-colors"
            >
              Check a listing &rarr;
            </Link>
          </div>

          {/* Related */}
          <h2 className="text-lg font-bold text-white mb-4">Related reading</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                href: "/blog/used-ev-buying-checklist",
                badge: "Buyer's Guide",
                title: "Used EV Buying Checklist",
                desc: "The 10-point pre-purchase checklist every used EV buyer should run.",
              },
              {
                href: "/blog/best-budget-evs-2025",
                badge: "Buyer's Guide",
                title: "Best Budget EVs Under $25K",
                desc: "The used models offering the most range, reliability, and charging speed per dollar.",
              },
              {
                href: "/blog/apartment-ev-ownership",
                badge: "Charging",
                title: "EV Ownership Without Home Charging",
                desc: "How apartment dwellers are making it work — and the vehicles that make it easiest.",
              },
              {
                href: "/blog/ev-fit-score-explained",
                badge: "How It Works",
                title: "How the OFFO EV Fit Score Works",
                desc: "The routine-based scoring engine that tells you if an EV fits your actual life.",
              },
            ].map((post) => (
              <Link
                key={post.href}
                href={post.href}
                className="block rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors group"
              >
                <span className="text-xs text-white/40 font-medium mb-1.5 block">{post.badge}</span>
                <p className="text-sm font-semibold text-white group-hover:text-[#00d97e] transition-colors mb-1">
                  {post.title}
                </p>
                <p className="text-xs text-white/40 leading-relaxed">{post.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
