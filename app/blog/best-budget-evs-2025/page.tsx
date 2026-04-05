"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function BestBudgetEvs2025() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-br from-green-50 to-emerald-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/blog" className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block">
            ← Back to Blog
          </Link>
          <div className="mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800">Buyer&apos;s Guide</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Best Used EVs Under $25K in 2025
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>9 min read</span>
            <span>·</span>
            <span>March 28, 2026</span>
            <span>·</span>
            <span>OFFO Lab</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="text-xl leading-relaxed mb-8">
            Used EV prices have dropped 30–40% since their 2022 peak. A 2021 Chevy Bolt that sold for $32,000 in 2022 now trades for $16,000–$19,000. A 2020 Model 3 Standard Range that peaked above $40,000 is now $21,000–$25,000.
          </p>

          <p className="leading-relaxed mb-8">
            The catch: not all of these deals are equal. Some of those price drops reflect real value. Others reflect degraded batteries, known reliability issues, or high insurance costs. Here&apos;s what the data actually shows.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-6">The Rankings</h2>

          {/* Bolt */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">1. Chevy Bolt EV (2022–2023)</h3>
              <span className="text-sm font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">Best Overall</span>
            </div>
            <p className="text-sm text-gray-600 mb-3"><strong>Price range:</strong> $16,000–$22,000 | <strong>Range:</strong> 259 mi EPA</p>
            <p className="text-sm leading-relaxed text-gray-700">
              The 2022+ Bolt has the battery recall resolved (new cells from LG Energy Solution) and 259 miles of real-world range at a price that&apos;s genuinely hard to beat. Degradation data from high-mileage Bolts is excellent — under 8% at 100,000 miles is common. The main drawbacks: no DC fast charging above 55 kW (slow by modern standards), and no heat pump (cold-weather range suffers more than competitors). For mild climates or short-to-medium commutes, it&apos;s the best value in the used EV market.
            </p>
          </div>

          {/* Model 3 SR */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">2. Tesla Model 3 Standard Range (2020–2022)</h3>
              <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">Best Supercharger Access</span>
            </div>
            <p className="text-sm text-gray-600 mb-3"><strong>Price range:</strong> $19,000–$25,000 | <strong>Range:</strong> 272 mi EPA</p>
            <p className="text-sm leading-relaxed text-gray-700">
              Tesla&apos;s Supercharger network remains the best fast-charging experience in the US — 250 kW peak on V3 chargers, nationwide coverage, and in-nav route planning. The Standard Range (LFP battery on 2021+) can charge to 100% daily without degradation concerns, unlike NMC cells. The tradeoff: LFP has worse cold-weather performance than NMC. Pre-2021 Standard Range (NMC) has better cold performance but needs conservative charging habits.
            </p>
          </div>

          {/* Ioniq 5 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">3. Hyundai Ioniq 5 Standard Range (2022)</h3>
              <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">Best Cold-Weather Under $25K</span>
            </div>
            <p className="text-sm text-gray-600 mb-3"><strong>Price range:</strong> $22,000–$26,000 | <strong>Range:</strong> 220 mi EPA</p>
            <p className="text-sm leading-relaxed text-gray-700">
              The Ioniq 5 Standard Range (58 kWh battery) is often findable at the top of the $25K budget for 2022 model years. The heat pump, 800V architecture (18-minute 10–80% fast charge at 350 kW stations), and excellent cold-weather retention make it the best-in-class for cold climates at this price. The range is lower than the Bolt or Model 3 at 220 miles, but the charging speed compensates on longer trips.
            </p>
          </div>

          {/* Nissan Leaf warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">Nissan Leaf (2018–2021) — Proceed with Caution</h3>
              <span className="text-sm font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">Caveat Buyer</span>
            </div>
            <p className="text-sm text-gray-600 mb-3"><strong>Price range:</strong> $10,000–$16,000 | <strong>Range:</strong> 149–212 mi EPA (new)</p>
            <p className="text-sm leading-relaxed text-gray-700">
              The Leaf is cheap for a reason. Without active thermal management (only added on the Leaf e+ 62 kWh), the battery degrades faster in hot climates and with frequent DC fast charging. A 2019 Leaf with 60,000 miles in Phoenix or Texas may have 20%+ degradation. Always pull a battery health report before buying. In mild climates with modest mileage, a Leaf can still be good value — just budget for it delivering 10–20% less range than EPA estimates.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">What to Check Before Buying Any Used EV</h2>
          <ul className="space-y-2 mb-8">
            <li className="flex gap-2"><span className="text-blue-500">1.</span> Pull a battery state-of-health report via OBD port (costs $20–$50 at most EV shops)</li>
            <li className="flex gap-2"><span className="text-blue-500">2.</span> Run the VIN through NHTSA for open recalls</li>
            <li className="flex gap-2"><span className="text-blue-500">3.</span> Check title status — flood/salvage titles require extra scrutiny</li>
            <li className="flex gap-2"><span className="text-blue-500">4.</span> Verify charging port compatibility with your local infrastructure</li>
            <li className="flex gap-2"><span className="text-blue-500">5.</span> Get insurance quotes before buying — some EVs have significantly higher premiums</li>
          </ul>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-8">
            <p className="font-semibold text-blue-800 mb-2">Check any used EV listing automatically</p>
            <p className="text-sm text-blue-700 mb-3">
              Paste a CarGurus, AutoTrader, or Carvana URL into OFFO and get a full AI analysis of title risk, recalls, and fair market value in under 60 seconds.
            </p>
            <a href="/receipt" className="inline-block bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Check a Listing →
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}
