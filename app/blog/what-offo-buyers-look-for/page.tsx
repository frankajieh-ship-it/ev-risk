"use client";

import Link from "next/link";
import RelatedPosts from "@/components/RelatedPosts";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

const BUYER_CHECKS = [
  {
    rank: "01",
    title: "Battery Health",
    verdict: "The first flag",
    description:
      "Battery degradation is the first thing OFFO checks and the most common reason a receipt gets flagged caution. Buyers want to know: how much range has this battery lost relative to its EPA rating? Models like the 2011–2017 Nissan Leaf (passive thermal management) and early Chevy Bolts carry higher degradation risk at high mileage. Models with active cooling — Tesla, Hyundai Ioniq 5, Kia EV6 — hold up better.",
    dealerAction:
      "If you have OBD or manufacturer SOH data, include it in the listing description. Buyers who see verified battery data skip the skepticism step.",
  },
  {
    rank: "02",
    title: "Title Status",
    verdict: "The trust signal",
    description:
      "Clean title is table stakes. Rebuilt and salvage titles are flagged immediately on OFFO receipts — not because they can't be good deals, but because EV buyers are especially cautious about whether a prior accident involved the battery pack or charging system. A rebuilt-title EV with no documentation of battery inspection will sit.",
    dealerAction:
      "For rebuilt-title units, document the repair scope explicitly in the listing. A rebuilt title with documented battery-safe repair sells. A rebuilt title with no notes just generates lowball offers.",
  },
  {
    rank: "03",
    title: "Accidents Reported",
    verdict: "Context matters",
    description:
      "Accident history is weighed against repair documentation. A minor fender-bender with documented repair is less concerning than a zero-accident report with structural inconsistencies. OFFO cross-references accident flags with the vehicle's current condition description and price — buyers look for mismatch signals.",
    dealerAction:
      "If there's an accident on record, proactively describe what was repaired and provide documentation. Buyers who feel informed don't lowball. Buyers who feel misled disappear.",
  },
  {
    rank: "04",
    title: "Range vs. Charging Fit",
    verdict: "The lifestyle check",
    description:
      "OFFO buyers run a charging fit score alongside the receipt. They want to know: will this vehicle's range work for my commute, given where I can charge? A 149-mile Nissan Leaf is a great fit for a buyer with home L2 charging and a 35-mile round-trip commute. It's a terrible fit for someone with no home charging who needs to road-trip. The vehicle isn't the issue — the fit is.",
    dealerAction:
      "List range and charging specs prominently: EPA range, DCFC speed, connector type. Buyers who know this upfront self-select. You get fewer bad-fit inquiries and more serious buyers.",
  },
  {
    rank: "05",
    title: "Price vs. Market",
    verdict: "The credibility check",
    description:
      "OFFO compares every listing price to market comps for the same year/make/model/mileage range. Listings priced more than 8–10% above comparable units without a clear condition advantage generate caution flags. Buyers don't expect the cheapest price — they expect a price that makes sense. Unexplained premiums read as 'dealer is hoping I don't check.'",
    dealerAction:
      "If you're pricing above market, name the reason in the listing: low mileage, documented battery health, recent service, clean two-owner history. Give buyers the story they need to justify the price.",
  },
];

const LISTING_TIPS = [
  { icon: "✓", text: "List connector type (CCS / CHAdeMO / NACS / J1772)" },
  { icon: "✓", text: "List DCFC max speed in kW" },
  { icon: "✓", text: "Include EPA range and model year battery pack size" },
  { icon: "✓", text: "Note any completed recalls with NHTSA completion date" },
  { icon: "✓", text: "If you have SOH data, include it — even if it's just 'battery check passed'" },
  { icon: "✓", text: "For rebuilt titles, describe the repair scope explicitly" },
  { icon: "✓", text: "Price within 8% of market unless you can name the premium" },
];

const RELATED = [
  { slug: "how-to-price-used-ev-inventory", title: "How to Price Your Used EV Inventory", badge: "Dealer Guide", badgeColor: "bg-purple-500/20 text-purple-300", excerpt: "Battery SOH, charging port generation, recall history — the 4 factors EV buyers use to judge your price." },
  { slug: "ev-vin-report-guide", title: "EV VIN Report: What It Shows and What It Misses", badge: "Buyer's Guide", badgeColor: "bg-blue-500/20 text-blue-300", excerpt: "Standard VIN reports miss battery degradation, DCFC speed, and EV-specific recalls." },
  { slug: "used-ev-buying-checklist", title: "Used EV Buying Checklist: 10 Things to Check Before You Buy", badge: "Checklist", badgeColor: "bg-amber-500/20 text-amber-300", excerpt: "Battery health, charging capability, software updates, recalls — the complete list." },
];

