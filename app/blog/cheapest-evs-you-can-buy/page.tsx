"use client";

import Link from "next/link";
import RelatedPosts from "@/components/RelatedPosts";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

const VEHICLES = [
  {
    rank: "Best Overall",
    rankColor: "text-[#00d97e]",
    year: "2019–2022",
    make: "Chevrolet",
    model: "Bolt EV",
    price: "$10,000–$16,000",
    range: "238 mi EPA / ~215 mi real-world",
    winterRange: "~155 mi (35% drop in freezing temps)",
    dcfc: "55 kW (CCS)",
    connector: "CCS",
    chemistry: "NMC",
    verdict: "The Bolt is the best cheap EV you can buy. Wide availability, good real-world range for the money, and GM's reliability track record improved significantly after the 2022 battery recall was addressed. Buy post-recall (after Aug 2022 VIN cutoff).",
    watch: "Pre-recall 2020–2021 Bolts had a fire risk — verify the recall was completed before buying.",
  },
  {
    rank: "Best Range for Under $12K",
    rankColor: "text-blue-300",
    year: "2021–2022",
    make: "Nissan",
    model: "Leaf (40 kWh)",
    price: "$8,500–$13,000",
    range: "149 mi EPA / ~130 mi real-world",
    winterRange: "~95 mi (27% drop)",
    dcfc: "50 kW (CHAdeMO) — fading network",
    connector: "CHAdeMO + J1772",
    chemistry: "NMC",
    verdict: "The Leaf is cheap and widely available, but CHAdeMO fast charging is being phased out. If you have home L2 charging and rarely need DCFC, it's a solid city car. If you ever need to road-trip, look elsewhere.",
    watch: "CHAdeMO chargers are disappearing. Most new fast chargers are CCS or NACS only.",
  },
  {
    rank: "Best for Cold Climates",
    rankColor: "text-indigo-300",
    year: "2015–2019",
    make: "Volkswagen",
    model: "e-Golf",
    price: "$9,000–$14,000",
    range: "125 mi EPA / ~110 mi real-world",
    winterRange: "~80 mi (27% drop)",
    dcfc: "40 kW (CCS)",
    connector: "CCS",
    chemistry: "NMC",
    verdict: "The e-Golf is underrated. VW's thermal management is solid, the interior is high quality for the price, and parts availability is good. The range is tight for anything beyond a 40-mile daily commute.",
    watch: "Low supply — harder to find than Bolts or Leafs. Budget for CCS adapter if your home setup is J1772.",
  },
  {
    rank: "Honorable Mention",
    rankColor: "text-white/50",
    year: "2019–2021",
    make: "Kia",
    model: "Soul EV",
    price: "$12,000–$18,000",
    range: "111 mi EPA (64 kWh: 243 mi EPA)",
    winterRange: "~80–185 mi depending on pack",
    dcfc: "100 kW CCS (64 kWh) / 50 kW (30 kWh)",
    connector: "CCS + CHAdeMO",
    chemistry: "NMC",
    verdict: "The 64 kWh Soul EV is actually a solid deal if you can find one under $18K. The 30 kWh version is not — range is too limited. Both have CCS and CHAdeMO dual-port fast charging, which is rare at this price.",
    watch: "The 30 kWh version has very limited range for anything beyond local driving. Verify which pack you're buying.",
  },
];

const RELATED = [
  { slug: "best-budget-evs-2025", title: "Best Used EVs Under $25K in 2025", badge: "Buyer's Guide", badgeColor: "bg-green-500/20 text-green-300", excerpt: "The models that deliver the most range, reliability, and charging speed per dollar." },
  { slug: "used-ev-buying-checklist", title: "Used EV Buying Checklist: 10 Things to Check Before You Buy", badge: "Checklist", badgeColor: "bg-amber-500/20 text-amber-300", excerpt: "Battery health, charging capability, software updates, recalls — the complete list." },
  { slug: "ev-vin-report-guide", title: "EV VIN Report: What It Shows and What It Misses", badge: "Buyer's Guide", badgeColor: "bg-blue-500/20 text-blue-300", excerpt: "Why standard VIN reports aren't enough for used EVs — and what to check instead." },
];

