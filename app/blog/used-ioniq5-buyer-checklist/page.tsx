"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function UsedIoniq5BuyerChecklist() {
  useVisitorTracking();
  const { trackEvent } = useEventTracking();

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
          <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 mb-4">
            Buyer&rsquo;s Checklist
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Used Hyundai Ioniq 5 Buyer Checklist (2026): 11 Things to Check Before You Buy
          </h1>
          <p className="text-xl text-gray-600 mb-5 leading-relaxed">
            The Ioniq 5 is one of the best used EV values in 2026 — but only if you know which model years to target, which recalls to check, and what the 800V fast-charging architecture actually means for long-term ownership.
          </p>
          <div className="flex items-center gap-4 text-gray-500 text-sm">
            <span>10 min read</span>
            <span>&middot;</span>
            <span>OFFO Labs</span>
            <span>&middot;</span>
            <span>May 2026</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none">

          {/* Quick jump */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-10">
            <p className="text-sm font-semibold text-gray-700 mb-3">In this checklist:</p>
            <ol className="space-y-1 text-sm text-blue-600 list-decimal list-inside">
              <li><a href="#recalls" className="hover:underline">Open recalls — start here</a></li>
              <li><a href="#battery" className="hover:underline">Battery degradation & state of health</a></li>
              <li><a href="#charging" className="hover:underline">800V charging — verify it actually works</a></li>
              <li><a href="#title" className="hover:underline">Title & accident history</a></li>
              <li><a href="#heat-pump" className="hover:underline">Heat pump status</a></li>
              <li><a href="#software" className="hover:underline">Software version & OTA update history</a></li>
              <li><a href="#v2l" className="hover:underline">V2L (Vehicle-to-Load) functionality</a></li>
              <li><a href="#range" className="hover:underline">Real-world range check</a></li>
              <li><a href="#price" className="hover:underline">Market price vs. comparables</a></li>
              <li><a href="#model-years" className="hover:underline">Model years to target vs. avoid</a></li>
              <li><a href="#negotiation" className="hover:underline">Negotiation leverage points</a></li>
            </ol>
          </div>

          {/* Why Ioniq 5 */}
          <div className="mb-10">
            <p className="text-gray-700 leading-relaxed mb-4">
              The Ioniq 5 launched in 2022 as arguably the most technically advanced EV under $60,000 — 800V architecture, 18-minute fast charging, vehicle-to-load power export, and a retro-futurist design that aged well. Two years later, off-lease units are flooding the used market at $25,000–35,000.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The problem: most buyers don&rsquo;t know what to check on an Ioniq 5 specifically. A recall that drains the 12V battery overnight, a software version that limits charging speed, or a battery that degraded faster than expected — these don&rsquo;t show up in test drives. This checklist does.
            </p>
          </div>

          {/* 1. Recalls */}
          <div id="recalls" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              1. Open Recalls — Start Here
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Ioniq 5 has had several significant recalls, some of which affect safety and charging behavior. Check the VIN on nhtsa.gov before doing anything else.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Key recalls on 2022–2023 Ioniq 5:</p>
              <ul className="text-sm text-gray-700 space-y-2 mt-2">
                <li>
                  <strong>NHTSA 23V-132 — Battery management software:</strong> Can cause unexpected loss of drive power. Requires dealer software update. Affects 2022–2023 models.
                </li>
                <li>
                  <strong>NHTSA 22V-924 — 12V battery drain:</strong> Telematics module can drain the 12V battery overnight, leaving the car unable to start. Critical — check if this has been remedied.
                </li>
                <li>
                  <strong>NHTSA 23V-561 — Charging system:</strong> DC fast charging port can overheat under certain conditions. Affects 2022 RWD models primarily.
                </li>
                <li>
                  <strong>NHTSA 24V-016 — Electronic parking brake:</strong> Can engage unexpectedly during driving in rare conditions. 2022 models.
                </li>
              </ul>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Each open recall is a dealership visit the new owner has to make. That&rsquo;s leverage. And the 12V battery drain recall specifically — if unresolved, you could wake up to a car that won&rsquo;t start.
            </p>
          </div>

          {/* 2. Battery */}
          <div id="battery" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              2. Battery Degradation &amp; State of Health
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Good news: Ioniq 5 batteries have degraded slower than expected in real-world data. The SK On cells used in the Long Range models have shown strong durability. That said, there&rsquo;s variance — particularly in cars that lived in hot climates and charged frequently at DC fast chargers.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">Expected degradation — Ioniq 5 Long Range AWD (77.4 kWh):</p>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs text-gray-700">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="text-left py-2 pr-4 font-semibold">Mileage</th>
                      <th className="text-left py-2 pr-4 font-semibold">Typical SOH</th>
                      <th className="text-left py-2 font-semibold">Flag if below</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-blue-100">
                      <td className="py-1.5 pr-4">Under 25k mi</td>
                      <td className="py-1.5 pr-4">96–99%</td>
                      <td className="py-1.5">93%</td>
                    </tr>
                    <tr className="border-b border-blue-100">
                      <td className="py-1.5 pr-4">25k–50k mi</td>
                      <td className="py-1.5 pr-4">92–96%</td>
                      <td className="py-1.5">89%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">50k–80k mi</td>
                      <td className="py-1.5 pr-4">88–93%</td>
                      <td className="py-1.5">85%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>How to check:</strong> Charge to 100% and note the GOM (Guess-O-Meter) range estimate. The 2022 LR AWD was rated 266 miles EPA. At 100%, a healthy battery shows 250–265 miles. Under 240 miles at 100% on a car under 50k miles warrants negotiation or further inspection.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The Hyundai battery warranty is strong: <strong>10 years / 100,000 miles</strong> covering capacity below 70% SOH. This is better than the federal minimum and is a genuine safety net on high-mileage units.
            </p>
          </div>

          {/* 3. Charging */}
          <div id="charging" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              3. 800V Charging — Verify It Actually Works
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Ioniq 5&rsquo;s 800V architecture and 235 kW peak charging speed is its headline feature. At a compatible ultra-fast charger (Electrify America, certain EVgo stations), you go from 10% to 80% in about 18 minutes. This is significantly faster than any Tesla at this price point.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>But there are a few things to verify:</strong>
            </p>
            <ul className="space-y-3 mb-4">
              <li className="text-gray-700 leading-relaxed">
                <strong>The car needs the right trim:</strong> RWD Standard Range (58 kWh) charges at a maximum of 800V/185 kW. Long Range RWD and AWD (77.4 kWh) charge at 800V/235 kW. Check which version you&rsquo;re buying.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Charging speed may be software-limited:</strong> Some 2022 cars had software issues limiting peak DCFC speed. Ask if the car has had any charging-related software updates.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>CCS port condition:</strong> Check the charge port door opens and closes smoothly. Examine the CCS pins for corrosion or damage — replacing a charge port is $800–1,500.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>NACS adapter availability:</strong> If you plan to use Tesla Superchargers, confirm the car has or can get the NACS adapter. Hyundai began including these for 2024 and later, but 2022–2023 owners need to purchase the adapter separately.
              </li>
            </ul>
          </div>

          {/* 4. Title */}
          <div id="title" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              4. Title &amp; Accident History
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Ioniq 5&rsquo;s flat skateboard battery pack is integrated into the floor of the vehicle. Any accident with underbody impact — even at low speed — can damage the pack in ways that aren&rsquo;t visible externally.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="font-semibold text-green-800 text-sm mb-2">Safe to proceed</p>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>✓ Clean title, single owner</li>
                  <li>✓ 0–1 minor accidents (cosmetic only)</li>
                  <li>✓ Hyundai-certified dealer car</li>
                  <li>✓ Off-lease, documented service history</li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-semibold text-red-800 text-sm mb-2">Walk away</p>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>✗ Salvage or rebuilt title</li>
                  <li>✗ Any reported underbody/floor damage</li>
                  <li>✗ Flood damage (check carpets, HVAC smell)</li>
                  <li>✗ Structural repair on CarFax</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 5. Heat pump */}
          <div id="heat-pump" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              5. Heat Pump Status
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              All Ioniq 5 trims include a heat pump standard. This is a major advantage over most competing EVs and significantly improves cold-weather range. But heat pump failures have been reported on early 2022 builds.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Symptoms of a failing heat pump: cabin takes much longer to warm in cold weather, excessive range loss below 30°F, HVAC errors on the climate screen.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Repair cost out of warranty: $1,800–2,800.</strong> If you&rsquo;re buying a 2022 out of the powertrain warranty window, budget accordingly or use it as negotiation leverage.
            </p>
          </div>

          {/* 6. Software */}
          <div id="software" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              6. Software Version &amp; OTA Updates
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Ioniq 5 receives over-the-air software updates, but Hyundai&rsquo;s OTA rollout has been slower and less consistent than Tesla&rsquo;s. Many 2022–2023 cars sitting on private seller lots haven&rsquo;t been connected to WiFi in months and may be running outdated firmware.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Why it matters:</strong> Several important fixes — including the 12V battery drain recall fix, charging speed improvements, and range estimation accuracy — came through software updates. A car on old firmware may have bugs that the current software resolves.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>How to check:</strong> In the car, go to Settings → General → Software. Current firmware as of 2026 is in the 240xxx range. Anything below 220xxx should be updated immediately — connect to WiFi at home or take it to a Hyundai dealer for the update.
            </p>
          </div>

          {/* 7. V2L */}
          <div id="v2l" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              7. V2L (Vehicle-to-Load) — Test It
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              V2L lets you power 120V household devices directly from the car — laptops, camping gear, power tools, or even a small appliance. Output is up to 3.6 kW, which is meaningful.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Ioniq 5 has two V2L ports: one inside the car (rear console) and one via an adapter on the charge port. Both should work. Test them during the test drive.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Ask if the V2L adapter is included.</strong> It&rsquo;s a $100–150 accessory and often gets left behind when owners sell. If it&rsquo;s missing, ask for a price reduction.
            </p>
          </div>

          {/* 8. Range */}
          <div id="range" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              8. Real-World Range Check
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              EPA range for the 2022 Ioniq 5 Long Range AWD is 266 miles. Real-world at highway speeds is typically 210–240 miles depending on speed and temperature. At 75 mph in moderate weather, expect 3.5–4.0 mi/kWh (about 210–230 miles from full charge).
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Quick test:</strong> During the test drive, check the energy consumption display. At 65–70 mph in moderate weather (50–70°F), healthy consumption is 3.0–3.5 mi/kWh. Below 2.5 mi/kWh in good conditions suggests battery or thermal management issues worth investigating.
            </p>
          </div>

          {/* 9. Price */}
          <div id="price" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              9. Market Price vs. Comparables
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Ioniq 5 prices have held up better than most EVs because demand stayed strong and supply was limited in 2022–2023. Expect to pay a small premium over similarly-aged Tesla alternatives. Here are 2026 market benchmarks:
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">Year / Trim</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">Typical Mileage</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">Market Range</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">Good Deal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2022 RWD Standard Range</td>
                    <td className="px-4 py-3 text-gray-700">30–55k mi</td>
                    <td className="px-4 py-3 text-gray-700">$23,000–27,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $24k</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2022 LR AWD</td>
                    <td className="px-4 py-3 text-gray-700">25–50k mi</td>
                    <td className="px-4 py-3 text-gray-700">$29,000–35,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $31k</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2023 LR AWD</td>
                    <td className="px-4 py-3 text-gray-700">15–35k mi</td>
                    <td className="px-4 py-3 text-gray-700">$32,000–38,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $34k</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2024 (refreshed)</td>
                    <td className="px-4 py-3 text-gray-700">5–20k mi</td>
                    <td className="px-4 py-3 text-gray-700">$36,000–43,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $38k</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 leading-relaxed">
              One nuance: the Ioniq 5 qualifies for the federal used EV tax credit ($4,000 max) if the sale price is under $25,000 and the buyer meets income requirements. A 2022 RWD under $25k from a dealer could net you a significant tax credit. Always confirm eligibility with your tax advisor.
            </p>
          </div>

          {/* 10. Model years */}
          <div id="model-years" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              10. Model Years to Target vs. Avoid
            </h2>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-800 mb-2">Best Buy: 2023 Long Range AWD</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Hyundai addressed most of the 2022 software and charging issues by mid-2023 production. Better heat pump reliability, faster OTA update delivery, improved range estimation. The 2023 LR AWD at 30–40k miles hitting the used market in 2026 is the sweet spot.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-800 mb-2">Strong Value: 2022 Long Range AWD (late production)</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Late 2022 builds (built after September 2022) had most of the early recall issues resolved at the factory. Under $32k with clean history and under 45k miles is excellent value. Verify all recalls are addressed before purchase.
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="font-bold text-yellow-800 mb-2">Proceed Carefully: 2022 Early Production (before Sept 2022)</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Higher likelihood of open recalls, including the critical 12V battery drain issue. Not a dealbreaker if all recalls have been addressed by a Hyundai dealer — confirm in the service history. Negotiate $1,000–1,500 off market price to account for your time.
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-bold text-red-800 mb-2">Avoid: Any Ioniq 5 with Flood or Underbody Damage</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  The flat floor battery pack makes flood and underbody damage uniquely dangerous on this car. Battery replacement is $15,000–25,000 out of warranty. If CarFax shows flood damage, walk away regardless of how good the price looks.
                </p>
              </div>
            </div>
          </div>

          {/* 11. Negotiation */}
          <div id="negotiation" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              11. Negotiation Leverage Points
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Most Ioniq 5 sellers — especially private sellers — don&rsquo;t know about the EV-specific issues. Use what you know:
            </p>
            <ul className="space-y-4">
              <li className="text-gray-700 leading-relaxed">
                <strong>Open recalls requiring dealer visits</strong> — the 12V battery drain recall is particularly strong leverage if unresolved. That&rsquo;s a car that can fail to start overnight. Ask for $400–600 per critical unresolved recall.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Missing V2L adapter</strong> — a $100–150 item, but also a signal the seller didn&rsquo;t take care of accessories. Ask them to include it or reduce price.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Battery below expected degradation curve</strong> — if the car shows under 89% SOH at under 50k miles, that&rsquo;s below average for the Ioniq 5. Use it: &ldquo;Battery health is lower than expected for the mileage — I&rsquo;d need $1,500 off to account for the reduced range.&rdquo;
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>No NACS adapter</strong> — if you plan to use Superchargers, the adapter is $200+. If it&rsquo;s not included, deduct it from your offer.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Listing age over 30 days</strong> — the Ioniq 5 moves quickly when priced right. A car sitting 30+ days is overpriced or has a problem. Make a low offer — the worst that happens is they say no.
              </li>
            </ul>
          </div>

          {/* Bottom line */}
          <div className="mb-10 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">The Bottom Line</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              A clean 2023 Ioniq 5 Long Range AWD under 40k miles is one of the best used EV buys in 2026. The 800V charging architecture, 10-year battery warranty, heat pump standard, and V2L capability are genuinely ahead of most competitors at this price point.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The early 2022 recall situation is real but manageable — confirm all recalls are addressed and the 12V battery drain fix has been applied. Do that, run the VIN, check the battery health estimate, and you&rsquo;re buying one of the most capable used EVs on the market.
            </p>
          </div>

          {/* CTA */}
          <div className="mb-12 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Found an Ioniq 5 listing?
            </h3>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Paste the VIN for an instant check — open recalls pulled automatically, battery health estimate, market price vs. comparables, and 3 copy-paste negotiation scripts for that exact listing.
            </p>
            <Link
              href="/"
              onClick={() => trackEvent("blog_cta_clicked", { slug: "used-ioniq5-buyer-checklist", cta: "hero" })}
              className="inline-block bg-[#00d97e] hover:bg-[#00c970] text-black font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Check an Ioniq 5 listing &rarr;
            </Link>
            <p className="text-xs text-gray-400 mt-3">Free instant check · No account needed</p>
          </div>

          {/* Related */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Related reading</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/blog/used-model-y-buyer-checklist" className="text-blue-600 hover:text-blue-700">
                  Used Tesla Model Y Buyer Checklist (2026) &rarr;
                </Link>
              </li>
              <li>
                <Link href="/blog/used-tesla-model-3-worth-it" className="text-blue-600 hover:text-blue-700">
                  Is a Used Tesla Model 3 Worth It in 2026? &rarr;
                </Link>
              </li>
              <li>
                <Link href="/blog/used-ev-buying-checklist" className="text-blue-600 hover:text-blue-700">
                  Used EV Buying Checklist: 10 Things to Check Before You Buy &rarr;
                </Link>
              </li>
              <li>
                <Link href="/blog/best-carfax-alternatives-2026" className="text-blue-600 hover:text-blue-700">
                  Best Carfax Alternatives for Used EV Buyers (2026) &rarr;
                </Link>
              </li>
            </ul>
          </div>

        </div>
      </article>

      <footer className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-500 text-sm border-t border-gray-200">
        <p>OFFO Labs &middot; Building decision intelligence that reduces regret</p>
      </footer>
    </div>
  );
}
