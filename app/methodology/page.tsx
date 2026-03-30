import Link from "next/link";
import type { Metadata } from "next";
import { FileSearch, Gavel, Route, ArrowLeft } from "lucide-react";
import MethodologyAccordion from "@/components/methodology/MethodologyAccordion";
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
    <div className="min-h-screen bg-white">

      {/* 1. Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-12 pb-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How OFFO works</h1>
        <p className="text-base md:text-lg text-gray-600 mb-6 leading-relaxed">
          We combine listing signals, EV-specific risk checks, market context, and routine-fit analysis to help you
          decide whether a car is worth pursuing.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 mb-8">
          <li>Built for used EV listings</li>
          <li>Designed to reduce regret, not just show specs</li>
          <li>Every result is an estimate, not a guarantee</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/receipt"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Analyze a Car →
          </Link>
          <Link
            href="/receipt"
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            View example result →
          </Link>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 2. What OFFO evaluates */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-1">What OFFO evaluates</h2>
        <p className="text-sm text-gray-500 mb-8">Three surfaces, each with its own analysis logic.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SCOPE_CARDS.map(({ icon: Icon, color, title, bullets }) => (
            <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
              <ul className="space-y-1">
                {bullets.map((b) => (
                  <li key={b} className="text-sm text-gray-500 flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 3. Decision framework */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">The decision framework</h2>
        <p className="text-sm text-gray-500 mb-6">OFFO looks at three things — not just specs.</p>
        <div className="space-y-3 mb-6">
          {[
            { label: "Vehicle condition and risk", body: "Is there evidence this car will cause problems?" },
            { label: "Deal economics", body: "Is the price fair given what the listing tells us?" },
            { label: "Ownership fit", body: "Does this car match the buyer's real routine?" },
          ].map(({ label, body }) => (
            <div key={label} className="flex gap-3">
              <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-2" />
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{label}</span> — {body}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-5 py-4 space-y-2">
          {[
            "A car can be mechanically sound but still a bad deal.",
            "A fair deal can still be the wrong fit for someone's routine.",
            "Auction vehicles may have parts value even when repair is not recommended.",
          ].map((s) => (
            <p key={s} className="text-sm text-gray-600">{s}</p>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 4. Data sources */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Data sources</h2>
        <p className="text-sm text-gray-500 mb-8">What goes into each analysis.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
          {DATA_SOURCES.map(({ label, bullets }) => (
            <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-3">{label}</p>
              <ul className="space-y-1">
                {bullets.map((b) => (
                  <li key={b} className="text-sm text-gray-500 flex items-start gap-1.5">
                    <span className="mt-2 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 italic">
          Some data is exact. Some is inferred from known patterns. Confidence reflects that.
        </p>
      </div>

      <div className="border-t border-gray-100" />

      {/* 5. How each product computes results */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">How each product computes results</h2>
        <p className="text-sm text-gray-500 mb-6">What happens after you paste a URL or answer a question.</p>
        <MethodologyAccordion items={METHODOLOGY_ACCORDION} />
      </div>

      <div className="border-t border-gray-100" />

      {/* 6. Confidence and uncertainty */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Confidence and uncertainty</h2>
        <p className="text-sm text-gray-600 mb-6">Confidence matters as much as the score.</p>
        <div className="space-y-3 mb-8">
          {CONFIDENCE_LEVELS.map(({ label, color, explanation }) => (
            <div key={label} className="flex gap-3 text-sm">
              <span className={`font-semibold shrink-0 w-16 ${color}`}>{label}</span>
              <span className="text-gray-600">{explanation}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">What can improve confidence</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Verified battery health · Service records · Title history · Exact trim ·
            Charging setup details · Climate &amp; parking details · Inspection results
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 7. What OFFO does not do */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">What OFFO does not do</h2>
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-5 py-4">
          <ul className="space-y-2">
            {[
              "Not a substitute for a professional inspection.",
              "Does not guarantee battery health from a listing alone.",
              "Does not know whether a seller completed a recall unless verified.",
              "May use estimates when exact local market or charger data is unavailable.",
              "Designed to reduce uncertainty, not eliminate it.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 8. Changelog */}
      <div className="max-w-3xl mx-auto px-4 py-12 pb-20">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Methodology changelog</h2>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-500 font-medium mb-6">
          Methodology v{METHODOLOGY_VERSION} · Last updated: {METHODOLOGY_UPDATED}
        </div>
        <ul className="space-y-3">
          {METHODOLOGY_CHANGELOG.map(({ version, note }) => (
            <li key={version} className="flex gap-3 text-sm">
              <span className="font-mono font-semibold text-gray-500 shrink-0">{version}</span>
              <span className="text-gray-600">{note}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
