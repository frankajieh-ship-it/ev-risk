import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Battery Health Guide 2026 — What Every Used EV Buyer Needs to Know | OFFO",
  description:
    "How battery degradation works, what affects range in cold weather, how to evaluate fit for your life, and the free tool that estimates battery health on any used EV listing.",
  alternates: {
    canonical: "https://offolab.com/guides/ev-battery-health",
  },
};

const BATTERY_POSTS = [
  {
    slug: "offo-carfax-for-evs",
    title: "We Built the Carfax for EVs — Because Carfax Can't",
    excerpt: "Battery degradation isn't in any DMV or insurance database. Here's how OFFO infers it.",
    badge: "Industry First",
    time: "8 min",
  },
  {
    slug: "ev-fit-score-explained",
    title: "How OFFO Scores EV Fit: The Full Methodology",
    excerpt: "8 factors — commute, climate, charging access, vehicle range, driving patterns, home ownership, budget, flexibility.",
    badge: "Methodology",
    time: "6 min",
  },
  {
    slug: "ev-regret-routine",
    title: "EV Regret Isn't About Range. It's About Routine.",
    excerpt: "Why some people love their EVs and others quietly regret them — despite driving the same car.",
    badge: "Featured",
    time: "8 min",
  },
  {
    slug: "ev-regret-case-studies",
    title: "5 People Who Regretted Buying an EV — And Exactly Why",
    excerpt: "Real stories: no home charging, underestimated cold weather, wrong model for the use case.",
    badge: "Case Studies",
    time: "10 min",
  },
  {
    slug: "ev-winter-prep-checklist",
    title: "Winter EV Prep: 10 Things to Do Before the First Frost",
    excerpt: "Cold weather cuts EV range 20–40%. These 10 steps prevent most cold-weather surprises.",
    badge: "Checklist",
    time: "7 min",
  },
  {
    slug: "apartment-ev-ownership",
    title: "Can You Own an EV Without a Garage? A Realistic Guide",
    excerpt: "Over 40M Americans rent without private parking. Here's an honest look at apartment EV ownership.",
    badge: "Guide",
    time: "8 min",
  },
  {
    slug: "offo-ev-fit-check-insights",
    title: "Three Months of OFFO: What 286 Real EV Fit Checks Revealed",
    excerpt: "Which vehicles buyers compare most, what predicts readiness, and the signal that surprised us.",
    badge: "Data Report",
    time: "7 min",
  },
];

export default function EvBatteryHealthGuidePage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Breadcrumb */}
        <nav className="text-sm text-white/40 mb-8">
          <Link href="/" className="hover:text-white/70 transition-colors">OFFO</Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="hover:text-white/70 transition-colors">Guides</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">EV Battery Health</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold text-[#00d97e] uppercase tracking-wider mb-3">Battery & Fit</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            EV Battery Health & Charging Fit Guide
          </h1>
          <p className="text-lg text-white/50 max-w-2xl">
            What battery degradation actually means, how climate affects real-world range, how to tell if an EV fits your charging life, and why Carfax can&apos;t tell you any of this.
          </p>
        </div>

        {/* Key concept callout */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-6 py-5 mb-12">
          <p className="text-sm font-semibold text-white mb-2">The thing Carfax can&apos;t tell you</p>
          <p className="text-sm text-white/50 leading-relaxed">
            Battery degradation isn&apos;t an event that gets reported to a DMV or insurance company. It&apos;s a continuous process. A 2019 Nissan LEAF with 60,000 miles could have lost 25% of its original range — or none at all, depending on how it was charged. No traditional VIN report tracks this. OFFO estimates it from degradation curves calibrated by make, model, year, and mileage.
          </p>
          <Link href="/receipt" className="inline-block mt-3 text-sm font-semibold text-[#00d97e] hover:text-[#00c970] transition-colors">
            Check a listing free →
          </Link>
        </div>

        {/* Post grid */}
        <div className="grid gap-4">
          {BATTERY_POSTS.map((post) => (
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
          <Link href="/guides/buying-a-used-ev" className="text-[#00d97e] hover:text-[#00c970] transition-colors">
            ← Full buying guide
          </Link>
          <Link href="/guides/ev-dealer-resources" className="text-white/40 hover:text-white/70 transition-colors">
            Dealer resources →
          </Link>
        </div>
      </div>
    </div>
  );
}
