"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function EvRegretCaseStudies() {
  useVisitorTracking();

  const cases = [
    {
      n: 1,
      title: "Sarah, Chicago — Ioniq 5, bought winter 2022",
      regret: "\"I spend every cold morning anxious about whether I&apos;ll make it to work.\"",
      what_happened: "Sarah drives 45 miles each way. Her Ioniq 5 Long Range shows 266 miles in summer. In January, the real-world range drops to 175–190 miles. Her round trip is 90 miles. In summer: 176% buffer. In January: 97% buffer — with no margin for detours, cold starts, or forgetting to plug in.",
      what_changed: "She now runs the winter buffer routine (never below 80%) and preconditions before every departure. Her anxiety is gone. But she admits she would have bought the Long Range AWD model instead of Standard Range if she&apos;d understood the winter math.",
      lesson: "The issue wasn&apos;t the EV. It was buying a model without understanding cold-weather range loss for her specific commute.",
    },
    {
      n: 2,
      title: "Marcus, Los Angeles — Nissan Leaf, bought 2019",
      regret: "\"Three years in, my range is 110 miles. I feel ripped off.\"",
      what_happened: "Marcus bought a 2018 Leaf with 22,000 miles in 2019. The EPA range was 150 miles. He lived in LA — perfect EV climate. By 2022, after regular DC fast charging and two Phoenix road trips, his battery was at 72% state of health. His effective range: 108 miles.",
      what_changed: "Nothing changed — he still drives it. But the lesson is clear: the Leaf without active thermal management degrades faster than any other mainstream EV, especially in warm climates with DC fast charging use.",
      lesson: "The Leaf was a bad fit for his use case, not a bad EV per se. Active thermal management models (Model 3, Bolt, Ioniq) would have held capacity much better.",
    },
    {
      n: 3,
      title: "Derek, Brooklyn — Model 3, bought 2021",
      regret: "\"I spend 45 minutes every 3 days driving to the Supercharger. It&apos;s a second job.\"",
      what_happened: "Derek doesn&apos;t have a parking space. He relies on a Tesla Supercharger 12 blocks away. In theory: drive there, plug in, do something for 20 minutes, done. In practice: the 6-stall charger is often full at night, parking rules limit how long you can stay, and the cognitive overhead of \"when do I charge next\" never goes away.",
      what_changed: "Derek eventually found a parking garage with monthly Level 2 charging for $280/month. He considers this an acceptable but annoying fixed cost.",
      lesson: "DC fast charging as a primary strategy works in theory but fails in practice for daily urban EV ownership. Without reliable Level 2 access, an EV is the wrong car for apartment dwellers in dense cities.",
    },
    {
      n: 4,
      title: "Jennifer, Minneapolis — Chevy Bolt, bought 2020",
      regret: "\"I didn&apos;t know the recall was coming. My car sat in a parking lot for 4 months.\"",
      what_happened: "Jennifer bought a 2020 Bolt in spring 2020. In summer 2021, GM issued a recall for potential battery fire risk and advised owners not to charge above 90% or park in garages overnight. For 4 months during the recall resolution, her car was effectively a liability, not an asset.",
      what_changed: "GM replaced her battery pack with new LG cells. The Bolt is now one of the most reliable used EVs on the market. But she learned the lesson of checking open recalls before buying.",
      lesson: "Recalls happen. Running the VIN through NHTSA before purchase, and understanding the resolution status, is now part of her buying process.",
    },
    {
      n: 5,
      title: "Kevin, suburban Phoenix — Hyundai Kona Electric, bought 2022",
      regret: "\"The Kona is slow to charge and I drive 80 miles a day. I&apos;m always scrambling.\"",
      what_happened: "Kevin commutes 80 miles daily in a market where Level 2 charging at work isn&apos;t available. He bought the Kona Electric (258 miles EPA) thinking it was enough buffer. The issue: the Kona charges at only 7.2 kW on Level 2 (less than half of competitors) and 50 kW DC max. His home charging adds 8–10 hours for a full charge. If he leaves work with 40% and drives home, he arrives with 15–20% and needs a full overnight charge every single day.",
      what_changed: "He&apos;s still driving it but is planning to upgrade to an Ioniq 6 when lease is up. The lesson: charging speed matters as much as range for high-mileage drivers.",
      lesson: "Range is only half the equation. Charging speed — both Level 2 kW rating and DC peak — determines whether your EV fits a high-mileage commute.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-br from-red-50 to-rose-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/blog" className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block">
            ← Back to Blog
          </Link>
          <div className="mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800">Case Studies</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            5 People Who Regretted Buying an EV — And Exactly Why
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>10 min read</span>
            <span>·</span>
            <span>January 15, 2026</span>
            <span>·</span>
            <span>OFFO Lab</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="text-xl leading-relaxed mb-4">
            EV regret is real. Not universal — most EV owners rate their satisfaction higher than gas car owners — but the minority who regret it often regret it intensely.
          </p>
          <p className="leading-relaxed mb-10">
            The common thread isn&apos;t the EV. It&apos;s mismatch: wrong model for the climate, wrong use case for the charging situation, wrong expectations for the adjustment period. These five stories are real composites of patterns we&apos;ve seen. None of them were inevitable.
          </p>

          <div className="space-y-8 mb-12">
            {cases.map((c) => (
              <div key={c.n} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900">{c.title}</h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm italic text-gray-600">{c.regret}</p>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What happened</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.what_happened}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What changed</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.what_changed}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-4 py-2.5">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Key lesson</p>
                    <p className="text-sm text-blue-800">{c.lesson}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">The Pattern</h2>
          <p className="leading-relaxed mb-4">
            Four of the five cases had a pre-purchase information gap that OFFO would have surfaced: cold-weather range math for a specific commute, Leaf degradation risk, apartment charging viability, Kona charging speed limitations. None of these are obscure facts — they&apos;re in the documentation. They just weren&apos;t surfaced at the moment of decision.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-8">
            <p className="font-semibold text-blue-800 mb-1">Check a specific listing before you buy</p>
            <p className="text-sm text-blue-700 mb-3">Paste the listing URL and OFFO checks title, recalls, battery flags, and fair market value automatically.</p>
            <Link href="/receipt" className="inline-block bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Run OFFO Check →
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