export default function CheapestEvsPage() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/blog" className="text-[#00d97e] hover:text-[#00d97e]/80 font-medium text-sm mb-5 inline-block transition-colors">
            &larr; Back to Blog
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-300">
              Buyer&rsquo;s Guide
            </span>
            <span className="text-white/30 text-xs">7 min read</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Cheapest EVs You Can Buy in 2026 (Under $15K, Real-World Tested)
          </h1>
          <p className="text-lg text-white/60 mb-6 leading-relaxed">
            The used EV market has cheap options — but not all cheap EVs are good deals.
            Some have aging charging networks, fire-risk recall history, or range so low they&rsquo;re
            only useful as city cars. Here&rsquo;s the honest breakdown.
          </p>
          <div className="flex items-center gap-3 text-white/30 text-sm">
            <span>OFFO Labs</span>
            <span>&middot;</span>
            <span>May 2026</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-10">
        <div className="prose prose-invert prose-lg max-w-none">

          <p className="text-white/70 mb-8">
            Sub-$15K used EVs exist in real volume now. The Chevy Bolt has depreciated dramatically,
            early Nissan Leafs are widely available, and VW e-Golfs are quietly sitting on lots
            underpriced. But each has a catch — and buying the wrong one is an expensive mistake
            that won&rsquo;t show up in a standard Carfax report.
          </p>

          <h2 className="text-2xl font-bold text-white mb-6">The rankings</h2>

          <div className="space-y-6 mb-10">
            {VEHICLES.map((v, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${v.rankColor} mb-1 block`}>{v.rank}</span>
                    <h3 className="text-xl font-bold text-white">{v.year} {v.make} {v.model}</h3>
                    <p className="text-[#00d97e] font-semibold text-sm mt-0.5">{v.price}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 text-sm">
                  <div><span className="text-white/40">Range: </span><span className="text-white/80">{v.range}</span></div>
                  <div><span className="text-white/40">Winter: </span><span className="text-white/80">{v.winterRange}</span></div>
                  <div><span className="text-white/40">Fast charge: </span><span className="text-white/80">{v.dcfc}</span></div>
                  <div><span className="text-white/40">Connector: </span><span className="text-white/80">{v.connector}</span></div>
                </div>

                <p className="text-white/70 text-sm leading-relaxed mb-3">{v.verdict}</p>

                <div className="flex items-start gap-2 bg-yellow-500/[0.06] border border-yellow-500/20 rounded-lg px-3 py-2">
                  <span className="text-yellow-400 text-xs font-bold mt-0.5 flex-shrink-0">WATCH</span>
                  <p className="text-yellow-400/80 text-xs leading-relaxed">{v.watch}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">What makes a cheap EV actually worth buying</h2>
          <p className="text-white/70 mb-5">
            Price alone doesn&rsquo;t make a cheap EV a good deal. Three things do:
          </p>
          <div className="space-y-3 mb-8">
            {[
              { title: "Battery health above 80%", body: "Below 80%, real-world range drops sharply and the vehicle becomes difficult to resell. Ask for a battery health screenshot or use OFFO to estimate it from listing data." },
              { title: "CCS or NACS connector", body: "CHAdeMO is being phased out. Investing in a cheap Leaf now means using a shrinking network of fast chargers. If you need to fast charge at all, make sure the car has CCS or NACS." },
              { title: "No open recalls", body: "The Chevy Bolt had a major battery fire recall. The Nissan Leaf had a 12V battery drain issue. Check NHTSA.gov or run an OFFO report before buying any cheap EV — don't assume the dealer fixed it." },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#00d97e] flex-shrink-0" />
                <div>
                  <span className="text-white font-semibold text-sm">{item.title} — </span>
                  <span className="text-white/60 text-sm">{item.body}</span>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">Before you buy any cheap EV</h2>
          <p className="text-white/70 mb-6">
            The listing price is rarely the full story. Run a free OFFO report on any listing to check
            recalls, battery health estimate, and whether the asking price is fair compared to real market
            comps. It takes under 60 seconds and costs nothing.
          </p>

          <div className="rounded-2xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] p-6 mb-10">
            <p className="text-white font-semibold mb-2">Check any EV listing before you buy</p>
            <p className="text-white/50 text-sm mb-4">
              Paste a used EV listing URL and get a free report — open recalls, battery health estimate,
              and market price comparison. Works on Carvana, CarGurus, dealer sites, and private listings.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#00d97e] text-[#0d1117] font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#00d97e]/90 transition-colors"
            >
              Run a free check &rarr;
            </Link>
          </div>

          <h2 className="text-2xl font-bold text-white mb-5">FAQ</h2>
          <div className="space-y-4 mb-10">
            {[
              {
                q: "What's the cheapest EV you can buy right now?",
                a: "The Chevrolet Bolt EV (2019–2021) regularly sells for $10,000–$13,000 in good condition. Post-recall 2022 models go for $13,000–$16,000. It's the best value in the under-$15K EV market as of 2026.",
              },
              {
                q: "Is a cheap used EV reliable?",
                a: "EVs have far fewer mechanical failure points than gas cars (no transmission, no oil changes, fewer moving parts). The main risk is battery degradation — not mechanical failure. A Chevy Bolt with 60,000 miles and 85% battery health is more reliable than most $12K gas cars.",
              },
              {
                q: "Should I buy a Nissan Leaf under $10K?",
                a: "Only if you have home L2 charging, never need to fast charge, and your daily round-trip is under 60 miles. At those constraints, an older Leaf is fine. If you need road-trip capability, the leaf is the wrong car at any price.",
              },
              {
                q: "What's the biggest mistake people make buying a cheap EV?",
                a: "Not checking battery health. Two identical Leafs at the same price can have 25% different usable range depending on how the previous owner charged them. Always get a battery health estimate before buying — OFFO provides this free from any listing URL.",
              },
            ].map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                <p className="text-sm font-semibold text-white mb-2">{faq.q}</p>
                <p className="text-sm text-white/60 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

        </div>

        <RelatedPosts posts={RELATED} />
      </article>
    </div>
  );
}
