"use client";

import Link from "next/link";
import RelatedPosts from "@/components/RelatedPosts";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

const PRICING_FACTORS = [
  {
    number: "01",
    title: "Battery State of Health (SOH)",
    description:
      "This is the single biggest EV-specific pricing variable. A 2020 Nissan Leaf at 85% SOH is meaningfully different from one at 72% — and buyers know it. On OFFO, every receipt flags battery degradation risk based on mileage, model, chemistry, and available OBD data. Vehicles with strong battery health command a 5–12% premium over comparable mileage units with degradation flags.",
    tip: "If you have OBD data or a pre-sale battery check, lead with it. Buyers pay for certainty.",
  },
  {
    number: "02",
    title: "Charging Port Generation",
    description:
      "A 2019 Nissan Leaf with CHAdeMO fast charging is worth less today than a CCS-equipped unit — not because of range, but because CHAdeMO infrastructure is collapsing. Meanwhile, NACS adoption is creating new tiers on Tesla-compatible vehicles. Buyers are acutely aware of which charging standard their vehicle supports and what the network looks like in their area.",
    tip: "List the connector type explicitly (CCS / CHAdeMO / NACS). Buyers filter on this.",
  },
  {
    number: "03",
    title: "Open Recalls",
    description:
      "EV-specific recalls (battery fire risk, charging system faults, software) carry disproportionate weight with buyers because they signal safety risk, not just inconvenience. A vehicle with an open battery recall can sit on your lot for weeks — or move quickly at a 10–15% discount. If the recall has been completed, documenting it adds value. Completed recall = a story of a problem that was fixed.",
    tip: "Pull NHTSA records before pricing. Completed recalls are an asset; open ones need a discount buffer.",
  },
  {
    number: "04",
    title: "Mileage — But Interpreted Differently",
    description:
      "EV buyers don't fear high mileage the way ICE buyers do — there's no oil-change anxiety. What they do fear is battery degradation correlated with high mileage. A 90,000-mile Tesla Model 3 with no degradation flags is a better buy than a 60,000-mile unit with early capacity loss. Price mileage relative to battery health, not in isolation.",
    tip: "Separate your mileage pitch from your battery pitch. They're not the same variable.",
  },
];

const PRICING_TIERS = [
  {
    tier: "Excellent",
    color: "text-[#00d97e]",
    border: "border-[#00d97e]/30",
    bg: "bg-[#00d97e]/5",
    criteria: "Battery SOH >90%, no open recalls, CCS or NACS port, clean title, <60k miles",
    guidance: "Price at or above MMR. These move. Don't discount preemptively.",
  },
  {
    tier: "Good",
    color: "text-blue-300",
    border: "border-blue-300/30",
    bg: "bg-blue-500/5",
    criteria: "Battery SOH 80–90%, completed recalls, CCS port, clean title, 60–90k miles",
    guidance: "Price 3–7% below top comparable. Buyers will find minor flags — price them in before they ask.",
  },
  {
    tier: "Fair",
    color: "text-amber-400",
    border: "border-amber-400/30",
    bg: "bg-amber-500/5",
    criteria: "Battery SOH <80%, CHAdeMO port, or minor title issue (rebuilt/disclosed accident)",
    guidance: "Price 10–18% below comparable clean units. Buyers will OFFO-check this vehicle. Price it to look honest, not like you're hiding something.",
  },
];