export default function WhatOFFOBuyersLookForPage() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/blog" className="text-xs text-white/40 hover:text-white/60 transition-colors">← Blog</Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">For Dealers</span>
            <span className="text-xs text-white/30">8 min read</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            What OFFO Buyers Look for in a Used EV
          </h1>
          <p className="text-lg text-white/60 leading-relaxed">
            Battery health, title status, range vs. charging fit, price vs. market — the 5 things every data-driven EV buyer checks before contacting a dealer.
          </p>
          <p className="text-xs text-white/30 mt-4">May 23, 2026 · OFFO Lab</p>
        </div>

        {/* Buyer profile */}
        <div className="bg-[#161b22] border border-white/[0.07] rounded-xl p-6 mb-12">
          <p className="text-xs font-semibold text-[#00d97e] uppercase tracking-widest mb-3">The OFFO Buyer Profile</p>
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            OFFO buyers are not impulse shoppers. They&apos;ve already decided they want an EV. They&apos;re doing the hard research — battery chemistry, charging network coverage, real-world range in their climate — before they ever contact a dealer.
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            They paste listing URLs into OFFO and get a receipt: a structured risk breakdown that flags battery degradation risk, open recalls, price vs. market, and charging fit for their specific commute. By the time they reach out to you, they know more about the vehicle than most ICE buyers ever learn.
          </p>
        </div>

        {/* 5 checks */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6">The 5 Things Buyers Check on Every Receipt</h2>
          <div className="space-y-6">
            {BUYER_CHECKS.map((c) => (
              <div key={c.rank} className="bg-[#161b22] rounded-xl border border-white/[0.07] p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-mono text-white/30">{c.rank}</span>
                  <h3 className="text-base font-semibold text-white">{c.title}</h3>
                  <span className="text-xs text-white/40 italic">{c.verdict}</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-4">{c.description}</p>
                <div className="bg-[#00d97e]/[0.06] border border-[#00d97e]/20 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-[#00d97e] mb-1">For dealers</p>
                  <p className="text-xs text-[#00d97e]/80 leading-relaxed">{c.dealerAction}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Risky vs recommended */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-4">What Gets a Listing Flagged &quot;Risky&quot; vs. &quot;Recommended&quot;</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-red-500/[0.05] border border-red-500/20 rounded-xl p-5">
              <p className="text-sm font-semibold text-red-400 mb-3">Risky flags</p>
              <ul className="space-y-2">
                {[
                  "Open battery or safety recall",
                  "Rebuilt title with no repair documentation",
                  "CHAdeMO-only on a vehicle priced like CCS",
                  "Price >10% above market without explanation",
                  "High mileage on a passive-thermal-management model",
                ].map((f) => (
                  <li key={f} className="text-xs text-white/50 flex items-start gap-2">
                    <span className="text-red-400 shrink-0">✗</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#00d97e]/[0.05] border border-[#00d97e]/20 rounded-xl p-5">
              <p className="text-sm font-semibold text-[#00d97e] mb-3">Recommended signals</p>
              <ul className="space-y-2">
                {[
                  "Documented battery health / SOH check",
                  "Completed recalls noted in listing",
                  "CCS or NACS fast charging",
                  "Price within 5% of market comps",
                  "Clean title, one or two owners",
                ].map((f) => (
                  <li key={f} className="text-xs text-white/50 flex items-start gap-2">
                    <span className="text-[#00d97e] shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">
            Dealers with an OFFO Verified badge have a consistent advantage: buyers see the badge on every receipt for vehicles in that dealer&apos;s inventory. It signals that the dealer stands behind the data — which is the one thing an informed EV buyer values most.
          </p>
        </section>

        {/* Listing checklist */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-5">The Listing Checklist</h2>
          <div className="bg-[#161b22] border border-white/[0.07] rounded-xl p-6">
            <p className="text-xs text-white/40 mb-4">What to include in every EV listing description to minimize OFFO caution flags</p>
            <div className="space-y-3">
              {LISTING_TIPS.map((t) => (
                <div key={t.text} className="flex items-start gap-3">
                  <span className="text-[#00d97e] text-sm font-bold shrink-0">{t.icon}</span>
                  <span className="text-sm text-white/70">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-[#161b22] border border-[#00d97e]/20 rounded-2xl p-8 text-center mb-12">
          <h2 className="text-xl font-bold text-white mb-3">OFFO Verified Dealers Get More Serious Buyers</h2>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            The OFFO Verified badge appears on every receipt a buyer runs for your inventory. It tells them you&apos;re a dealer who stands behind transparency — which is exactly what this buyer profile is looking for.
          </p>
          <Link
            href="/dealers/join"
            className="inline-flex items-center justify-center px-6 py-3 bg-[#00d97e] text-[#0d1117] text-sm font-bold rounded-xl hover:bg-[#00c970] transition-colors"
          >
            Join the OFFO dealer program →
          </Link>
        </div>

        <RelatedPosts posts={RELATED} />
      </div>
    </div>
  );
}
