"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function EvFitScoreExplained() {
  useVisitorTracking();

  const factors = [
    { n: 1, name: "Daily commute distance", weight: "High", detail: "Under 50 miles: strong fit signal. 50–100 miles: conditional (depends on charging). Over 100 miles one-way: EV requires careful model selection and charging plan." },
    { n: 2, name: "Home charging access", weight: "High", detail: "Home Level 2: strong positive. Home Level 1: conditional. No home charging: conditional on workplace or nearby public L2. No reliable access: negative signal — requires deeper analysis." },
    { n: 3, name: "Climate zone", weight: "Medium-High", detail: "Mild (above 30°F in winter): minimal impact. Cold (10–30°F winters): 20–30% range penalty, heat pump model recommended. Extreme cold (below 10°F): 35–45% range penalty, heat pump + buffer routine required." },
    { n: 4, name: "Vehicle EPA range vs commute", weight: "Medium-High", detail: "Target: at least 2x daily round-trip in the battery. For cold climates, add 30–35% buffer on top. A 250-mile EV is fine for a 50-mile daily commute in Minneapolis — just barely." },
    { n: 5, name: "Driving pattern predictability", weight: "Medium", detail: "Same commute daily: strong fit. Highly variable daily mileage with occasional 150+ mile days: requires larger battery or fast-charging plan. Multiple long road trips per month: requires fast-charging plan." },
    { n: 6, name: "Home ownership / parking control", weight: "Medium", detail: "Own with garage: full control over charging installation. Rent with assigned parking: EVSE installation may require landlord approval. Rent without assigned parking: relies on public/workplace charging." },
    { n: 7, name: "Budget vs total cost of ownership", weight: "Medium", detail: "EVs have lower operating costs (fuel + maintenance) but higher upfront cost. Payback period vs equivalent ICE vehicle: typically 3–6 years at current electricity/gas prices. The used EV market now offers many sub-$25K options that close this gap." },
    { n: 8, name: "Flexibility for adjustment", weight: "Low-Medium", detail: "How much friction can you tolerate while adapting to EV ownership habits? Most regret comes from underestimating this adjustment period, not from actual EV limitations." },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-br from-indigo-50 to-blue-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/blog" className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block">
            ← Back to Blog
          </Link>
          <div className="mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">Methodology</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            How OFFO Scores EV Fit: The Full Methodology
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>6 min read</span>
            <span>·</span>
            <span>February 1, 2026</span>
            <span>·</span>
            <span>OFFO Lab</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="text-xl leading-relaxed mb-8">
            OFFO&apos;s EV fit score isn&apos;t a quiz with predetermined answers. It&apos;s a weighted model that combines 8 factors — some objective (your commute distance, climate), some situational (charging access, driving pattern), some personal (flexibility, budget). Here&apos;s exactly how each factor is evaluated and weighted.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-6">The 8 Factors</h2>

          <div className="space-y-4 mb-10">
            {factors.map((f) => (
              <div key={f.n} className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">{f.n}. {f.name}</h3>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    f.weight.startsWith("High") ? "bg-red-100 text-red-700" :
                    f.weight.startsWith("Medium-High") ? "bg-orange-100 text-orange-700" :
                    f.weight.startsWith("Medium") ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {f.weight} weight
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{f.detail}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">How the Score Combines</h2>
          <p className="leading-relaxed mb-4">
            The score is not a simple average. High-weight factors can veto a positive signal from low-weight factors. If you have no reliable charging access (high weight, negative signal), no amount of favorable climate or short commute produces a strong fit score.
          </p>
          <p className="leading-relaxed mb-8">
            The output is a verdict — Strong Fit, Conditional, or Not Yet — with specific callouts for which factors drove the result. The goal is not to tell you what to buy, but to surface the one or two things that will most affect your EV experience.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-8">
            <p className="font-semibold text-blue-800 mb-1">Run your own fit check</p>
            <p className="text-sm text-blue-700 mb-3">8 questions, 2 minutes, personalized verdict.</p>
            <Link href="/routine" className="inline-block bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Check My EV Fit →
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