export default function HowToPriceUsedEvInventoryPage() {
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/blog" className="text-xs text-white/40 hover:text-white/60 transition-colors">← Blog</Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">Dealer Guide</span>
            <span className="text-xs text-white/30">9 min read</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            How to Price Your Used EV Inventory
          </h1>
          <p className="text-lg text-white/60 leading-relaxed">
            Battery degradation, charging port generation, recall history — the 4 factors data-driven EV buyers use to judge whether your price is fair.
          </p>
          <p className="text-xs text-white/30 mt-4">May 23, 2026 · OFFO Lab</p>
        </div>

        {/* Intro */}
        <div className="prose prose-invert max-w-none mb-12">
          <p className="text-white/70 text-base leading-relaxed mb-4">
            Used EV pricing is not like pricing a used ICE vehicle. A dealer who applies standard mileage-based depreciation curves to electric cars is leaving money on the table — or worse, pricing units that won&apos;t sell because they&apos;re ignoring the variables buyers actually care about.
          </p>
          <p className="text-white/70 text-base leading-relaxed mb-4">
            OFFO buyers run a battery risk check on every vehicle before they contact a dealer. They know the difference between a 2022 Chevy Bolt at 88% battery SOH and one at 76%. They know CHAdeMO is dying. They&apos;ve already pulled the NHTSA recall record before they submit an inquiry.
          </p>
          <p className="text-white/70 text-base leading-relaxed">
            Here&apos;s how to price into what they already know.
          </p>
        </div>

        {/* Why EV pricing is different */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-4">Why EV Pricing Is Different from ICE</h2>
          <p className="text-white/70 text-base leading-relaxed mb-4">
            In a gasoline vehicle, depreciation is dominated by mileage and condition. The powertrain is well-understood; buyers know roughly what a 60,000-mile Camry should cost.
          </p>
          <p className="text-white/70 text-base leading-relaxed mb-4">
            In an EV, mileage is one variable among several — and sometimes not the most important one. The battery is the asset. A high-mileage EV with healthy battery chemistry can be a better buy than a low-mileage unit that spent two years parked in Arizona heat with no thermal management. Buyers know this, and they&apos;re pricing accordingly.
          </p>
          <p className="text-white/70 text-base leading-relaxed">
            There&apos;s also a technology depreciation layer that ICE vehicles don&apos;t have. Charging standard obsolescence (CHAdeMO), software lock-in, and network compatibility all affect residual value in ways the Black Book doesn&apos;t capture.
          </p>
        </section>

        {/* 4 pricing factors */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6">The 4 Factors EV Buyers Actually Check</h2>
          <div className="space-y-6">
            {PRICING_FACTORS.map((f) => (
              <div key={f.number} className="bg-[#161b22] rounded-xl border border-white/[0.07] p-6">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-mono text-[#00d97e]/60 shrink-0 mt-1">{f.number}</span>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed mb-3">{f.description}</p>
                    <div className="flex items-start gap-2 bg-[#00d97e]/[0.06] border border-[#00d97e]/20 rounded-lg px-3 py-2">
                      <span className="text-[#00d97e] text-xs font-semibold shrink-0 mt-0.5">Tip</span>
                      <p className="text-xs text-[#00d97e]/80 leading-relaxed">{f.tip}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How OFFO buyers research */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-4">How OFFO Buyers Research Before Contacting You</h2>
          <p className="text-white/70 text-base leading-relaxed mb-4">
            A growing number of EV buyers paste your listing URL into OFFO before they submit an inquiry. OFFO extracts the vehicle details, runs them against battery risk models, checks open recalls via NHTSA, compares the price to market comps, and returns a verdict: recommended, caution, or risky.
          </p>
          <p className="text-white/70 text-base leading-relaxed mb-4">
            If your listing gets flagged &quot;caution&quot; or &quot;risky,&quot; buyers either don&apos;t contact you, or they contact you with a lowball offer anchored to the flag. The flags that generate most lowball inquiries:
          </p>
          <ul className="space-y-2 mb-4">
            {[
              "Price above market by more than 8% with no disclosed condition advantage",
              "Open NHTSA recall with no dealer note addressing it",
              "Mileage in a range associated with high degradation for that model/chemistry",
              "CHAdeMO port on a vehicle priced like a CCS unit",
            ].map((flag) => (
              <li key={flag} className="flex items-start gap-2 text-sm text-white/60">
                <span className="text-red-400 mt-0.5 shrink-0">→</span>
                {flag}
              </li>
            ))}
          </ul>
          <p className="text-white/70 text-base leading-relaxed">
            Dealers who are transparent about battery condition, recall history, and charging specs get better-quality inquiries — buyers who are already educated and ready to move.
          </p>
        </section>

        {/* Pricing tiers */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6">Pricing Tiers by Condition</h2>
          <div className="space-y-4">
            {PRICING_TIERS.map((t) => (
              <div key={t.tier} className={`rounded-xl border ${t.border} ${t.bg} p-5`}>
                <p className={`text-sm font-bold ${t.color} mb-2`}>{t.tier}</p>
                <p className="text-xs text-white/50 mb-2">{t.criteria}</p>
                <p className="text-sm text-white/70">{t.guidance}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-[#161b22] border border-[#00d97e]/20 rounded-2xl p-8 text-center mb-12">
          <h2 className="text-xl font-bold text-white mb-3">See What OFFO Buyers See</h2>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            Run a free OFFO receipt check on any vehicle in your inventory. See exactly how buyers score it before they contact you — then price accordingly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dealers/join"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#00d97e] text-[#0d1117] text-sm font-bold rounded-xl hover:bg-[#00c970] transition-colors"
            >
              Claim your free dealer profile →
            </Link>
            <Link
              href="/receipt"
              className="inline-flex items-center justify-center px-6 py-3 border border-white/10 text-white/70 text-sm font-medium rounded-xl hover:text-white hover:border-white/20 transition-colors"
            >
              Run a receipt check
            </Link>
          </div>
        </div>

        <RelatedPosts currentSlug="how-to-price-used-ev-inventory" />
      </div>
    </div>
  );
}
