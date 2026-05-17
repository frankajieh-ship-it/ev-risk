import Link from "next/link";
import type { Metadata } from "next";
import { FileSearch, Gavel, Route, ArrowLeft } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import MethodologyAccordion from "@/components/methodology/MethodologyAccordion";
import PageTracker from "@/components/PageTracker";
import {
  METHODOLOGY_VERSION,
  METHODOLOGY_UPDATED,
  METHODOLOGY_CHANGELOG,
  METHODOLOGY_ACCORDION,
} from "@/content/methodology";

export const metadata: Metadata = {
  title: "How OFFO Works — Methodology",
  description:
    "How OFFO combines listing signals, EV-specific risk checks, and routine-fit analysis to help you decide whether a used EV is worth pursuing.",
};

const SCOPE_CARDS = [
  {
    icon: FileSearch,
    color: "bg-blue-100 text-blue-600",
    title: "Analyze a Car",
    bullets: ["Listing quality", "Battery & service risk", "Price context", "Seller questions"],
  },
  {
    icon: Gavel,
    color: "bg-orange-100 text-orange-600",
    title: "Auction Bidder",
    bullets: ["Salvage risk", "Repair vs parts-only economics", "Safe bid range", "Title & uncertainty"],
  },
  {
    icon: Route,
    color: "bg-green-100 text-green-600",
    title: "EV Routine Check",
    bullets: ["Charging fit", "Winter & longest-day buffer", "Ownership friction", "Comparison support"],
  },
];

const DATA_SOURCES = [
  {
    label: "Vehicle & safety",
    bullets: ["VIN decode", "Trim normalization", "Recalls & safety campaigns", "Battery-pack attributes"],
  },
  {
    label: "Market & pricing",
    bullets: ["Listing price comparisons", "Auction context", "Title & salvage context"],
  },
  {
    label: "EV-specific ownership",
    bullets: [
      "Battery chemistry & degradation assumptions",
      "Range adjustments",
      "Charging density",
      "Climate effects",
      "Model-specific issue patterns",
    ],
  },
  {
    label: "User-provided",
    bullets: ["Listing or lot URL", "Routine answers", "Budget & preferences"],
  },
];

