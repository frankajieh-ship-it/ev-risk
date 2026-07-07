"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck, Car, Clock, ChevronDown, ChevronUp, Check, ArrowRight,
  BarChart2, Users, TrendingUp, Zap,
} from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useEventTracking } from "@/hooks/useEventTracking";

const PAIN_POINTS = [
  {
    problem: "You don't know who's researching your cars",
    solution: "OFFO shows you real buyer intent — scored by fit, matched to your actual inventory, by VIN and model.",
    icon: Users,
  },
  {
    problem: "Book values are 60–90 days stale",
    solution: "Our pricing engine pulls live comparable listings daily so your ask price is always market-accurate.",
    icon: TrendingUp,
  },
  {
    problem: "Your website traffic is anonymous",
    solution: "OFFO buyers have already run battery reports, VIN checks, and EV fit scores — they arrive pre-qualified.",
    icon: Zap,
  },
];

const FEATURES = [
  {
    title: "Buyer intelligence dashboard",
    body: "See anonymized, high-intent buyers actively researching vehicles in your inventory. Filter by make, model, fit score, and metro area. Know who to expect before they call.",
    icon: Users,
  },
  {
    title: "Real-time pricing intelligence",
    body: "Get suggested low, target, and high prices for every vehicle — computed from live comparable listings, not stale book values. Know when to hold and when to drop.",
    icon: BarChart2,
  },
  {
    title: "OFFO-verified badge",
    body: "Your inventory displays a verified dealer badge to every buyer running a risk check on OFFO. Build trust before first contact — embed it on your website in 30 seconds.",
    icon: ShieldCheck,
  },
  {
    title: "Direct buyer inquiry inbox",
    body: "Buyers contact you directly through your OFFO profile. Every inquiry includes the vehicle of interest, the buyer's research history, and their fit score.",
    icon: Car,
  },
];

const STEPS = [
  {
    number: "01",
    title: "Apply — 2 minutes",
    body: "Submit your dealership details. We review for EV focus — mixed dealerships qualify.",
  },
  {
    number: "02",
    title: "Get approved — 1 business day",
    body: "You'll get an email confirmation once approved. No credit card required to apply.",
  },
  {
    number: "03",
    title: "Upload your inventory",
    body: "Scan VINs one by one, add manually, or bulk-import up to 500 vehicles via CSV in under 5 minutes.",
  },
  {
    number: "04",
    title: "Start selling smarter",
    body: "Within 24h of uploading, you'll see which buyers on OFFO are matched to your lot — ranked by intent and fit score.",
  },
];

const FAQS = [
  {
    q: "Who sees my inventory?",
    a: "OFFO buyers who are actively researching your makes and models. When a buyer runs a report or battery check on a vehicle you stock, your dealership appears as a matched source.",
  },
  {
    q: "Is buyer data GDPR/CCPA compliant?",
    a: "Yes. All buyer profiles shown in your dashboard are fully anonymized — no names, emails, or phone numbers. You see intent signals and fit scores, not personal data.",
  },
  {
    q: "How do I add my inventory?",
    a: "Three ways: scan a VIN (auto-fills make/model/year/trim via NHTSA), add manually with a form, or bulk-import up to 500 vehicles with a CSV upload. Most dealers are live within an hour.",
  },
  {
    q: "Do I need a website to join?",
    a: "No. OFFO hosts a public dealer profile page for your dealership with your inventory, contact info, and verified badge. You get a shareable URL you can use anywhere.",
  },
  {
    q: "What if my dealership sells both EVs and ICE vehicles?",
    a: "Mixed dealerships qualify as long as you stock EVs. OFFO only surfaces your EV inventory to buyers — ICE vehicles are not shown in buyer reports.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, anytime from your dashboard settings. You keep access through the end of your billing period. No cancellation fees.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.08] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-medium text-white/80">{q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
        )}
      </button>
      {open && (
        <p className="text-sm text-white/50 leading-relaxed pb-5 -mt-1">{a}</p>
      )}
    </div>
  );
}

