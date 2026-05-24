"use client";

/**
 * Cold email landing page — /for-dealers/cold
 *
 * Stripped-down variant optimized for cold email clicks.
 * No global header/footer, single CTA, minimal escape paths.
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

const FEATURES = [
  "Buyer intent dashboard — see who's researching your inventory",
  "Live pricing intelligence — low / target / high per vehicle",
  "OFFO-verified badge — embed on your website in 30 seconds",
  "Direct buyer inquiry inbox — leads come to you",
  "CSV bulk import — 500 vehicles in under 5 minutes",
  "Public dealer profile — hosted by OFFO, no website needed",
];

const FAQS = [
  {
    q: "Who sees my inventory?",
    a: "OFFO buyers who are actively researching your makes and models. When a buyer runs a battery report or VIN check on a vehicle you stock, your dealership appears as a matched source.",
  },
  {
    q: "How do I add my inventory?",
    a: "Scan a VIN (auto-fills make/model/year/trim), add manually, or bulk-import up to 500 vehicles via CSV. Most dealers are live within an hour.",
  },
  {
    q: "Is buyer data GDPR/CCPA compliant?",
    a: "Yes. All buyer profiles are fully anonymized — you see intent signals and fit scores, not personal data.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, anytime from your dashboard. No cancellation fees. You keep access through the end of your billing period.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.08] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-white/80">{q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
        )}
      </button>
      {open && (
        <p className="text-sm text-white/50 leading-relaxed pb-4 -mt-1">{a}</p>
      )}
    </div>
  );
}

export default function DealerColdPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Minimal header — logo only */}
      <header className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/">
          <Image src="/offo-logo.png" alt="OFFO" width={100} height={40} className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00d97e]/50" />
          Verified dealer network
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-full text-[#00d97e] text-xs font-semibold mb-6">
            OFFO Dealer Network
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-5 leading-tight">
            See which buyers are researching
            <br />
            <span className="text-[#00d97e]">your inventory right now.</span>
          </h1>
          <p className="text-base text-white/50 leading-relaxed mb-8 max-w-lg mx-auto">
            OFFO gives EV dealerships anonymized buyer demand data, live pricing intelligence,
            and a verified profile — so you spend less time guessing and more time closing.
          </p>
          <Link
            href="/dealers/join"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#00d97e] text-[#0d1117] font-bold rounded-xl hover:bg-[#00f090] transition-colors text-sm"
          >
            Claim your dealer profile
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-white/25 mt-3">Free to apply · No credit card required · 1-day approval</p>
        </div>

        {/* What you get */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-7 mb-8">
          <div className="flex items-end gap-2 mb-1">
            <span className="text-3xl font-bold text-white">$79</span>
            <span className="text-white/40 text-sm mb-1">/ month per dealership</span>
          </div>
          <p className="text-xs text-white/30 mb-6">Cancel anytime</p>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                <Check className="w-4 h-4 text-[#00d97e] flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA repeat */}
        <Link
          href="/dealers/join"
          className="flex items-center justify-center gap-2 w-full py-4 bg-[#00d97e] text-[#0d1117] font-bold rounded-xl hover:bg-[#00f090] transition-colors text-sm mb-12"
        >
          Claim your dealer profile
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-base font-semibold text-white/60 mb-4">Common questions</h2>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5">
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-[#00d97e]/[0.05] border border-[#00d97e]/15 rounded-2xl p-8">
          <h2 className="text-lg font-bold mb-2">Ready to see your matched buyers?</h2>
          <p className="text-sm text-white/45 mb-6 leading-relaxed">
            Apply in 2 minutes. Approved within 1 business day. Inventory live same day.
          </p>
          <Link
            href="/dealers/join"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#00d97e] text-[#0d1117] font-bold rounded-xl hover:bg-[#00f090] transition-colors text-sm"
          >
            Claim your dealer profile
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-white/[0.06] px-6 py-6 mt-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/">
            <Image src="/offo-logo.png" alt="OFFO" width={80} height={32} className="h-5 w-auto opacity-40 hover:opacity-70 transition-opacity" />
          </Link>
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} OFFO · <Link href="/" className="hover:text-white/50 transition-colors">offolab.com</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
