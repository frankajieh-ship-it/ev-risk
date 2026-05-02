"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function UsedModelYBuyerChecklist() {
  useVisitorTracking();
  const { trackEvent } = useEventTracking();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-br from-gray-50 to-green-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href="/blog"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block"
          >
            &larr; Back to Blog
          </Link>
          <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800 mb-4">
            Buyer&rsquo;s Checklist
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Used Tesla Model Y Buyer Checklist (2026): 12 Things to Check Before You Buy
          </h1>
          <p className="text-xl text-gray-600 mb-5 leading-relaxed">
            The Model Y is the best-selling used EV in America. It&rsquo;s also the most mis-priced — listings range from genuine deals to overpriced lemons sitting on lots for months. This checklist covers every signal that separates the two.
          </p>
          <div className="flex items-center gap-4 text-gray-500 text-sm">
            <span>11 min read</span>
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
              <li><a href="#recalls" className="hover:underline">Open recalls — the non-negotiable first step</a></li>
              <li><a href="#title" className="hover:underline">Title & accident history</a></li>
              <li><a href="#battery" className="hover:underline">Battery health estimate</a></li>
              <li><a href="#range-test" className="hover:underline">Real-world range test</a></li>
              <li><a href="#heat-pump" className="hover:underline">Heat pump & HVAC issues</a></li>
              <li><a href="#fsd" className="hover:underline">FSD transfer status</a></li>
              <li><a href="#mcu" className="hover:underline">MCU generation</a></li>
              <li><a href="#12v" className="hover:underline">12V battery age</a></li>
              <li><a href="#panel-gaps" className="hover:underline">Panel gaps & body fit</a></li>
              <li><a href="#price" className="hover:underline">Market price vs. comparables</a></li>
              <li><a href="#model-years" className="hover:underline">Model years to target vs. avoid</a></li>
              <li><a href="#negotiation" className="hover:underline">Negotiation leverage points</a></li>
            </ol>
          </div>

          {/* Why this matters */}
          <div className="mb-10">
            <p className="text-gray-700 leading-relaxed mb-4">
              A used Model Y with 3 open recalls, a questionable battery, and an asking price $4,000 above market looks identical on Autotrader to one with clean history and a healthy pack. The listing photos don&rsquo;t tell you which is which. This checklist does.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We&rsquo;ve analyzed hundreds of Model Y listings through OFFO&rsquo;s deal checker. These are the 12 signals that actually predict whether you&rsquo;re getting a deal or inheriting someone else&rsquo;s problem.
            </p>
          </div>

          {/* 1. Recalls */}
          <div id="recalls" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              1. Open Recalls — Do This First
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Tesla issues software recalls more frequently than any other automaker — many are over-the-air fixes, but some require a service center visit. As of 2026, the Model Y has had over 20 active recalls across various model years.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Why it matters beyond the obvious:</strong> An unaddressed recall isn&rsquo;t just a safety issue — it&rsquo;s negotiation leverage. A car with 3 unresolved recalls that each require service center visits is worth meaningfully less than one with a clean recall history.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Common active recalls on 2020-2023 Model Y:</p>
              <ul className="text-sm text-gray-700 space-y-1 mt-2">
                <li>• Rearview camera delay on startup (NHTSA 22V-886)</li>
                <li>• Autopilot &ldquo;full self-driving&rdquo; beta phantom braking</li>
                <li>• Windshield wiper motor failure in cold conditions</li>
                <li>• Seat belt pretensioner on rear seats (2022-2023)</li>
              </ul>
            </div>
            <p className="text-gray-700 leading-relaxed">
              <strong>How to check:</strong> Go to <strong>nhtsa.gov/recalls</strong> and enter the VIN. Or paste the VIN into OFFO — we pull open recall data as part of the instant deal check.
            </p>
          </div>

          {/* 2. Title */}
          <div id="title" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              2. Title &amp; Accident History
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Title status is binary: clean, salvage, rebuilt, or lemon law buyback. But accident history is a spectrum. A fender-bender properly repaired at a Tesla-certified shop is different from a structural repair at an unknown body shop.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="font-semibold text-green-800 text-sm mb-2">Lower risk signals</p>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>✓ Clean title, 0-1 minor accidents</li>
                  <li>✓ Tesla Certified Pre-Owned</li>
                  <li>✓ Repair at Tesla-authorized shop</li>
                  <li>✓ Single owner, lease return</li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-semibold text-red-800 text-sm mb-2">Walk away signals</p>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>✗ Salvage or rebuilt title</li>
                  <li>✗ Lemon law buyback (check CarFax)</li>
                  <li>✗ Structural damage reported</li>
                  <li>✗ Multiple owners in under 3 years</li>
                </ul>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed">
              <strong>The Model Y-specific concern:</strong> Unlike traditional cars, even minor underbody damage can affect the battery pack. If Carfax shows an accident with airbag deployment or a reported total loss that was later rebuilt — walk away regardless of price.
            </p>
          </div>

          {/* 3. Battery */}
          <div id="battery" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              3. Battery Health Estimate
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can&rsquo;t read the exact state of health from a test drive. But you can get a strong estimate from two methods:
            </p>
            <ol className="space-y-4 mb-4">
              <li className="text-gray-700 leading-relaxed">
                <strong>1. Charge-to-full and check rated range.</strong> Ask the seller to charge to 100% before your visit (or charge it yourself). The displayed rated range divided by the EPA-rated range gives you an approximate state of health. A 2021 Model Y LR rated at 326 miles showing 301 miles at 100% = 92% SOH.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>2. Run the VIN through a degradation tool.</strong> OFFO&rsquo;s deal checker includes a battery health estimate based on model year, mileage, and charging history patterns. It won&rsquo;t replace a full diagnostic but it surfaces red flags before you visit.
              </li>
            </ol>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">What&rsquo;s normal degradation for Model Y?</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-gray-700">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="text-left py-2 pr-4 font-semibold">Mileage</th>
                      <th className="text-left py-2 pr-4 font-semibold">Typical SOH</th>
                      <th className="text-left py-2 font-semibold">Flag if below</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    <tr className="border-b border-blue-100">
                      <td className="py-1.5 pr-4">Under 30k mi</td>
                      <td className="py-1.5 pr-4">95–98%</td>
                      <td className="py-1.5">92%</td>
                    </tr>
                    <tr className="border-b border-blue-100">
                      <td className="py-1.5 pr-4">30k–60k mi</td>
                      <td className="py-1.5 pr-4">90–95%</td>
                      <td className="py-1.5">87%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">60k–100k mi</td>
                      <td className="py-1.5 pr-4">85–92%</td>
                      <td className="py-1.5">82%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. Range test */}
          <div id="range-test" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              4. Real-World Range Test
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Don&rsquo;t rely on the displayed rated range at 100%. It&rsquo;s calculated by Tesla&rsquo;s algorithm, not measured in real conditions. What matters is efficiency at highway speed.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Quick test during the test drive:</strong> Get on a highway, set cruise to 70 mph, note the energy consumption display (Wh/mi). A healthy 2021 Model Y LR should show 240–270 Wh/mi at 70 mph in moderate weather. Above 300 Wh/mi at the same speed in mild weather warrants more investigation. Check the Energy app in the car for a rolling 30-mile average.
            </p>
          </div>

          {/* 5. Heat pump */}
          <div id="heat-pump" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              5. Heat Pump &amp; HVAC — The Model Y&rsquo;s Known Weak Point
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              All Model Y units (2021+) come with a heat pump, which dramatically improves cold-weather efficiency. But 2021 and early 2022 units had a documented issue: &ldquo;kraken&rdquo; or &ldquo;octovalve&rdquo; failures that caused loss of heat in extreme cold (below 15°F).
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Tesla issued a software fix for most cases, but hardware failures still happen. Replacement cost: <strong>$1,500–2,500</strong> out of warranty.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">How to check:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Ask if the car has ever had heating issues in cold weather</li>
                <li>• Check service history for octovalve or heat pump repairs</li>
                <li>• Run climate full blast on heat during the test drive — note how quickly cabin warms</li>
                <li>• If buying in summer: worth asking for a discount to cover potential heat pump repair</li>
              </ul>
            </div>
          </div>

          {/* 6. FSD */}
          <div id="fsd" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              6. FSD Transfer Status
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Full Self-Driving (FSD) is worth $8,000 new. On used cars, the transfer policy has changed multiple times. As of 2026:
            </p>
            <ul className="space-y-3 mb-4">
              <li className="text-gray-700 leading-relaxed">
                <strong>FSD purchased (not subscribed):</strong> Transfers with the vehicle. Huge value add — confirm in the car&rsquo;s software under Controls → Software.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>FSD subscription:</strong> Does NOT transfer. Seller pays monthly, new buyer starts fresh. Don&rsquo;t pay a premium for subscription FSD.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Enhanced Autopilot:</strong> Transfers. Less capable than FSD but includes Navigate on Autopilot, Auto Lane Change, Autopark. Still worth $2,000–3,000.
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Always verify the software package in the car itself before purchase, not just from the listing description.
            </p>
          </div>

          {/* 7. MCU */}
          <div id="mcu" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              7. MCU Generation (Infotainment)
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Model Y launched with MCU2 (AMD Ryzen), so this is less of an issue than with the Model 3. But it&rsquo;s worth confirming — especially on any 2020 Model Y, which came out mid-production-year transition.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>How to confirm:</strong> In the car, go to Controls → Software → Additional Vehicle Information. Look for &ldquo;Infotainment Processor: AMD Ryzen.&rdquo; If it says Intel Atom, that&rsquo;s MCU1 — rare on Model Y but budget $1,500 for the upgrade or use as a negotiation point.
            </p>
          </div>

          {/* 8. 12V */}
          <div id="12v" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              8. 12V Battery Age
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The 12V battery powers all the electronics when the main pack is off. It&rsquo;s the most common repair on any Tesla — typically needs replacement every 3–4 years. Cost: $100–200 DIY, $250–350 at a shop.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              The car will warn you (usually &ldquo;Schedule Service: 12V Battery Low&rdquo;) with a few days notice. But a failing 12V that strands you is still annoying even with the warning.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Ask:</strong> &ldquo;When was the 12V battery last replaced?&rdquo; If the car is a 2020 or 2021 with the original 12V, budget for a replacement soon. 2022+ models got a lithium 12V battery that lasts significantly longer.
            </p>
          </div>

          {/* 9. Panel gaps */}
          <div id="panel-gaps" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              9. Panel Gaps &amp; Body Fit
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Model Y has had well-documented panel gap issues, especially on 2020–2021 builds from the Fremont factory. Gaps between the rear hatch and body panels, uneven door alignment, and trunk seal gaps are common.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              This matters for two reasons:
            </p>
            <ul className="space-y-2 mb-4">
              <li className="text-gray-700 leading-relaxed"><strong>Wind noise at highway speed</strong> — a significant quality-of-life issue on long drives</li>
              <li className="text-gray-700 leading-relaxed"><strong>Water intrusion</strong> — poor trunk seals on early builds caused water damage inside the cargo area</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              <strong>Texas Gigafactory (2022+) builds are significantly better.</strong> Check the VIN — VINs starting with &ldquo;7SA&rdquo; are from Austin. Fremont cars start with &ldquo;5YJ&rdquo;. Austin-built Model Ys have noticeably tighter panel fit.
            </p>
          </div>

          {/* 10. Price */}
          <div id="price" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              10. Market Price vs. Comparables
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Model Y prices have stabilized in 2026 after 18 months of decline. Here are current typical transaction prices (not listing prices — actual sale prices run 5–8% lower):
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
                    <td className="px-4 py-3 text-gray-700">2020 Long Range AWD</td>
                    <td className="px-4 py-3 text-gray-700">50–70k mi</td>
                    <td className="px-4 py-3 text-gray-700">$24,000–28,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $25k</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2021 Long Range AWD</td>
                    <td className="px-4 py-3 text-gray-700">30–55k mi</td>
                    <td className="px-4 py-3 text-gray-700">$27,000–33,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $29k</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2022 Long Range AWD</td>
                    <td className="px-4 py-3 text-gray-700">20–40k mi</td>
                    <td className="px-4 py-3 text-gray-700">$30,000–36,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $32k</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2023 RWD Standard Range</td>
                    <td className="px-4 py-3 text-gray-700">15–30k mi</td>
                    <td className="px-4 py-3 text-gray-700">$26,000–30,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $27k</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">2024 Juniper (refresh)</td>
                    <td className="px-4 py-3 text-gray-700">5–20k mi</td>
                    <td className="px-4 py-3 text-gray-700">$36,000–42,000</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Under $38k</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 leading-relaxed">
              A car priced more than 8% above these ranges needs a good reason (transferable FSD, flawless condition, very low mileage for the year). A car priced more than 10% below them warrants extra scrutiny — check the recall history and accident report first.
            </p>
          </div>

          {/* 11. Model years */}
          <div id="model-years" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              11. Model Years to Target vs. Avoid
            </h2>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-800 mb-2">Best Buy: 2022 Long Range AWD (Austin-built)</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Tighter panel fit, lithium 12V battery (longer-lasting), heat pump software matured, strong range (318 mi EPA). Look for VINs starting with &ldquo;7SA&rdquo;. These are the sweet spot of quality and price in 2026.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-800 mb-2">Strong Value: 2021 Long Range AWD</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Good range, heat pump, dual motor. Check for heat pump service history. Fremont build so inspect panel gaps. Prices have come down — a clean 2021 LR under $30k is excellent value in 2026.
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="font-bold text-yellow-800 mb-2">Proceed Carefully: 2020 Long Range</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  No heat pump (resistive heating only — loses 40%+ range in cold weather). Lead-acid 12V battery. More panel gap issues. Still a solid car in mild climates, but price should reflect the missing heat pump.
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-bold text-red-800 mb-2">Avoid: Any Model Y with Salvage/Rebuilt Title</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Tesla&rsquo;s integrated battery pack means structural damage risks are invisible and catastrophic. Tesla won&rsquo;t service salvage vehicles. Insurance is expensive and limited. The discount is never worth it on an EV.
                </p>
              </div>
            </div>
          </div>

          {/* 12. Negotiation */}
          <div id="negotiation" className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              12. Negotiation Leverage Points
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Most used Model Y sellers aren&rsquo;t aware of EV-specific issues. These are the best negotiation points:
            </p>
            <ul className="space-y-4">
              <li className="text-gray-700 leading-relaxed">
                <strong>Open recalls requiring service center visits</strong> — each one is a $0 repair but an inconvenience that costs you time. Ask for $300–500 per unresolved recall.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Battery below the expected degradation curve</strong> — below 90% SOH at under 60k miles is below average. That&rsquo;s a $1,000–2,000 deduction.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Original 12V battery on a 2020–2021</strong> — budget $200–350 for replacement. Mention it.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>No heat pump (2020 builds)</strong> — in cold climates this is a real limitation. Worth $1,500–2,000 off vs. a comparable 2021.
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Listing has been active 30+ days</strong> — the car is sitting. That&rsquo;s leverage. Check listing date on the platform; offer 8% below ask and see what happens.
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="mb-12 bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-xl p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Have a specific listing in mind?
            </h3>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Paste the VIN and get an instant check — open recalls pulled automatically, battery health estimate, market price vs. comparables, and 3 negotiation scripts written for that exact listing.
            </p>
            <Link
              href="/"
              onClick={() => trackEvent("blog_cta_clicked", { slug: "used-model-y-buyer-checklist", cta: "hero" })}
              className="inline-block bg-[#00d97e] hover:bg-[#00c970] text-black font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Check a Model Y listing &rarr;
            </Link>
            <p className="text-xs text-gray-400 mt-3">Free instant check · Full report from $3.99 · No account needed</p>
          </div>

          {/* Related */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Related reading</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/blog/used-ioniq5-buyer-checklist" className="text-blue-600 hover:text-blue-700">
                  Used Hyundai Ioniq 5 Buyer Checklist (2026) &rarr;
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
