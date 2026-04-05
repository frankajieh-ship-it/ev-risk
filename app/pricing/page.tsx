import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, Zap, FileText, MessageSquare, Car } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing — OFFO",
  description:
    "OFFO is free to start. Unlock deeper analysis, negotiation scripts, auction audits, and more with one-time add-ons. No subscription required.",
  alternates: { canonical: "https://offolab.com/pricing" },
  openGraph: {
    title: "OFFO Pricing — Free to start, pay only for what you need",
    description:
      "No subscription. Buyer Pass $9.99, Auction Audit $49, Seller Pack from $2.99. See exactly what you get.",
    url: "https://offolab.com/pricing",
    type: "website",
    siteName: "OFFO",
  },
};

const TIERS = [
  {
    id: "free",
    icon: Car,
    label: "Free",
    price: null,
    badge: null,
    badgeColor: null,
    cta: "Analyze a listing",
    ctaHref: "/receipt",
    ctaStyle: "outline",
    description: "No account needed. Get a quick verdict on any listing.",
    features: [
      "AI deal verdict (Good / Caution / Pass)",
      "Top 3 risk flags",
      "3 seller questions",
      "Battery degradation estimate",
      "Open recall check",
    ],
  },
  {
    id: "buyer_pass",
    icon: Sparkles,
    label: "Buyer Pass",
    price: "$9.99",
    badge: "Most popular",
    badgeColor: "blue",
    cta: "Unlock full analysis",
    ctaHref: "/receipt",
    ctaStyle: "primary",
    description: "Everything you need to negotiate and close with confidence.",
    features: [
      "Full risk breakdown (10+ factors)",
      "Negotiation script tailored to this listing",
      "Pre-purchase inspection checklist",
      "PDF export to share with your mechanic",
      "Compare this vehicle vs alternatives",
      "10 receipt credits",
    ],
  },
  {
    id: "auction_audit",
    icon: Zap,
    label: "Auction Audit",
    price: "$49",
    badge: "For salvage buyers",
    badgeColor: "orange",
    cta: "Audit a Copart lot",
    ctaHref: "/copart",
    ctaStyle: "orange",
    description: "Deep salvage risk analysis for Copart and IAAI lots.",
    features: [
      "Damage classification (hail / flood / collision / fire)",
      "Salvage risk score 0–100",
      "Battery pack exposure assessment",
      "Repair cost estimate + arbitrage (max safe bid)",
      "Post-repair ARV vs current lot price",
      "NHTSA recall check by VIN",
    ],
  },
  {
    id: "seller_questions",
    icon: MessageSquare,
    label: "Seller Pack",
    price: "from $2.99",
    badge: null,
    badgeColor: null,
    cta: "Get seller script",
    ctaHref: "/receipt",
    ctaStyle: "outline",
    description: "One listing, full question set, and a printable checklist.",
    features: [
      "1 full receipt credit",
      "Full seller question script",
      "Pre-purchase checklist",
    ],
  },
  {
    id: "sellers_report_pdf",
    icon: FileText,
    label: "Seller Report PDF",
    price: "$9.99",
    badge: null,
    badgeColor: null,
    cta: "Create seller report",
    ctaHref: "/receipt",
    ctaStyle: "outline",
    description: "One-page dealer-ready PDF to share with buyers or your agent.",
    features: [
      "Branded OFFO verdict PDF",
      "Routine fit score + recall status",
      "Buyer Q&A summary",
      "Share-ready link",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <div className="max-w-5xl mx-auto px-4 py-14">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">No subscription required</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-700 to-green-600 bg-clip-text text-transparent mb-3 leading-tight">
            Simple, honest pricing
          </h1>
          <p className="text-base text-gray-600 max-w-xl mx-auto">
            OFFO is free to start. Pay only when you want the full picture — one-time, no subscription.
          </p>
        </div>

        {/* Tier grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isPrimary = tier.ctaStyle === "primary";
            const isOrange = tier.ctaStyle === "orange";

            return (
              <div
                key={tier.id}
                className={`relative bg-white rounded-2xl border p-6 flex flex-col ${
                  isPrimary
                    ? "border-blue-500 shadow-xl ring-1 ring-blue-200"
                    : isOrange
                    ? "border-orange-200 shadow-lg"
                    : "border-gray-200 shadow-sm"
                }`}
              >
                {tier.badge && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                      tier.badgeColor === "blue"
                        ? "bg-blue-600 text-white"
                        : "bg-orange-500 text-white"
                    }`}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${
                  isPrimary ? "bg-blue-100" : isOrange ? "bg-orange-100" : "bg-gray-100"
                }`}>
                  <Icon className={`w-5 h-5 ${isPrimary ? "text-blue-600" : isOrange ? "text-orange-600" : "text-gray-600"}`} />
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{tier.label}</p>
                <p className={`text-3xl font-bold mb-1 ${isPrimary ? "text-blue-700" : isOrange ? "text-orange-600" : "text-gray-900"}`}>
                  {tier.price ?? "Free"}
                </p>
                <p className="text-sm text-gray-500 mb-5">{tier.description}</p>

                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isPrimary ? "text-blue-500" : isOrange ? "text-orange-500" : "text-green-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.ctaHref}
                  className={`w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isPrimary
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : isOrange
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Pricing FAQ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: "Is the free analysis really free?",
                a: "Yes. No account, no credit card. Paste any listing URL and get a verdict, top risks, and 3 seller questions instantly.",
              },
              {
                q: "What is a receipt credit?",
                a: "One credit = one full analysis (Buyer Pass level). The Buyer Pass comes with 10 credits. Credits don't expire.",
              },
              {
                q: "Do I need a subscription?",
                a: "No. All products are one-time purchases. Pay once for the analysis you need — nothing recurring.",
              },
              {
                q: "What's the difference between Buyer Pass and the Auction Audit?",
                a: "Buyer Pass is for standard used car listings (CarGurus, etc.) — it unlocks full risk breakdown and negotiation tools. Auction Audit is specifically for Copart/IAAI salvage lots — it adds arbitrage scoring, battery pack exposure, and repair cost estimates.",
              },
              {
                q: "Can I get a refund?",
                a: "If you're not satisfied with the analysis quality, email hello@offo.app within 48 hours and we'll refund you.",
              },
              {
                q: "Do prices include tax?",
                a: "Prices shown are in USD excluding applicable sales tax. Stripe calculates and collects tax at checkout where required.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <p className="text-sm font-semibold text-gray-900 mb-1">{q}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 mb-3">Still not sure? Start free — no account needed.</p>
          <Link
            href="/receipt"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
          >
            Analyze a listing for free →
          </Link>
        </div>
      </div>
    </div>
  );
}
