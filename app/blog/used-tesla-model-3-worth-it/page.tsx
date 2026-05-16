"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import BlogVehicleCTA from "@/components/BlogVehicleCTA";

export default function UsedTeslaModel3Post() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-br from-gray-50 to-blue-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href="/blog"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block"
          >
            &larr; Back to Blog
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Is a Used Tesla Model 3 Worth It in 2026?
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>12 min read</span>
            <span>&middot;</span>
            <span>OFFO Labs</span>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none">
          {/* Intro */}
          <div className="mb-12">
            <p className="text-xl text-gray-700 leading-relaxed mb-6">
              The Tesla Model 3 is the most common used EV on the market. Thousands of off-lease
              units are flooding dealerships, and prices have dropped significantly from the 2022-2023
              peak. A 2021 Long Range that sold for $48,000 new is now listing for $22,000-26,000.
            </p>
            <p className="text-xl text-gray-700 leading-relaxed">
              That sounds like a deal. But is it? Here&rsquo;s what you actually need to know,
              organized by mileage tier.
            </p>
          </div>

          {/* The Market Right Now */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              The Market Right Now
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Used Model 3 prices in early 2026 have stabilized after two years of decline. Here
              are typical asking prices (not sale prices &mdash; actual transaction prices are
              5-10% lower):
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">Year / Trim</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">Mileage</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">Typical Ask</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2020 Standard Range Plus</td>
                    <td className="px-4 py-3 text-gray-700">50-70k mi</td>
                    <td className="px-4 py-3 text-gray-700">$16,000-19,000</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2021 Long Range AWD</td>
                    <td className="px-4 py-3 text-gray-700">30-50k mi</td>
                    <td className="px-4 py-3 text-gray-700">$22,000-26,000</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2022 Performance</td>
                    <td className="px-4 py-3 text-gray-700">20-40k mi</td>
                    <td className="px-4 py-3 text-gray-700">$27,000-32,000</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2024 Highland (refresh)</td>
                    <td className="px-4 py-3 text-gray-700">10-20k mi</td>
                    <td className="px-4 py-3 text-gray-700">$30,000-36,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 leading-relaxed">
              The sweet spot for value is the <strong>2021 Long Range AWD</strong> at 30-50k miles.
              You get dual motor, 350+ mile EPA range (realistically 280-310), and the pre-refresh
              interior which is still excellent. The 2020 Standard Range Plus is tempting but the
              LFP battery in later SR+ models charges slower in cold weather.
            </p>
          </div>

          {/* By Mileage Tier */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              What to Expect by Mileage
            </h2>

            {/* 30k */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Under 30,000 Miles</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Essentially a new car with a used car price. Battery degradation is typically 2-5%
                (barely noticeable). The 12V battery is still original and fine. Interior wear is
                minimal. These cars were probably leased by someone who drove 10k miles/year.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Watch for:</strong> Cars sitting on lots for months (check listing date).
                A low-mileage car that&rsquo;s been sitting can have 12V issues from lack of use.
                Also verify it wasn&rsquo;t a rental &mdash; rental Model 3s see hard driving.
              </p>
            </div>

            {/* 60k */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">30,000 - 60,000 Miles</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                The bulk of the used market. Battery degradation is typically 5-10%. Most owners
                report 90-95% state of health at this range. The car drives identically to new.
                The 12V battery may need replacement soon (budget $100-200). Brake pads are
                probably still at 80%+ life thanks to regenerative braking.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Watch for:</strong> Uneven tire wear (common if alignment was neglected
                &mdash; Model 3s are heavy and eat through rear tires). Check the suspension for
                squeaks over bumps &mdash; lower control arm bushings are a known issue on
                2018-2020 models.
              </p>
            </div>

            {/* 100k */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">60,000 - 100,000 Miles</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Deep value territory. These are $15,000-20,000 cars that still have 85-92% battery
                health. The drivetrain is essentially bulletproof &mdash; electric motors
                don&rsquo;t wear out at 100k miles. But everything else is aging: the 12V battery
                is on its second or third replacement, door handles may be sluggish, and the
                touchscreen may show occasional lag.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Watch for:</strong> Battery warranty coverage. The federal mandate covers
                8 years / 100,000 miles. If the car is approaching either limit, you&rsquo;re
                about to lose your safety net on the most expensive component. Factor that into
                your offer.
              </p>
            </div>
          </div>

          {/* Common Problems */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Common Problems (Honest List)
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              No car is perfect. Here&rsquo;s what actually goes wrong on Model 3s, ranked by
              frequency:
            </p>
            <ul className="space-y-4 mb-4">
              <li className="text-gray-700 leading-relaxed">
                <strong>Panel gaps and trim issues</strong> &mdash; Cosmetic, not functional.
                Early builds (2018-2019) are worse. Check door alignment, trunk seal, and window
                trim. Not a dealbreaker but useful for negotiation.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>12V battery failure</strong> &mdash; The most common &ldquo;repair&rdquo;
                on any Model 3. The car will warn you with a notification days before it dies.
                Cheap fix ($100-200) but annoying if it strands you. Ask when it was last replaced.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Suspension noise</strong> &mdash; Lower control arm bushings wear on
                2018-2021 models, causing clunking over bumps. Tesla revised the part. Replacement
                cost: $300-600 at an independent shop.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>MCU (infotainment) lag or failure</strong> &mdash; Early cars with Intel
                Atom MCU (MCU1) are slow. Most have been upgraded under warranty or recall.
                Verify the car has MCU2 (Ryzen on 2022+). If it still has MCU1, budget $1,500
                for the upgrade or use it as a negotiation point.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Heat pump issues (2021-2022)</strong> &mdash; Some 2021 heat pump
                equipped models had issues in extreme cold (below 0&deg;F). Tesla addressed this
                with software updates. Verify the car is on current firmware.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Phantom braking on Autopilot</strong> &mdash; Software issue, not
                hardware. Improved significantly with recent updates but still occurs occasionally.
                Not a reason to avoid the car, but set expectations.
              </li>
            </ul>
          </div>

          {/* Battery Degradation Reality */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Battery Degradation: The Real Numbers
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Tesla battery degradation is better than most people fear and worse than Tesla fans
              claim. Based on aggregated data from Recurrent and owner-reported surveys:
            </p>
            <ul className="space-y-2 mb-4">
              <li className="text-gray-700 leading-relaxed">
                <strong>Year 1:</strong> 3-5% loss (fastest period &mdash; this is normal)
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Years 2-4:</strong> 1-2% per year
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Years 5+:</strong> Under 1% per year (degradation curve flattens)
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              A typical 2021 Model 3 Long Range with 40k miles will show 92-95% state of health.
              That means 322-348 miles of EPA range (realistically 260-285 in mixed driving).
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>What accelerates degradation:</strong> Frequent DC fast charging (150 kW+),
              keeping the battery at 100% for extended periods, extreme heat exposure (Arizona,
              Texas summers), and high-speed driving. If the car spent its life in Phoenix being
              Supercharged daily, expect worse numbers.
            </p>
          </div>

          {/* Insurance */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Insurance: The Hidden Cost
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              This catches a lot of used Model 3 buyers off guard. Insurance is 15-30% more
              expensive than a comparable gas sedan. A 2021 Model 3 LR typically costs $180-250/month
              to insure for a driver with clean history, depending on location.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Why:</strong> Expensive to repair (aluminum body, specialized labor),
              heavy (4,000+ lbs, causes more damage in collisions), and the integrated battery
              pack means even minor underbody impacts can total the car. Get insurance quotes
              <em> before</em> you buy, not after.
            </p>
          </div>

          {/* Model Years to Target */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Which Model Years to Target
            </h2>
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-800 mb-2">Best Value: 2021 Long Range AWD</h3>
                <p className="text-gray-700 text-sm">
                  Dual motor, 350+ EPA miles, heat pump, updated interior, solid build quality.
                  The sweet spot of price, features, and remaining warranty. Most are off-lease
                  and well-maintained.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-800 mb-2">Budget Pick: 2020 Standard Range Plus (LFP)</h3>
                <p className="text-gray-700 text-sm">
                  The later 2020 SR+ models got LFP batteries which can charge to 100% daily
                  without degradation concerns. Shorter range (263 mi EPA) but extremely durable
                  battery chemistry. Great if you have home charging and don&rsquo;t need long range.
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="font-bold text-yellow-800 mb-2">Proceed with Caution: 2018-2019</h3>
                <p className="text-gray-700 text-sm">
                  Early production had more quality issues (panel gaps, trim problems, MCU1
                  infotainment). Prices are attractive ($14,000-18,000) but warranty is expiring
                  or expired. Only buy if you&rsquo;re comfortable with potential out-of-warranty
                  repairs.
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-bold text-red-800 mb-2">Avoid: Salvage / Rebuilt Title Model 3s</h3>
                <p className="text-gray-700 text-sm">
                  Tempting prices ($12,000-15,000 for a 2021) but the risk is enormous.
                  Battery pack damage from collisions may not be visible. Tesla won&rsquo;t
                  service salvage vehicles at their service centers. Insurance is difficult and
                  expensive. Don&rsquo;t do it.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Line */}
          <div className="mb-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The Bottom Line
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Yes, a used Tesla Model 3 is worth it in 2026 &mdash; if you buy the right one.
              The drivetrain is nearly maintenance-free, the battery degrades slower than feared,
              and the Supercharger network gives you road trip capability that no other used EV
              matches at this price point.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The risks are real but manageable: get insurance quotes first, verify battery health,
              check for open recalls, and budget for the 12V battery replacement. A well-chosen
              used Model 3 will cost you less per mile than almost any gas car on the road.
            </p>
          </div>

          {/* CTA */}
          <div className="mb-12 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Found a listing?
            </h3>
            <p className="text-gray-600 mb-4">
              Paste the URL and get an instant deal check &mdash; risk flags, fair price analysis,
              and the exact questions to ask the seller.
            </p>
            <Link
              href="/receipt"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors"
            >
              Check a listing &rarr;
            </Link>
          </div>

          {/* Related */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Related</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/blog/used-ev-buying-checklist" className="text-blue-600 hover:text-blue-700">
                  Used EV Buying Checklist: 10 Things to Check Before You Buy &rarr;
                </Link>
              </li>
              <li>
                <Link href="/blog/ev-regret-routine" className="text-blue-600 hover:text-blue-700">
                  EV Regret Isn&rsquo;t About Range. It&rsquo;s About Routine. &rarr;
                </Link>
              </li>
              <li>
                <Link href="/checklists/underpriced-ev-listing" className="text-blue-600 hover:text-blue-700">
                  Underpriced EV Listing Checklist &rarr;
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </article>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4">
        <BlogVehicleCTA make="Tesla" model="Model 3" />
      </div>

      <footer className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-500 text-sm border-t border-gray-200">
        <p>OFFO Labs &middot; Building decision intelligence that reduces regret</p>
      </footer>
    </div>
  );
}