const CONFIDENCE_LEVELS = [
  {
    label: "High",
    color: "text-green-700",
    explanation: "Enough detail to distinguish clearly between outcomes.",
  },
  {
    label: "Medium",
    color: "text-yellow-700",
    explanation: "The direction is useful, but one or two missing factors could move the result.",
  },
  {
    label: "Low",
    color: "text-red-600",
    explanation: "Treat as a starting point, not a decision.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <PageTracker event="methodology_page_viewed" />
      <Header variant="homepage" />

      {/* 1. Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-12 pb-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">How OFFO works</h1>
        <p className="text-base md:text-lg text-white/60 mb-6 leading-relaxed">
          We combine listing signals, EV-specific risk checks, market context, and routine-fit analysis to help you
          decide whether a car is worth pursuing.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/40 mb-8">
          <li>Built for used EV listings</li>
          <li>Designed to reduce regret, not just show specs</li>
          <li>Every result is an estimate, not a guarantee</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 bg-[#00d97e] text-black rounded-xl text-sm font-semibold hover:bg-[#00c970] transition-colors"
          >
            Analyze a Car →
          </Link>
          <Link
            href="/receipt"
            className="px-5 py-2.5 border border-white/[0.1] text-white/70 rounded-xl text-sm font-semibold hover:border-white/20 hover:bg-white/[0.04] transition-colors"
          >
            View example result →
          </Link>
        </div>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 2. What OFFO evaluates */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-white mb-1">What OFFO evaluates</h2>
        <p className="text-sm text-white/40 mb-8">Three surfaces, each with its own analysis logic.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SCOPE_CARDS.map(({ icon: Icon, color, title, bullets }) => (
            <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
              <ul className="space-y-1">
                {bullets.map((b) => (
                  <li key={b} className="text-sm text-white/50 flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-white/30 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 3. Battery health model */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-white mb-2">How we estimate battery health</h2>
        <p className="text-sm text-white/40 mb-6">A physics-informed lookup with empirical priors — not a trained ML model.</p>

        {/* What it is */}
        <div className="space-y-4 text-sm text-white/60 leading-relaxed mb-8">
          <p>
            We don&apos;t pull a real-time SOH value from the car, and we don&apos;t have a trained predictive model
            with held-out test sets. What we build is an <span className="text-white font-medium">expected health range</span> using
            a small set of raw inputs combined with published degradation priors for each battery chemistry.
          </p>
        </div>

        {/* Raw inputs */}
        <div className="rounded-xl bg-[#161b22] border border-white/[0.08] p-5 mb-6">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wide mb-4">Raw inputs — what actually goes in</p>
          <div className="space-y-2">
            {[
              { input: "VIN decode", detail: "Exact trim, model year, battery pack size, production spec — straight from the manufacturer" },
              { input: "Reported mileage", detail: "From the listing — the primary binding constraint on degradation" },
              { input: "EPA-rated range", detail: "Used as the denominator to normalize SOH across platforms, since OBD 100% means different things on different architectures (e.g. E-GMP vs Ultium overprovisioning varies)" },
              { input: "Battery chemistry", detail: "Inferred from VIN: NMC, LFP, NCA, or air-cooled — determines the degradation rate prior" },
              { input: "Vehicle age", detail: "Calendar years since production — applied alongside mileage, whichever is the binding constraint" },
            ].map(({ input, detail }) => (
              <div key={input} className="flex gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-[#00d97e] text-xs font-mono font-semibold shrink-0 w-36 pt-0.5">{input}</span>
                <span className="text-sm text-white/50 leading-relaxed">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What we can't track */}
        <div className="rounded-xl bg-red-500/[0.07] border border-red-500/20 p-5 mb-6">
          <p className="text-xs font-semibold text-red-400/60 uppercase tracking-wide mb-3">What we cannot track from a listing</p>
          <div className="space-y-1.5">
            {[
              "DCFC charging frequency or fast-charge history",
              "Thermal events or extreme temperature exposure history",
              "Charging habits (regular 100% vs 80% daily limit)",
              "Individual cell variance within the pack",
              "Whether the seller completed any battery-related recalls",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-red-300/60">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400/40 shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-red-300/40 mt-3 leading-relaxed">
            These inputs move individual packs meaningfully. We don&apos;t have them. The range we output is the
            population distribution for that VIN profile — not a prediction for that specific unit.
          </p>
        </div>

        {/* Degradation priors */}
        <div className="rounded-xl bg-[#161b22] border border-white/[0.08] p-5 mb-6">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wide mb-4">Degradation priors by chemistry</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { chem: "NMC / NCM", rate: "~2.0% / year", note: "Majority of current EVs — Hyundai, Kia, VW, Ford" },
              { chem: "LFP", rate: "~1.5% / year", note: "Tesla Standard Range, BYD — better longevity tail" },
              { chem: "NCA", rate: "~2.3% / year", note: "Older Tesla Model S/X pre-2021" },
              { chem: "Air-cooled", rate: "~3.0% / year", note: "Pre-2023 Nissan Leaf — steeper decline cliff" },
            ].map(({ chem, rate, note }) => (
              <div key={chem} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-white mb-0.5">{chem}</p>
                <p className="text-[#00d97e] text-sm font-mono mb-1">{rate}</p>
                <p className="text-xs text-white/40">{note}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30 leading-relaxed">
            Rates sourced from published fleet studies and peer-reviewed degradation literature.
            Chemistry differentiation matters most at the tails (LFP longevity advantage,
            air-cooled Leaf degradation cliff) and less for mainstream NMC-to-NMC comparisons.
          </p>
        </div>

        {/* Output framing */}
        <div className="rounded-xl bg-[#00d97e]/[0.06] border border-[#00d97e]/20 p-5 mb-6">
          <p className="text-xs font-semibold text-[#00d97e]/60 uppercase tracking-wide mb-3">What the output actually means</p>
          <p className="text-sm text-white/60 leading-relaxed mb-3">
            The result is a <span className="text-white font-medium">cohort range</span>, not a unit measurement.
            &ldquo;88–93% expected at this mileage&rdquo; means: vehicles with this VIN profile at this mileage
            typically land in that band based on population-level degradation data.
          </p>
          <p className="text-sm text-white/60 leading-relaxed">
            The signal is most useful for <span className="text-white font-medium">relative comparison</span> — two
            otherwise identical listings where one is at 90k miles and one at 45k miles, or where one is a
            Leaf (air-cooled) and one is a Bolt (liquid-cooled). It&apos;s not a warranty-grade SOH certificate.
          </p>
        </div>

        {/* OBD note */}
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-sm text-amber-300/80 leading-relaxed">
            <span className="font-semibold text-amber-300">On OBD2 SOH readings:</span> They&apos;re noisy —
            a February reading in a cold climate is not the same as a post-summer full-cycle reading.
            Our estimate doesn&apos;t use OBD data. It&apos;s a population prior applied to VIN-decoded specs,
            which is why it doesn&apos;t vary with season or charge state.
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 4. Decision framework */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-white mb-2">The decision framework</h2>
        <p className="text-sm text-white/40 mb-6">OFFO looks at three things — not just specs.</p>
        <div className="space-y-3 mb-6">
          {[
            { label: "Vehicle condition and risk", body: "Is there evidence this car will cause problems?" },
            { label: "Deal economics", body: "Is the price fair given what the listing tells us?" },
            { label: "Ownership fit", body: "Does this car match the buyer's real routine?" },
          ].map(({ label, body }) => (
            <div key={label} className="flex gap-3">
              <div className="mt-2 w-1.5 h-1.5 rounded-full bg-[#00d97e]/60 shrink-0" />
              <p className="text-sm text-white/70">
                <span className="font-semibold text-white">{label}</span> — {body}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] px-5 py-4 space-y-2">
          {[
            "A car can be mechanically sound but still a bad deal.",
            "A fair deal can still be the wrong fit for someone's routine.",
            "Auction vehicles may have parts value even when repair is not recommended.",
          ].map((s) => (
            <p key={s} className="text-sm text-white/50">{s}</p>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 5. Data sources */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-white mb-1">Data sources</h2>
        <p className="text-sm text-white/40 mb-8">What goes into each analysis.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
          {DATA_SOURCES.map(({ label, bullets }) => (
            <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <p className="text-sm font-semibold text-white mb-3">{label}</p>
              <ul className="space-y-1">
                {bullets.map((b) => (
                  <li key={b} className="text-sm text-white/50 flex items-start gap-1.5">
                    <span className="mt-2 w-1 h-1 rounded-full bg-white/30 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/30 italic">
          Some data is exact. Some is inferred from known patterns. Confidence reflects that.
        </p>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 6. How each product computes results */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-white mb-2">How each product computes results</h2>
        <p className="text-sm text-white/40 mb-6">What happens after you paste a URL or answer a question.</p>
        <MethodologyAccordion items={METHODOLOGY_ACCORDION} />
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 7. Confidence and uncertainty */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-white mb-2">Confidence and uncertainty</h2>
        <p className="text-sm text-white/60 mb-6">Confidence matters as much as the score.</p>
        <div className="space-y-3 mb-8">
          {CONFIDENCE_LEVELS.map(({ label, color, explanation }) => (
            <div key={label} className="flex gap-3 text-sm">
              <span className={`font-semibold shrink-0 w-16 ${color}`}>{label}</span>
              <span className="text-white/50">{explanation}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-white/70 mb-2">What can improve confidence</p>
          <p className="text-sm text-white/40 leading-relaxed">
            Verified battery health · Service records · Title history · Exact trim ·
            Charging setup details · Climate &amp; parking details · Inspection results
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 8. What OFFO does not do */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-white mb-4">What OFFO does not do</h2>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] px-5 py-4">
          <ul className="space-y-2">
            {[
              "Not a substitute for a professional inspection.",
              "Does not guarantee battery health from a listing alone.",
              "Does not know whether a seller completed a recall unless verified.",
              "May use estimates when exact local market or charger data is unavailable.",
              "Designed to reduce uncertainty, not eliminate it.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/50">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 9. Changelog */}
      <div className="max-w-3xl mx-auto px-4 py-12 pb-20">
        <h2 className="text-xl font-bold text-white mb-4">Methodology changelog</h2>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] text-xs text-white/40 font-medium mb-6">
          Methodology v{METHODOLOGY_VERSION} · Last updated: {METHODOLOGY_UPDATED}
        </div>
        <ul className="space-y-3">
          {METHODOLOGY_CHANGELOG.map(({ version, note }) => (
            <li key={version} className="flex gap-3 text-sm">
              <span className="font-mono font-semibold text-white/40 shrink-0">{version}</span>
              <span className="text-white/50">{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <Footer />
    </div>
  );
}
