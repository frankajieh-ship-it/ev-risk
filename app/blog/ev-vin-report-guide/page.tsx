"use client";

import Link from "next/link";
import RelatedPosts from "@/components/RelatedPosts";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

const EV_SIGNALS = [
  { signal: "Open recall status", standard: "✓ Yes", evSpecific: "✓ Yes", notes: "Standard reports show open recalls, but don't flag EV-specific ones (battery, charging system)" },
  { signal: "Accident & title history", standard: "✓ Yes", evSpecific: "✓ Yes", notes: "Both cover this equally" },
  { signal: "Battery degradation estimate", standard: "✗ No", evSpecific: "✓ Yes", notes: "Critical for EVs — a 30% degraded battery cuts usable range by 30%" },
  { signal: "DC fast charge capability (kW)", standard: "✗ No", evSpecific: "✓ Yes", notes: "Determines road-trip viability — 50kW vs 250kW is a massive lifestyle difference" },
  { signal: "Battery chemistry (LFP vs NMC)", standard: "✗ No", evSpecific: "✓ Yes", notes: "LFP batteries handle cold worse but tolerate 100% daily charging; NMC does not" },
  { signal: "Connector type (NACS/CCS/CHAdeMO)", standard: "✗ No", evSpecific: "✓ Yes", notes: "CHAdeMO (old Leafs) is being phased out — affects where you can fast charge" },
  { signal: "EV-specific recall completion", standard: "⚠ Partial", evSpecific: "✓ Yes", notes: "Standard reports show recalls but not whether the EV-specific fix was completed" },
  { signal: "Market price vs comparables", standard: "✓ Yes", evSpecific: "✓ Yes", notes: "EV-specific tools account for tax credit eligibility and battery condition in pricing" },
];

const RELATED = [
  { slug: "best-carfax-alternatives-2026", title: "Best Carfax Alternatives of 2026 — Tested Head-to-Head", badge: "Comparison", badgeColor: "bg-green-500/20 text-green-300", excerpt: "We tested 7 VIN report services head-to-head. OFFO ranks #1 for used EV buyers." },
  { slug: "carfax-alternative-used-ev", title: "I Was Paying $45 for Carfax Reports. Then I Found a Better Way.", badge: "Buyer's Guide", badgeColor: "bg-blue-500/20 text-blue-300", excerpt: "After testing every major VIN report on real EV listings, one free tool changed everything." },
  { slug: "used-ev-buying-checklist", title: "Used EV Buying Checklist: 10 Things to Check Before You Buy", badge: "Checklist", badgeColor: "bg-amber-500/20 text-amber-300", excerpt: "Battery health, charging capability, software updates, 12V battery, recalls — the full list." },
];

