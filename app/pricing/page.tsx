import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, Zap, FileText, MessageSquare, Car, ArrowLeft } from "lucide-react";
import Header from "@/components/landing/Header";

export const metadata: Metadata = {
  title: "Pricing — OFFO",
  description:
    "Full AI-powered EV deal analysis for $3.99. No subscription. Instant risk verdict, deal quality score, battery assessment, and negotiation insights.",
  alternates: { canonical: "https://offolab.com/pricing" },
  openGraph: {
    title: "OFFO Pricing — $3.99 per analysis. No subscription.",
    description:
      "Full EV deal analysis for $3.99. Risk verdict, deal quality score, battery assessment, negotiation insights. Auction Audit $49.",
    url: "https://offolab.com/pricing",
    type: "website",
    siteName: "OFFO",
  },
};

const TIERS = [
  {
    id: "receipt_single",
    icon: Sparkles,
    label: "Receipt Analysis",
    price: "$3.99",
    badge: "Per listing",
    badgeColor: "blue",
    cta: "Analyze a listing",
    ctaHref: "/receipt",
    ctaStyle: "primary",
    description: "Full AI-powered EV deal analysis for any listing. One-time, no subscription.",
    features: [
      "Risk verdict — GREEN / YELLOW / RED",
      "Deal quality score & price vs. market",
      "Battery health assessment",
      "Open safety recall check",
      "Negotiation insights & seller questions",
      "Pre-purchase inspection checklist",
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
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="homepage" />

      <div className="max-w-5xl mx-auto px-4 py-14">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to OFFO
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-[#00d97e]/10 rounded-full border border-[#00d97e]/20">
            <Sparkles className="w-3.5 h-3.5 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wider">No subscription · Pay per listing</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            $3.99 per analysis
          </h1>
          <p className="text-base text-white/40 max-w-xl mx-auto">
            Full AI-powered EV deal analysis for every listing. One-time payment — no account, no subscription.
          </p>
        </div>

        {/* Always free callout */}
        <div className="mb-8 rounded-2xl border border-[#00d97e]/20 bg-[#00d97e]/[0.04] px-6 py-5">
          <p className="text-xs font-bold text-[#00d97e] uppercase tracking-wider mb-3">Always free — no account required</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {[
              "Risk verdict (GREEN / YELLOW / RED)",
              "Battery health flags",
              "Open NHTSA recall check",
              "EV Routine Fit check — personalized vehicle match",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-white/70">
                <Check className="w-4 h-4 text-[#00d97e] shrink-0" />
                {f}
              </div>
            ))}
          </div>
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
                className={`relative bg-[#161b22] rounded-2xl border p-6 flex flex-col ${
                  isPrimary
                    ? "border-[#00d97e]/40 ring-1 ring-[#00d97e]/20"
                    : isOrange
                    ? "border-orange-500/30"
                    : "border-white/[0.08]"
                }`}
              >
                {tier.badge && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                      tier.badgeColor === "blue"
                        ? "bg-[#00d97e] text-[#0d1117]"
                        : "bg-orange-500 text-white"
                    }`}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${
                  isPrimary ? "bg-[#00d97e]/15" : isOrange ? "bg-orange-500/15" : "bg-white/[0.06]"
                }`}>
                  <Icon className={`w-5 h-5 ${isPrimary ? "text-[#00d97e]" : isOrange ? "text-orange-400" : "text-white/40"}`} />
                </div>

                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1">{tier.label}</p>
                <p className={`text-3xl font-bold mb-1 ${isPrimary ? "text-[#00d97e]" : isOrange ? "text-orange-400" : "text-white"}`}>
                  {tier.price ?? "Free"}
                </p>
                <p className="text-sm text-white/40 mb-5">{tier.description}</p>

                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isPrimary ? "text-[#00d97e]" : isOrange ? "text-orange-400" : "text-[#00d97e]"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.ctaHref}
                  className={`w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isPrimary
                      ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00c970]"
                      : isOrange
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : "bg-white/[0.06] text-white/60 hover:bg-white/[0.10] border border-white/[0.08]"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-8">
          <h2 className="text-xl font-bold text-white mb-6">Pricing FAQ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: "What do I get for $3.99?",
                a: "A full AI-powered analysis of one listing: risk verdict (GREEN/YELLOW/RED), deal quality score, price vs. market comparison, battery health assessment, open recall check, negotiation insights, and a pre-purchase inspection checklist.",
              },
              {
                q: "Do I need an account or subscription?",
                a: "No. Paste a listing URL, pay $3.99, and get your analysis instantly. One-time payment — nothing recurring.",
              },
              {
                q: "What if the analysis fails or I'm not satisfied?",
                a: "If generation fails, your payment is automatically voided — you won't be charged. If you're unsatisfied with quality, email support@offolab.com within 48 hours for a full refund.",
              },
              {
                q: "What's the Auction Audit?",
                a: "A separate $49 product for Copart/IAAI salvage lots. It adds arbitrage scoring, damage classification, battery pack exposure, and repair cost estimates — specific to auction buying.",
              },
              {
                q: "What listing sites are supported?",
                a: "CarGurus, AutoTrader, Cars.com, Carvana, CarMax, Facebook Marketplace, Vroom, Edmunds, KBB, and more. Or paste listing text directly.",
              },
              {
                q: "Do prices include tax?",
                a: "Prices shown are in USD excluding applicable sales tax. Stripe calculates and collects tax at checkout where required.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <p className="text-sm font-semibold text-white/80 mb-1">{q}</p>
                <p className="text-sm text-white/40 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-sm text-white/30 mb-3">Paste any CarGurus, AutoTrader, or Carvana listing — results in under 30 seconds.</p>
          <Link
            href="/receipt"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-xl hover:bg-[#00c970] transition-colors"
          >
            Analyze a listing — $3.99 →
          </Link>
        </div>
      </div>
    </div>
  );
}
