import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Dealer Resources — Pricing, Inventory, and Buyer Intelligence | OFFO",
  description:
    "Guides for EV dealers: how to price used EV inventory, what OFFO buyers look for before submitting an inquiry, and how to get listed as an OFFO-verified dealer.",
  alternates: {
    canonical: "https://offolab.com/guides/ev-dealer-resources",
  },
};

const DEALER_POSTS = [
  {
    slug: "how-to-price-used-ev-inventory",
    title: "How to Price Your Used EV Inventory (The Dealer's Guide)",
    excerpt: "Battery degradation, charging port generation, recall history — 4 factors data-driven EV buyers use to judge your price.",
    badge: "Dealer Guide",
    time: "9 min",
  },
  {
    slug: "what-offo-buyers-look-for",
    title: "What OFFO Buyers Look for in a Used EV (Dealer Edition)",
    excerpt: "Battery health, title status, range vs. charging fit, price vs. market — what every serious EV buyer checks before inquiring.",
    badge: "For Dealers",
    time: "8 min",
  },
  {
    slug: "how-we-vet-every-ev-deal",
    title: "How We Find and Vet Every Used EV Deal on OFFO",
    excerpt: "From listing page to GREEN verdict — the sourcing, VIN audit, and AI scoring pipeline explained.",
    badge: "How It Works",
    time: "6 min",
  },
];

export default function EvDealerResourcesPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Breadcrumb */}
        <nav className="text-sm text-white/40 mb-8">
          <Link href="/" className="hover:text-white/70 transition-colors">OFFO</Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="hover:text-white/70 transition-colors">Guides</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">EV Dealer Resources</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3">For Dealers</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            EV Dealer Resources
          </h1>
          <p className="text-lg text-white/50 max-w-2xl">
            How to price used EV inventory, what OFFO buyers already know before they contact you, and how to get listed as a verified dealer so high-intent buyers find you first.
          </p>
        </div>

        {/* Dealer CTA */}
        <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl px-6 py-5 mb-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-0.5">Sell EVs? Get listed as an OFFO-verified dealer</p>
            <p className="text-sm text-white/50">Buyers researching your inventory will see your verified badge. Starter: $149/mo. 14-day free trial.</p>
          </div>
          <Link
            href="/for-dealers"
            className="shrink-0 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            See dealer plans →
          </Link>
        </div>

        {/* Post grid */}
        <div className="grid gap-4">
          {DEALER_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block bg-[#161b22] border border-white/[0.08] hover:border-purple-500/30 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{post.badge}</span>
                    <span className="text-[11px] text-white/25">·</span>
                    <span className="text-[11px] text-white/30">{post.time} read</span>
                  </div>
                  <h2 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors leading-snug mb-1.5">
                    {post.title}
                  </h2>
                  <p className="text-sm text-white/40 leading-relaxed">{post.excerpt}</p>
                </div>
                <span className="shrink-0 text-white/20 group-hover:text-purple-300 transition-colors text-lg mt-0.5">→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-white/[0.06] flex flex-wrap gap-4 text-sm">
          <Link href="/guides/buying-a-used-ev" className="text-[#00d97e] hover:text-[#00c970] transition-colors">
            ← Buyer guides
          </Link>
          <Link href="/for-dealers" className="text-white/40 hover:text-white/70 transition-colors">
            Dealer portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