export default function EvVinReportGuidePage() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/blog" className="text-[#00d97e] hover:text-[#00d97e]/80 font-medium text-sm mb-5 inline-block transition-colors">
            &larr; Back to Blog
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300">
              Buyer&rsquo;s Guide
            </span>
            <span className="text-white/30 text-xs">8 min read</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            EV VIN Report: What It Shows, What It Misses, and the Free Tool That Does It Better
          </h1>
          <p className="text-lg text-white/60 mb-6 leading-relaxed">
            A standard VIN report tells you about accidents, title history, and odometer readings.
            For a gas car, that&rsquo;s mostly enough. For a used EV, it misses the things that actually
            determine whether you&rsquo;re buying a deal or a disaster.
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

          {/* What a VIN report is */}
          <h2 className="text-2xl font-bold text-white mt-0 mb-3">What a VIN report actually is</h2>
          <p className="text-white/70 mb-6">
            A VIN (Vehicle Identification Number) report is a document that pulls data from insurance
            companies, DMVs, auctions, and salvage yards to reconstruct a vehicle&rsquo;s history. The VIN
            is the 17-character code stamped on your dashboard — every car has one, and every significant
            event in that car&rsquo;s life (accidents, title transfers, odometer readings) gets attached to it.
          </p>
          <p className="text-white/70 mb-8">
            Services like Carfax, AutoCheck, and NMVTIS all pull this data. For a gas car, the main
            concerns are accident severity, salvage title, odometer rollback, and outstanding liens.
            A VIN report catches all of those. But for an electric vehicle, those four categories
            miss the most expensive thing that can go wrong.
          </p>

          {/* What standard reports miss */}
          <h2 className="text-2xl font-bold text-white mb-3">What standard VIN reports miss for EVs</h2>
          <p className="text-white/70 mb-5">
            The biggest risks in a used EV purchase aren&rsquo;t in the accident history — they&rsquo;re in the
            battery and charging system. Standard VIN reports don&rsquo;t touch either.
          </p>
          <div className="space-y-4 mb-8">
            {[
              {
                title: "Battery degradation",
                body: "Every EV battery loses capacity over time. A 2019 Nissan Leaf with 80,000 miles might have 78% of its original range — or 62%. There's no VIN-based record of this. You need a live battery health check or an estimate based on mileage, climate history, and charging behavior.",
              },
              {
                title: "DC fast charge capability",
                body: "A first-gen Nissan Leaf (CHAdeMO, 50kW) and a 2024 Hyundai Ioniq 6 (CCS, 233kW) are both 'EVs' — but the road-trip experience is completely different. Standard VIN reports don't tell you charging speed or connector type.",
              },
              {
                title: "Battery chemistry (LFP vs NMC)",
                body: "LFP (lithium iron phosphate) batteries — used in some Tesla Model 3s and Chevy Bolts — tolerate 100% daily charging and handle cold differently than NMC batteries. This affects your charging routine. No standard VIN report includes this.",
              },
              {
                title: "EV-specific recall completion",
                body: "Many EVs have had safety recalls specific to their battery or charging system. Carfax shows open recalls, but not whether the EV-specific software fix or physical repair was actually completed at the dealer.",
              },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                <p className="text-sm text-white/60 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          {/* EV-specific VIN signals table */}
          <h2 className="text-2xl font-bold text-white mb-3">EV VIN report: what you should be checking</h2>
          <p className="text-white/70 mb-5">
            Here&rsquo;s a comparison of what standard VIN report services cover vs. what an EV-specific
            report should include:
          </p>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-3 pr-4 text-white/50 font-medium">Signal</th>
                  <th className="text-left py-3 pr-4 text-white/50 font-medium">Standard (Carfax)</th>
                  <th className="text-left py-3 text-white/50 font-medium">EV-Specific (OFFO)</th>
                </tr>
              </thead>
              <tbody>
                {EV_SIGNALS.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="py-3 pr-4 text-white/80 font-medium">{row.signal}</td>
                    <td className={`py-3 pr-4 font-mono text-sm ${row.standard.startsWith("✓") ? "text-[#00d97e]" : row.standard.startsWith("⚠") ? "text-yellow-400" : "text-red-400"}`}>{row.standard}</td>
                    <td className={`py-3 font-mono text-sm ${row.evSpecific.startsWith("✓") ? "text-[#00d97e]" : "text-red-400"}`}>{row.evSpecific}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* How to read an EV VIN report */}
          <h2 className="text-2xl font-bold text-white mb-3">How to read an EV VIN report — step by step</h2>
          <p className="text-white/70 mb-5">
            Whether you&rsquo;re using OFFO or any other service, here&rsquo;s how to actually evaluate what you&rsquo;re seeing:
          </p>
          <ol className="space-y-4 mb-8 list-none pl-0">
            {[
              { n: "1", title: "Start with open recalls", body: "Any unaddressed recall is a negotiation lever — or a reason to walk away if it's battery-related. Check NHTSA.gov independently as a cross-reference." },
              { n: "2", title: "Check the title and accident severity", body: "Salvage, flood, or lemon law buyback titles are red lines. Moderate accidents (under $5K) on an EV with clean battery health may still be fine." },
              { n: "3", title: "Get a battery degradation estimate", body: "OFFO estimates remaining capacity from mileage, climate history, and model data. If the report doesn't include this, ask the seller for a screenshot of the battery health app (Tesla, Kia Connect, etc.)." },
              { n: "4", title: "Confirm DC fast charge capability", body: "Look up the model's max DCFC rate. Anything under 50kW makes road trips painful. Under 25kW is a dealbreaker for most buyers." },
              { n: "5", title: "Verify connector type", body: "NACS (Tesla-standard) = wide network access. CCS = growing. CHAdeMO (older Leafs) = shrinking fast. Know what you're getting into before you buy." },
              { n: "6", title: "Compare to market price", body: "Battery degradation should affect price. A Leaf at 80% SOH should not cost the same as one at 95%. Use the price comparison to anchor your negotiation." },
            ].map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="w-7 h-7 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/30 flex items-center justify-center text-[#00d97e] text-xs font-bold flex-shrink-0 mt-0.5">{step.n}</span>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">{step.title}</p>
                  <p className="text-white/60 text-sm leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* OFFO section */}
          <h2 className="text-2xl font-bold text-white mb-3">The free EV VIN report tool</h2>
          <p className="text-white/70 mb-4">
            OFFO generates a free EV VIN report by analyzing any used EV listing URL — from Carvana,
            CarGurus, dealer sites, or private listings. It pulls recall data from NHTSA, pricing from
            live market comparables, and combines that with EV-specific battery and charging signals
            that Carfax and AutoCheck don&rsquo;t cover.
          </p>
          <p className="text-white/70 mb-6">
            The free report includes open recalls, accident summary, battery health estimate, and
            market price vs. comparables. The full report ($3.99) adds a plain-English risk verdict,
            three copy-paste negotiation scripts, and a charging fit score for your specific routine.
          </p>

          <div className="rounded-2xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] p-6 mb-10">
            <p className="text-white font-semibold mb-2">Get a free EV VIN report</p>
            <p className="text-white/50 text-sm mb-4">
              Paste any used EV listing URL. See open recalls, battery health, and market price in seconds.
              No sign-up required.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#00d97e] text-[#0d1117] font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#00d97e]/90 transition-colors"
            >
              Check a listing free &rarr;
            </Link>
          </div>

          {/* FAQ */}
          <h2 className="text-2xl font-bold text-white mb-5">Frequently asked questions</h2>
          <div className="space-y-5 mb-10">
            {[
              {
                q: "What is an EV VIN report?",
                a: "An EV VIN report is a vehicle history report that includes electric-vehicle-specific data — battery degradation, charging capability, connector type, and EV-specific recalls — in addition to the standard accident and title history that Carfax shows.",
              },
              {
                q: "Does Carfax show battery health for used EVs?",
                a: "No. Carfax does not report battery degradation, state of health (SOH), DC fast charge speed, or battery chemistry for used electric vehicles. You need an EV-specific service to get those signals.",
              },
              {
                q: "Is an EV VIN report free?",
                a: "OFFO provides a free EV VIN report — paste any listing URL and get recalls, battery health estimate, and price comparison instantly with no sign-up. A detailed report with negotiation scripts is $3.99.",
              },
              {
                q: "What's the most important thing in an EV VIN report?",
                a: "Battery degradation. A standard gas car depreciates mainly on age and mileage. An EV depreciates on battery condition. Two identical-year identical-mileage EVs can have vastly different remaining battery capacity — and Carfax won't tell you which is which.",
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
