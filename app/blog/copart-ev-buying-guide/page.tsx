"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function CopartEvBuyingGuide() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-br from-orange-50 to-amber-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/blog" className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block">
            ← Back to Blog
          </Link>
          <div className="mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">Buyer&apos;s Guide</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Buying a Salvage EV at Copart: What the Auction Report Actually Tells You
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>11 min read</span>
            <span>·</span>
            <span>April 4, 2026</span>
            <span>·</span>
            <span>OFFO Lab</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none text-gray-700">

          <p className="text-xl leading-relaxed mb-8">
            The first thing most people think when they see a salvage Tesla on Copart: <em>that&apos;s a scam waiting to happen.</em> The second thing experienced auction buyers think: <em>that might be exactly what I&apos;m looking for.</em>
          </p>

          <p className="leading-relaxed mb-6">
            Both reactions are correct — just for different lots. A hail-damaged Model Y with 18,000 miles and surface dents sells for $18,000 vs $38,000 clean. A flood-damaged Ioniq 5 with salt-water battery damage sells for $12,000 — and then costs $25,000 to repair, if it&apos;s repairable at all.
          </p>

          <p className="leading-relaxed mb-8">
            The auction report tells you which one you&apos;re looking at — if you know how to read it.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">The Damage Classification: The Only Number That Matters First</h2>

          <p className="leading-relaxed mb-4">
            Before you look at bid price, before you count the photos, before you calculate ARV — read the primary damage type. It determines everything else.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
            <p className="font-semibold text-green-800 mb-2">Safe damage types (proceed to analysis)</p>
            <ul className="space-y-1 text-sm text-green-700">
              <li><strong>Hail:</strong> Surface damage only. Battery pack is shielded beneath the floor — hail doesn&apos;t reach it. These are the best auction EVs.</li>
              <li><strong>Minor front-end collision, airbags NOT deployed:</strong> Front bumper, hood, fenders. Battery pack and power electronics are typically unaffected.</li>
              <li><strong>Theft recovery, no structural damage:</strong> Often just missing parts. Battery and drivetrain intact.</li>
              <li><strong>Vandalism (surface only):</strong> Broken glass, keyed panels, slashed tires. Mechanical systems intact.</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <p className="font-semibold text-amber-800 mb-2">Risky damage types (proceed with caution, inspection required)</p>
            <ul className="space-y-1 text-sm text-amber-700">
              <li><strong>Side collision:</strong> Battery pack runs the length of the floor — side impacts can puncture or deform cells. Requires physical inspection of the pack.</li>
              <li><strong>Rear collision:</strong> Less common for battery exposure but can damage rear motor and charging components.</li>
              <li><strong>Airbags deployed:</strong> Higher-severity impact. Inspect structural damage carefully.</li>
              <li><strong>Rollover:</strong> Structural compression. Battery pack integrity unknown without inspection.</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-8">
            <p className="font-semibold text-red-800 mb-2">Never buy (full stop)</p>
            <ul className="space-y-1 text-sm text-red-700">
              <li><strong>Flood damage:</strong> Salt water inside battery cells causes internal short circuits that are expensive or impossible to repair safely. Battery packs with water ingress can re-ignite months later during charging.</li>
              <li><strong>Fire damage:</strong> Thermal runaway in EV battery packs is not like an engine fire. Cells that have entered thermal runaway can re-ignite even after the vehicle is &ldquo;extinguished.&rdquo;</li>
              <li><strong>Unknown damage with no photos:</strong> If the lot has no interior photos, no undercarriage photos, and says &ldquo;unknown&rdquo; damage — pass.</li>
            </ul>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">Title Status: Salvage vs Rebuilt vs Clean</h2>

          <p className="leading-relaxed mb-4">
            Copart sells three title types you&apos;ll encounter for EVs:
          </p>

          <p className="leading-relaxed mb-2"><strong>Salvage title:</strong> Insurance declared the vehicle a total loss. The vehicle has not yet been repaired. You buy it as-is — damage visible in photos. This is where the real deals are.</p>
          <p className="leading-relaxed mb-2"><strong>Certificate of Destruction (CoD):</strong> The insurer intends this vehicle to be parted out or crushed, not repaired. In most states, you cannot register a CoD vehicle. Useful for parts only.</p>
          <p className="leading-relaxed mb-6"><strong>Runs and Drives / Clean title:</strong> Sometimes Copart has vehicles with clean titles — repos, donations, or off-lease cars the insurance company acquired. These sell at much higher prices and require less due diligence.</p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">The Arbitrage Math</h2>

          <p className="leading-relaxed mb-4">
            The fundamental question for any salvage EV: what is this worth fixed vs what will it cost to fix?
          </p>

          <p className="leading-relaxed mb-2"><strong>After Repair Value (ARV):</strong> What similar clean-title vehicles sell for in your market. Pull 3 comps from Carfax/AutoTrader for the same year/trim/mileage range.</p>
          <p className="leading-relaxed mb-2"><strong>Repair estimate:</strong> Get a real number from a body shop or EV repair specialist. For hail damage: $3,000–$8,000. For front-end collision: $5,000–$15,000. For anything touching the battery: get a physical inspection first.</p>
          <p className="leading-relaxed mb-4"><strong>Max safe bid:</strong> ARV − repair estimate − 15% margin. If you pay more than this, you&apos;re losing money.</p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
            <p className="text-sm font-semibold text-gray-700 mb-2">Example: 2022 Tesla Model Y Long Range, hail damage</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Clean title comps: $34,000–$37,000 → ARV: $35,000</li>
              <li>Paintless dent repair (PDR) estimate: $4,500–$6,000</li>
              <li>15% margin buffer: $5,250</li>
              <li><strong>Max safe bid: ~$23,750</strong></li>
              <li>If bidding ends at $19,000: $4,750 profit potential after repairs</li>
            </ul>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">What OFFO&apos;s Auction Audit Scores</h2>

          <p className="leading-relaxed mb-4">
            OFFO&apos;s Auction Audit runs this full analysis automatically for any Copart or IAAI lot number:
          </p>

          <ul className="space-y-2 mb-6">
            <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> Damage classification with safety rating</li>
            <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> Salvage risk score (0–100)</li>
            <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> ARV estimate from real-time comparable sales</li>
            <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> Repair cost range by damage type</li>
            <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> Max safe bid calculation</li>
            <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> Open NHTSA recalls by VIN</li>
            <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> Overall verdict: Buy / Inspect / Pass</li>
          </ul>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-8">
            <p className="font-semibold text-blue-800 mb-2">Run an Auction Audit</p>
            <p className="text-sm text-blue-700 mb-3">
              Paste any Copart or IAAI lot number and get a full analysis in under 60 seconds.
            </p>
            <a
              href="/copart"
              className="inline-block bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Analyze a Lot →
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}
