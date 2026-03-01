"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function UsedEVBuyingChecklistPost() {
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
            Used EV Buying Checklist: 10 Things to Check Before You Buy
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>10 min read</span>
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
              Used EVs are one of the best deals in the car market right now. Rapid depreciation
              means you can get a 2-3 year old electric car for 40-60% of its original sticker
              price. But EVs have different failure modes than gas cars, and the usual &ldquo;check
              the Carfax and kick the tires&rdquo; advice misses the most important stuff.
            </p>
            <p className="text-xl text-gray-700 leading-relaxed">
              Here are the 10 things that actually matter when buying a used EV.
            </p>
          </div>

          {/* Item 1 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              1. Battery State of Health (SoH)
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              This is the single most important number on a used EV. Battery state of health tells
              you what percentage of the original capacity remains. A 2020 Tesla Model 3 with 95%
              SoH still has 257 miles of its original 270. One with 82% SoH only has 221 miles
              &mdash; and it&rsquo;s degrading faster.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>How to check:</strong> Ask the seller for a screenshot of the battery health
              screen. On Teslas, third-party apps like Recurrent or Tessie can show degradation
              curves. For other brands, the dealer can run a diagnostic. If the seller refuses to
              share battery health data, walk away.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Red flag:</strong> SoH below 85% on a car under 5 years old suggests
              either excessive DC fast charging, extreme climate exposure, or a defective pack.
            </p>
          </div>

          {/* Item 2 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              2. Charging Capability
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Not all EVs charge at the same speed, and some older models are painfully slow. Check
              both the onboard AC charger (Level 2) speed and DC fast charge capability.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Key numbers:</strong> Look for at least 7.2 kW AC charging (some older EVs
              only do 3.3 kW, which means overnight charging barely fills up). For DC fast charging,
              anything under 50 kW peak means road trips will be painful.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Watch out for:</strong> Early Nissan Leafs with CHAdeMO (dying standard),
              and any EV without DC fast charge capability at all (some base trims omit it).
            </p>
          </div>

          {/* Item 3 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              3. Software Update Status
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              EVs are computers on wheels. Outdated software can mean missing features, known bugs
              that were fixed in later updates, or even reduced charging speeds.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>What to do:</strong> Check if the car is on the latest firmware version.
              For Tesla, this is visible in Settings &gt; Software. For others, ask the dealer to
              verify. Some manufacturers (like Nissan for older Leafs) stop pushing updates after
              a certain point &mdash; that&rsquo;s worth knowing before you buy.
            </p>
          </div>

          {/* Item 4 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              4. 12V Battery Age
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              This catches people off guard: EVs still have a traditional 12V battery for
              accessories, computers, and door locks. When it dies, the car is completely
              bricked &mdash; you can&rsquo;t even open the doors normally.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Check:</strong> Ask when the 12V was last replaced. Most need replacement
              every 3-5 years. A dead 12V on a Tesla costs $100-200 to replace but can leave you
              stranded. Budget for replacement if the car is 3+ years old and still on the
              original battery.
            </p>
          </div>

          {/* Item 5 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              5. Service History and Maintenance Records
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              EVs need less maintenance than gas cars, but they still need some. Brake fluid
              should be changed every 2-3 years (regenerative braking means the pads last forever
              but the fluid still absorbs moisture). Cabin air filters, coolant, and tire
              rotations still matter.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Why it matters:</strong> A complete service history indicates an owner who
              cared about the car. Missing records on a 4+ year old EV is a yellow flag &mdash;
              not a deal-breaker, but worth reflecting in your offer price.
            </p>
          </div>

          {/* Item 6 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              6. Title Status and Accident History
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Same as any used car, but EVs have a specific risk: flood damage. Water and
              high-voltage battery packs are a dangerous combination. A flooded EV may work fine
              for months before corrosion causes catastrophic failure.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Always check:</strong> Run the VIN through Carfax or AutoCheck. Look for
              salvage titles, rebuilt titles, flood damage, or lemon law buybacks. Also check
              NHTSA recalls for open campaigns on the specific VIN.
            </p>
          </div>

          {/* Item 7 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              7. Open Recalls
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              EV recalls are more common than you&rsquo;d think, and some are serious &mdash;
              battery fire risk, sudden power loss, or charging system faults. The good news:
              recalls are free to fix at any dealer. The bad news: some recall parts take months
              to become available.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>How to check:</strong> Enter the VIN at{" "}
              <span className="font-medium">nhtsa.gov/recalls</span>. Don&rsquo;t rely on the
              seller saying &ldquo;everything is up to date&rdquo; &mdash; verify it yourself.
            </p>
          </div>

          {/* Item 8 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              8. Warranty Transfer
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              EV battery warranties are typically 8 years / 100,000 miles (federal mandate). But
              the details vary by manufacturer. Some warranties cover degradation below a threshold
              (e.g., Tesla covers if capacity drops below 70%). Others only cover total failure.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Key question:</strong> Does the warranty transfer to the second owner?
              Most do, but verify with the manufacturer. Knowing you have 4 years of battery
              warranty remaining changes the risk calculus significantly.
            </p>
          </div>

          {/* Item 9 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              9. Real-World Range Test
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              EPA range is a lab number. Real-world range depends on your speed, climate, terrain,
              and driving style. Highway driving at 75 mph can reduce range by 20-30% versus
              the EPA estimate. Cold weather knocks off another 20-30%.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>What to do:</strong> During the test drive, note the energy consumption
              display (Wh/mi or kWh/100mi). Compare it to what owners report on forums for that
              model. If the car shows 320 Wh/mi but owners typically see 250, something may be
              wrong with the battery or drivetrain.
            </p>
          </div>

          {/* Item 10 */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              10. Total Cost of Ownership
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Used EVs are cheap to buy but the savings math depends on your situation. Factor in:
              electricity cost (check your utility rate &mdash; off-peak vs. on-peak matters),
              insurance (EVs are typically 15-25% more expensive to insure), and tire replacement
              (EV-specific tires cost more due to weight and low-rolling-resistance requirements).
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>The real calculation:</strong> Compare monthly cost of ownership (payment +
              insurance + electricity + tires) against the equivalent gas car. The EV usually wins,
              but not always &mdash; especially if you don&rsquo;t have home charging and rely on
              DC fast chargers ($0.30-0.50/kWh vs. $0.12-0.15/kWh at home).
            </p>
          </div>

          {/* Summary */}
          <div className="mb-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The Quick Version
            </h2>
            <ol className="space-y-2 text-gray-700">
              <li><strong>1.</strong> Battery SoH &mdash; the most important number</li>
              <li><strong>2.</strong> Charging speeds &mdash; AC and DC</li>
              <li><strong>3.</strong> Software version &mdash; is it current?</li>
              <li><strong>4.</strong> 12V battery age &mdash; when was it last replaced?</li>
              <li><strong>5.</strong> Service history &mdash; does it exist?</li>
              <li><strong>6.</strong> Title and accident history &mdash; run the VIN</li>
              <li><strong>7.</strong> Open recalls &mdash; check NHTSA</li>
              <li><strong>8.</strong> Warranty transfer &mdash; how much is left?</li>
              <li><strong>9.</strong> Real-world range &mdash; test drive energy consumption</li>
              <li><strong>10.</strong> Total cost of ownership &mdash; don&rsquo;t forget insurance and tires</li>
            </ol>
          </div>

          {/* CTA */}
          <div className="mb-12 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Have a specific listing?
            </h3>
            <p className="text-gray-600 mb-4">
              Paste the URL and get a personalized receipt with risk flags, fair price check,
              and exactly what to ask the seller.
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
                <Link href="/checklists/underpriced-ev-listing" className="text-blue-600 hover:text-blue-700">
                  Underpriced EV Listing Checklist &rarr;
                </Link>
              </li>
              <li>
                <Link href="/blog/ev-regret-routine" className="text-blue-600 hover:text-blue-700">
                  EV Regret Isn&rsquo;t About Range. It&rsquo;s About Routine. &rarr;
                </Link>
              </li>
              <li>
                <Link href="/blog/used-tesla-model-3-worth-it" className="text-blue-600 hover:text-blue-700">
                  Is a Used Tesla Model 3 Worth It in 2026? &rarr;
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-500 text-sm border-t border-gray-200">
        <p>OFFO Labs &middot; Building decision intelligence that reduces regret</p>
      </footer>
    </div>
  );
}