export default function ForDealersPage() {
  const { trackEvent } = useEventTracking();

  useEffect(() => {
    trackEvent("for_dealers_page_viewed", {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <Header variant="homepage" />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-full text-[#00d97e] text-xs font-semibold mb-6">
          OFFO for Dealers
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5 leading-tight">
          The EV buyer intelligence
          <br />
          <span className="text-[#00d97e]">platform for dealerships.</span>
        </h1>
        <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
          OFFO shows you which buyers are researching your inventory right now —
          anonymized, scored, and matched to your lot.
          Stop cold-calling. Start with intent.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link
            href="/dealers/join"
            onClick={() => trackEvent("dealer_apply_cta_clicked", { position: "hero" })}
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#00d97e] text-[#0d1117] font-semibold rounded-xl hover:bg-[#00f090] transition-colors text-sm"
          >
            Join the dealer network
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#dashboard"
            className="px-7 py-3.5 bg-white/[0.06] border border-white/[0.10] text-white/70 font-semibold rounded-xl hover:bg-white/[0.10] transition-colors text-sm"
          >
            See how it works
          </a>
        </div>
        {/* Social proof bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/35">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00d97e]/60" />
            Verified dealer network
          </span>
          <span className="text-white/15">·</span>
          <span className="flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-[#00d97e]/60" />
            EV-specialist dealers
          </span>
          <span className="text-white/15">·</span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#00d97e]/60" />
            1-day approval
          </span>
        </div>
      </section>

      {/* ── Pain points ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest text-center mb-8">
          Why dealers join OFFO
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {PAIN_POINTS.map((item) => (
            <div
              key={item.problem}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6"
            >
              <item.icon className="w-5 h-5 text-[#00d97e]/70 mb-4" />
              <p className="text-sm font-semibold text-white/90 mb-2 leading-snug">
                &ldquo;{item.problem}&rdquo;
              </p>
              <p className="text-sm text-white/45 leading-relaxed">{item.solution}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">Everything in one platform</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 flex gap-4"
            >
              <div className="w-9 h-9 rounded-xl bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <f.icon className="w-4 h-4 text-[#00d97e]" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-[0.9375rem] mb-1.5 leading-snug">
                  {f.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dashboard preview ────────────────────────────────────────── */}
      <section id="dashboard" className="max-w-5xl mx-auto px-4 pb-20">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            <span className="text-xs text-white/25 ml-2 font-mono">dashboard.offolab.com/dealer</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "High-intent buyers this week", value: "24", sub: "researching your inventory", up: true },
              { label: "Avg inventory match score", value: "71%", sub: "buyer–vehicle fit", up: true },
              { label: "Avg days on lot", value: "18", sub: "across active inventory", up: false },
              { label: "Funnel (30d)", value: "312 → 89 → 14", sub: "Views · Reports · Receipts", up: null },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4"
              >
                <p className="text-xs text-white/40 mb-2 leading-snug">{card.label}</p>
                <p className="text-lg font-bold text-white mb-1 tabular-nums">{card.value}</p>
                <p className="text-xs text-white/30">{card.sub}</p>
              </div>
            ))}
          </div>
          {/* Mock buyer rows */}
          <div className="space-y-2">
            <p className="text-xs text-white/25 uppercase tracking-widest mb-3">High-intent buyers matched to your lot</p>
            {[
              { id: "Buyer #A1F3", vehicle: "2022 Tesla Model 3", fit: 94, signal: "High", match: "92%" },
              { id: "Buyer #C8B7", vehicle: "2023 Chevy Bolt EV", fit: 87, signal: "High", match: "88%" },
              { id: "Buyer #F2D9", vehicle: "2022 Hyundai IONIQ 5", fit: 81, signal: "Medium", match: "79%" },
            ].map((row) => (
              <div key={row.id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-[#00d97e]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#00d97e]">{row.fit}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/70">{row.id}</p>
                  <p className="text-xs text-white/35 truncate">{row.vehicle}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  row.signal === "High"
                    ? "bg-[#00d97e]/10 text-[#00d97e]"
                    : "bg-white/[0.06] text-white/50"
                }`}>{row.signal}</span>
                <span className="text-xs text-white/40 w-10 text-right">{row.match}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/20 mt-5 text-center">
            Illustrative data — live metrics populate within 24h of uploading your inventory
          </p>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-3">Simple, transparent pricing</h2>
        <p className="text-sm text-white/40 text-center mb-6">14-day free trial · No credit card required · Cancel anytime</p>

        <div className="flex justify-center mb-8">
          <span className="text-xs bg-[#00d97e]/10 text-[#00d97e] border border-[#00d97e]/20 px-3 py-1.5 rounded-full font-medium">
            14-day free trial — no credit card required
          </span>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 items-start">

          {/* Starter */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Starter</p>
            <div className="flex items-end gap-1.5 mb-1">
              <span className="text-3xl font-bold text-white">$149</span>
              <span className="text-white/40 text-sm mb-1">/ mo</span>
            </div>
            <p className="text-xs text-white/30 mb-6">Up to 25 active listings</p>
            <ul className="space-y-2.5 mb-8">
              {[
                "Buyer intelligence dashboard (30d)",
                "Market position pricing",
                "Verified dealer badge",
                "Public dealer profile",
                "Buyer inquiry inbox",
                "CSV import",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/55">
                  <Check className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dealers/join"
              onClick={() => trackEvent("dealer_apply_cta_clicked", { position: "pricing_starter" })}
              className="flex items-center justify-center w-full py-2.5 border border-white/[0.12] text-white/60 rounded-xl text-sm font-semibold hover:bg-white/[0.05] hover:text-white/80 transition-colors"
            >
              Start free trial
            </Link>
            <a
              href="mailto:hello@offolab.com?subject=Demo Request — Starter Plan"
              className="block text-center text-xs text-white/30 hover:text-white/55 mt-2 transition-colors"
            >
              or Request a demo →
            </a>
          </div>

          {/* Growth — highlighted */}
          <div className="bg-white/[0.05] border border-[#00d97e]/30 rounded-2xl p-7 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-[#00d97e] text-[#0d1117] text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                Most popular
              </span>
            </div>
            <p className="text-xs font-semibold text-[#00d97e]/70 uppercase tracking-widest mb-3">Growth</p>
            <div className="flex items-end gap-1.5 mb-1">
              <span className="text-3xl font-bold text-white">$299</span>
              <span className="text-white/40 text-sm mb-1">/ mo</span>
            </div>
            <p className="text-xs text-white/30 mb-6">Up to 100 active listings</p>
            <ul className="space-y-2.5 mb-8">
              {[
                "Full buyer intelligence (90d)",
                "Buyer profiles + geo heatmap",
                "Pricing AI — range, explanation + sensitivity curve",
                "Priority placement in buyer reports",
                "CSV bulk import (500 vehicles)",
                "Inquiry response analytics",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                  <Check className="w-3.5 h-3.5 text-[#00d97e] flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dealers/join"
              onClick={() => trackEvent("dealer_apply_cta_clicked", { position: "pricing_growth" })}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00f090] transition-colors"
            >
              Start free trial
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="mailto:hello@offolab.com?subject=Demo Request — Growth Plan"
              className="block text-center text-xs text-white/40 hover:text-white/65 mt-2 transition-colors"
            >
              or Request a demo →
            </a>
          </div>

          {/* Pro */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Pro</p>
            <div className="flex items-end gap-1.5 mb-1">
              <span className="text-3xl font-bold text-white">$499</span>
              <span className="text-white/40 text-sm mb-1">/ mo</span>
            </div>
            <p className="text-xs text-white/30 mb-6">Unlimited listings</p>
            <ul className="space-y-2.5 mb-8">
              {[
                "Everything in Growth",
                "API access — sync from your DMS",
                "White-label badge with custom URL",
                "Dedicated onboarding call",
                "Early access to new features",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/55">
                  <Check className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dealers/join"
              onClick={() => trackEvent("dealer_apply_cta_clicked", { position: "pricing_pro" })}
              className="flex items-center justify-center w-full py-2.5 border border-white/[0.12] text-white/60 rounded-xl text-sm font-semibold hover:bg-white/[0.05] hover:text-white/80 transition-colors"
            >
              Start free trial
            </Link>
            <a
              href="mailto:hello@offolab.com?subject=Demo Request — Pro Plan"
              className="block text-center text-xs text-white/30 hover:text-white/55 mt-2 transition-colors"
            >
              or Request a demo →
            </a>
          </div>

        </div>

        {/* Annual upsell */}
        <p className="text-xs text-white/30 text-center mt-6">
          Annual plans available — pay for 10 months, get 12.
          <a href="mailto:hello@offolab.com" className="text-[#00d97e]/60 hover:text-[#00d97e] ml-1 transition-colors">Email us →</a>
        </p>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex flex-col gap-3 relative">
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-3 left-[calc(100%+8px)] w-[calc(100%-16px)] h-px bg-white/[0.06]" />
              )}
              <span className="text-[#00d97e] font-bold text-sm font-mono">{step.number}</span>
              <h3 className="font-semibold text-white text-[0.9375rem] leading-snug">{step.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-6">
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 pb-24 text-center">
        <div className="bg-[#00d97e]/[0.06] border border-[#00d97e]/20 rounded-2xl p-10">
          <h2 className="text-2xl font-bold mb-3">Ready to grow your EV business?</h2>
          <p className="text-white/50 text-sm mb-8 max-w-md mx-auto leading-relaxed">
            Join OFFO&apos;s dealer network. Free to apply — approved dealerships get
            full access to buyer intelligence, pricing, and a verified profile from day one.
          </p>
          <Link
            href="/dealers/join"
            onClick={() => trackEvent("dealer_apply_cta_clicked", { position: "bottom" })}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#00d97e] text-[#0d1117] font-semibold rounded-xl hover:bg-[#00f090] transition-colors text-sm"
          >
            Join the dealer network
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-white/25 mt-4">
            Reviewed within 1 business day · No credit card required to apply
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
