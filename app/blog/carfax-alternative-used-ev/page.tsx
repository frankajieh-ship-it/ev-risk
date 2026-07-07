import Link from "next/link";
import RelatedPosts from "@/components/RelatedPosts";
import BlogEmailCapture from "@/components/blog/BlogEmailCapture";

const RELATED_POSTS = [
  { slug: "best-carfax-alternatives-2026", title: "Best Carfax Alternatives of 2026 — Tested Head-to-Head", badge: "Comparison", badgeColor: "bg-green-500/20 text-green-300", excerpt: "We tested 7 VIN report services. OFFO ranks #1 for used EV buyers." },
  { slug: "ev-vin-report-guide", title: "EV VIN Report: What It Shows and What It Misses", badge: "Buyer's Guide", badgeColor: "bg-blue-500/20 text-blue-300", excerpt: "Standard reports miss battery degradation, DCFC speed, and EV-specific signals." },
  { slug: "how-we-vet-every-ev-deal", title: "How We Find and Vet Every Used EV Deal on OFFO", badge: "How It Works", badgeColor: "bg-indigo-500/20 text-indigo-300", excerpt: "From listing page to GREEN verdict — the full sourcing and AI scoring pipeline." },
];

export default function CarfaxAlternativeUsedEvPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link
            href="/blog"
            className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm mb-4 inline-block transition-colors"
          >
            ← Back to OFFO Labs Blog
          </Link>
          <div className="mb-3">
            <span className="bg-green-500/15 text-green-400 border border-green-500/20 text-xs font-semibold px-3 py-1 rounded-full">
              Buyer&apos;s Guide
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            I Was Paying $45 for Carfax Reports. Then I Found a Better Way to Shop for Used EVs.
          </h1>
          <p className="text-white/50 text-lg italic mb-4 leading-relaxed">
            After testing every major VIN report service on real EV listings, one tool completely changed how I evaluate deals.
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <span>OFFO Labs</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>6 min read</span>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Intro */}
        <div className="space-y-4 mb-10 text-white/70 leading-relaxed">
          <p>
            Last year I was seriously shopping for a used EV. I was doing everything right — or so I thought.
            I had a spreadsheet, I was cross-referencing prices on CarGurus and AutoTrader, and before
            making any calls I was running a Carfax report on every vehicle that looked promising.
          </p>
          <p>
            At $45 a pop, those reports added up fast. I probably spent over $200 on VIN reports
            before I bought anything. And here&apos;s what frustrated me: every single Carfax told me roughly
            the same thing. Clean title. Two previous owners. A couple of routine service visits.
            No accidents on record.
          </p>
          <p>
            None of them told me anything useful about buying a <em>used EV</em> specifically.
          </p>
        </div>

        {/* Section: What standard reports miss */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">What Standard VIN Reports Don&apos;t Tell You</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Carfax, AutoCheck, and similar services were built for gas cars. They&apos;re excellent at what
            they do — title history, reported accidents, odometer readings, lien checks. But used EV
            buyers have a completely different set of questions that these reports simply don&apos;t answer:
          </p>

          <div className="space-y-3 mb-6">
            {[
              {
                q: "How much battery capacity has degraded?",
                a: "Standard VIN reports have no battery data at all. A 2019 Nissan LEAF could have lost 20% capacity from heavy fast-charging — you'd never know from Carfax.",
              },
              {
                q: "Does this car support DC fast charging?",
                a: "The base Nissan LEAF doesn't have CHAdeMO as standard on all trims. Without DCFC, you're limited to Level 2 — which changes everything about road trip viability.",
              },
              {
                q: "How will range hold up in winter?",
                a: "Cold weather cuts EV range 20–40%. A 150-mile rated car becomes a 90-mile car in January. No VIN report models this.",
              },
              {
                q: "Is the price actually fair for this specific battery chemistry and mileage?",
                a: "Carfax will show you sale history. It won't tell you whether the current asking price is $3,000 above market for a degraded pack.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-2">{q}</p>
                <p className="text-sm text-white/50 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section: What I tried */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">The Report Services I Tested</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Before finding OFFO, I tried pretty much every VIN service out there. Here&apos;s the honest breakdown:
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-3 pr-4 text-white/40 font-medium">Service</th>
                  <th className="text-left py-3 pr-4 text-white/40 font-medium">Price</th>
                  <th className="text-left py-3 text-white/40 font-medium">EV-specific value</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4 font-medium text-white/80">Carfax</td>
                  <td className="py-3 pr-4">$45 / report</td>
                  <td className="py-3 text-red-400">None</td>
                </tr>
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4 font-medium text-white/80">AutoCheck</td>
                  <td className="py-3 pr-4">$30 / report</td>
                  <td className="py-3 text-red-400">None</td>
                </tr>
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4 font-medium text-white/80">NMVTIS</td>
                  <td className="py-3 pr-4">$5 / report</td>
                  <td className="py-3 text-red-400">None</td>
                </tr>
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4 font-medium text-white/80">Dealer pull</td>
                  <td className="py-3 pr-4">&ldquo;Free&rdquo;*</td>
                  <td className="py-3 text-amber-400">None (+ sales pressure)</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#00d97e]">OFFO</td>
                  <td className="py-3 pr-4 text-[#00d97e]">Free</td>
                  <td className="py-3 text-[#00d97e]">Built for EVs specifically</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-white/40 text-xs italic">
            *Dealers will pull a report for free, but you&apos;re now in their sales funnel.
          </p>
        </section>

        {/* Section: How OFFO works */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">How OFFO Actually Works</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            OFFO isn&apos;t a replacement for a VIN history report — it&apos;s a layer on top of it that does the
            EV-specific analysis those reports skip entirely. Here&apos;s what happens when you paste a listing URL:
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm">1</div>
              <div>
                <p className="text-white font-medium mb-1">VIN Extraction &amp; Audit</p>
                <p className="text-white/50 text-sm leading-relaxed">
                  OFFO pulls the VIN from the listing and runs it through VinAudit (accident history,
                  salvage records, theft reports) and the NHTSA database (official decode, open recalls).
                  This is the same underlying data as a paid report — just not wrapped in a $45 PDF.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm">2</div>
              <div>
                <p className="text-white font-medium mb-1">EV-Specific Signal Extraction</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  The system checks whether the listing mentions a battery report, service records,
                  and whether the specific trim supports DC fast charging — the questions standard
                  VIN reports never ask.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm">3</div>
              <div>
                <p className="text-white font-medium mb-1">AI Scoring</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  An AI layer analyzes 50+ structured signals — price vs. market, mileage context,
                  charging friction, ownership history — and produces a risk score and confidence score.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm">4</div>
              <div>
                <p className="text-white font-medium mb-1">Verdict: GREEN / YELLOW / RED</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Hard blockers (salvage title, major frame damage, DCFC absent when required) force RED.
                  Missing evidence or moderate risk produces YELLOW. Clean signals across the board → GREEN.
                  The verdict surfaces in under 30 seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Real example */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">A Real Example: 2021 Chevrolet Bolt</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Here&apos;s what a typical OFFO analysis surfaced on a listing I was considering — a 2021 Chevy Bolt
            EV listed at $18,500 with 38,000 miles:
          </p>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/20 text-xs font-bold px-3 py-1 rounded-full">
                GREEN
              </span>
              <span className="text-white font-medium">2021 Chevrolet Bolt EV · $18,500 · 38k mi</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-black text-[#00d97e]">78</p>
                <p className="text-xs text-white/40 mt-0.5">Deal Quality Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">7.2</p>
                <p className="text-xs text-white/40 mt-0.5">Evidence Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">1.5</p>
                <p className="text-xs text-white/40 mt-0.5">Risk Points</p>
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-xs text-white/40 uppercase tracking-wide font-medium mb-2">Key signals found</p>
              <ul className="text-sm text-white/60 space-y-1">
                <li className="flex gap-2"><span className="text-[#00d97e]">✓</span> VIN decoded — clean title confirmed</li>
                <li className="flex gap-2"><span className="text-[#00d97e]">✓</span> No open safety recalls</li>
                <li className="flex gap-2"><span className="text-[#00d97e]">✓</span> DC fast charging (CCS) confirmed</li>
                <li className="flex gap-2"><span className="text-[#00d97e]">✓</span> Battery health estimated — degradation within normal range</li>
                <li className="flex gap-2"><span className="text-amber-400">~</span> Service records not shown — ask seller</li>
              </ul>
            </div>
          </div>

          <p className="text-white/60 text-sm leading-relaxed">
            The YELLOW flag on service records was exactly the right nudge. I asked the seller,
            they provided maintenance records from a dealership — and the deal closed cleanly.
            None of that came from Carfax.
          </p>
        </section>

        {/* Section: Bottom line */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">The Bottom Line</h2>
          <p className="text-white/70 leading-relaxed mb-4">
            I still recommend pulling a Carfax or AutoCheck if you&apos;re serious about a vehicle — the
            title and accident history data is useful, and for a $20,000+ purchase it&apos;s not a bad
            insurance policy. But it&apos;s not sufficient for used EV shopping.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            OFFO fills the gap that every paid VIN service ignores: the EV-specific due diligence
            that determines whether a car actually fits your life. Battery confidence, charging
            capability, recall status, price context, and a clear verdict — in one place, in under
            30 seconds, free.
          </p>
          <p className="text-white/70 leading-relaxed">
            If I were starting my used EV search today, I&apos;d run OFFO first on every listing before
            deciding which ones warrant a paid VIN report. It would have saved me time, $200 in report
            fees, and a lot of dead-end test drives.
          </p>
        </section>

        {/* CTA */}
        <div className="bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-2xl p-6 mb-10">
          <p className="text-white font-semibold mb-1">Try OFFO free — no sign-up required.</p>
          <p className="text-white/50 text-sm mb-4">
            Paste any CarGurus, AutoTrader, Cars.com, or Carvana listing URL and get a full EV audit
            in under 30 seconds.
          </p>
          <Link
            href="/receipt"
            className="inline-block bg-[#00d97e] hover:bg-[#00c970] text-black font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            Analyze a listing →
          </Link>
        </div>

        {/* Footer nav */}
        <div className="border-t border-white/[0.08] pt-8 flex items-center justify-between">
          <Link href="/blog" className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm transition-colors">
            ← All posts
          </Link>
          <Link href="/receipt" className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm transition-colors">
            Try OFFO free →
          </Link>
        </div>

        <BlogEmailCapture source="blog_carfax_alternative" />

        <RelatedPosts posts={RELATED_POSTS} />
      </main>
    </div>
  );
}
