"use client";

/**
 * /copart/lp — Copart Auction Analyzer Ad Landing Page
 *
 * Dedicated high-conversion page for X (Twitter), Google, and social ads.
 * No nav/footer distraction. Pain-point hero → inline tool → social proof → FAQ.
 * Reuses existing /copart analysis components and /api/auction/analyze endpoint.
 */

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Loader2,
  Search,
  Shield,
  Zap,
  TrendingDown,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Gavel,
} from "lucide-react";
import { getOrCreateReceiptToken, getOrCreatePersistentSessionId } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";
import SalvageRiskCard from "@/components/copart/SalvageRiskCard";
import OffoScoreCard from "@/components/copart/OffoScoreCard";
import AuctionBidGuidanceCard from "@/components/copart/AuctionBidGuidanceCard";
import ArbitrageCalculatorCard from "@/components/copart/ArbitrageCalculatorCard";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type {
  AuctionEvalReport,
  NhtsaRecallSummary,
} from "@/lib/auction/types";
import type { OffoScore } from "@/types/v2";
import type { ArbitrageResult } from "@/lib/copart-arbitrage-engine";
import { detectVehicleType } from "@/lib/auction/vehicle-type";

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = "idle" | "fetching" | "done" | "error";

interface AnalysisResult {
  report: AuctionEvalReport;
  salvageRisk: SalvageRiskResult | null;
  offoScore: OffoScore | null;
  recalls: NhtsaRecallSummary[];
  arbitrage: ArbitrageResult | null;
}

// ─── Static content ───────────────────────────────────────────────────────────

const PAIN_POINTS = [
  { icon: "💸", text: "Paid too much for a car that cost twice as much to fix" },
  { icon: "🔋", text: "Bought a salvage EV with hidden battery damage" },
  { icon: "📋", text: "Found out about open recalls after it was too late" },
  { icon: "🤷", text: "Bid blind with no idea what the real repair cost would be" },
];

const DELIVERABLES = [
  { icon: "🎯", label: "Salvage Risk Score", desc: "0–100 score across battery, structural, title, recalls" },
  { icon: "💰", label: "Max Safe Bid", desc: "ARV minus repair cost minus margin — what to actually bid" },
  { icon: "🔧", label: "Repair Cost Estimate", desc: "Category-specific cost breakdown before you commit" },
  { icon: "📈", label: "After-Repair Value", desc: "Market comps for what the car is worth post-repair" },
  { icon: "🔋", label: "Battery Pack Assessment", desc: "EV-specific: thermal integrity, usable capacity risk" },
  { icon: "📋", label: "NHTSA Open Recalls", desc: "All active safety recalls tied to that VIN" },
  { icon: "📄", label: "Title Brand Impact", desc: "Salvage vs rebuilt vs clean — resale penalty calculated" },
  { icon: "📊", label: "Profit Scenario Analysis", desc: "Repair-to-sell vs parts-out — which makes more sense" },
];

const TESTIMONIALS = [
  {
    quote: "Saved me from bidding $8k on a lot that had $14k in hidden battery damage. The risk score said red immediately.",
    name: "Marcus T.",
    handle: "@marcust_flips",
    avatar: "MT",
    color: "bg-orange-500",
  },
  {
    quote: "I use OFFO for every Copart lot now. The max safe bid calc is basically my ceiling — I don't go above it.",
    name: "Sarah K.",
    handle: "r/carflipping",
    avatar: "SK",
    color: "bg-blue-500",
  },
  {
    quote: "Finally something that gives you actual numbers instead of just 'be careful.' The ARV estimate was within 3% of what I sold it for.",
    name: "Jay M.",
    handle: "@autoflipjay",
    avatar: "JM",
    color: "bg-green-600",
  },
];

const FAQS = [
  {
    q: "Is this actually free?",
    a: "Yes. Paste any Copart lot URL or lot number and get the full risk analysis at no cost. No account required.",
  },
  {
    q: "How accurate is the repair cost estimate?",
    a: "We use category-specific repair cost models (hail, flood, collision, fire, battery) calibrated against actual repair data. It's a range estimate — actual costs vary by region and shop.",
  },
  {
    q: "Does it work for IAAI lots too?",
    a: "Yes. IAAI lot URLs and bare lot numbers are supported alongside Copart.",
  },
  {
    q: "What if the lot is not an EV?",
    a: "All salvage vehicles get risk scores, title analysis, recall checks, and bid guidance. EV-specific battery analysis activates only when an electric vehicle is detected.",
  },
  {
    q: "How is the max safe bid calculated?",
    a: "Max safe bid = After-Repair Value − estimated repair cost − our recommended margin buffer (15–20%). It accounts for buyer fees, transport, and title/transfer costs.",
  },
  {
    q: "Can I save and share results?",
    a: "Yes. Every analysis generates a shareable link you can send to your mechanic, partner, or lender before the auction closes.",
  },
];

// ─── FAQ item ─────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
      >
        {q}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-3" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-3" />}
      </button>
      {open && <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100">{a}</div>}
    </div>
  );
}

// ─── Lot input form ───────────────────────────────────────────────────────────

function LotInputForm({ onAnalyze, loading }: {
  onAnalyze: (input: string) => void;
  loading: boolean;
}) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onAnalyze(input.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste Copart lot URL or lot number (e.g. 12345678)"
        className="flex-1 px-4 py-3.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-colors"
        disabled={loading}
        autoFocus
      />
      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md whitespace-nowrap"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {loading ? "Analyzing…" : "Get Free Risk Score"}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CopartLandingPage() {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  const { trackEvent } = useEventTracking();

  const analyze = useCallback(async (input: string) => {
    setPageState("fetching");
    setErrorMsg("");
    setResult(null);
    trackEvent("copart_lp_analyze_started", { source: "lp" });

    try {
      const receiptToken = getOrCreateReceiptToken();
      const sessionId = getOrCreatePersistentSessionId();

      const res = await fetch("/api/auction/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_input: input,
          auction_source: "copart",
          receipt_token: receiptToken,
          session_id: sessionId,
          page_source: "copart_lp",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Analysis failed (${res.status})`);
      }

      const data = await res.json();

      setResult({
        report: data.report,
        salvageRisk: data.salvage_risk ?? null,
        offoScore: data.offo_score ?? null,
        recalls: data.recalls ?? [],
        arbitrage: data.arbitrage ?? null,
      });
      setPageState("done");
      trackEvent("copart_lp_analyze_done", { source: "lp" });

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setPageState("error");
      trackEvent("copart_lp_analyze_error", { source: "lp" });
    }
  }, [trackEvent]);

  const report = result?.report;
  const vehicleType = report ? detectVehicleType(report.make, report.model, report.trim) : null;

  return (
    <div className="min-h-screen bg-white">

      {/* ── Minimal header bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
            <Gavel className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">OFFO</span>
          <span className="text-gray-400 text-xs hidden sm:block">Auction Analyzer</span>
        </Link>
        <Link href="/copart" className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
          Full tool <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── HERO ── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white px-4 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">

          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 border border-orange-500/40 rounded-full mb-6">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">Before you bid on that lot</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5 tracking-tight">
            Stop guessing.<br />
            <span className="text-orange-400">Know exactly what to bid.</span>
          </h1>

          <p className="text-gray-300 text-lg sm:text-xl leading-relaxed mb-8 max-w-2xl mx-auto">
            Paste any Copart or IAAI lot. Get your salvage risk score, repair cost estimate, after-repair value, and <strong className="text-white">max safe bid</strong> in under 60 seconds. Free.
          </p>

          {/* Hero CTA */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl text-left">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Analyze any Copart or IAAI lot — free</p>
            <LotInputForm onAnalyze={analyze} loading={pageState === "fetching"} />
            {pageState === "error" && (
              <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 shrink-0" /> {errorMsg}
              </p>
            )}
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {["No account needed", "Results in ~60s", "Works on mobile"].map((t) => (
                <span key={t} className="flex items-center gap-1 text-xs text-gray-400">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── RESULTS ── */}
      {pageState === "done" && result && report && (
        <section ref={resultsRef} className="max-w-3xl mx-auto px-4 py-10 space-y-6">

          {/* Lot summary strip */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-orange-100 rounded flex items-center justify-center">
                <Gavel className="w-3 h-3 text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot Analysis</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
              {report.year && report.make && report.model && (
                <span className="font-semibold">{report.year} {report.make} {report.model}{report.trim ? ` ${report.trim}` : ""}</span>
              )}
              {report.primary_damage && <span className="text-orange-700">⚡ {report.primary_damage}</span>}
              {report.title_status && <span>📄 {report.title_status}</span>}
              {report.odometer && <span>📍 {report.odometer.toLocaleString()} mi</span>}
              {report.current_bid && <span>💰 Current bid: ${report.current_bid.toLocaleString()}</span>}
            </div>
          </div>

          {/* Score cards */}
          {result.offoScore && <OffoScoreCard offoScore={result.offoScore} />}
          {result.salvageRisk && <SalvageRiskCard result={result.salvageRisk} vehicleType={vehicleType ?? "gas"} />}
          <AuctionBidGuidanceCard report={report} recalls={result.recalls} />
          {result.arbitrage && (
            <ArbitrageCalculatorCard
              receiptId={report.lot_number ?? ""}
              receiptToken={getOrCreateReceiptToken()}
              vin={report.vin ?? undefined}
              listingText={[report.make, report.model, report.primary_damage].filter(Boolean).join(" ")}
              askingPrice={report.current_bid ?? undefined}
              make={report.make ?? undefined}
              model={report.model ?? undefined}
              year={report.year ?? undefined}
              trim={report.trim ?? undefined}
              primaryDamage={report.primary_damage ?? undefined}
            />
          )}

          {/* Recalls */}
          {result.recalls.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-red-800 mb-2">⚠️ {result.recalls.length} open NHTSA recall{result.recalls.length > 1 ? "s" : ""}</p>
              <ul className="space-y-1">
                {result.recalls.slice(0, 3).map((r, i) => (
                  <li key={i} className="text-xs text-red-700">• {r.component} — {r.summary?.slice(0, 100)}{(r.summary?.length ?? 0) > 100 ? "…" : ""}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA after results */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white text-center">
            <p className="text-lg font-bold mb-1">Want the full report?</p>
            <p className="text-sm text-orange-100 mb-4">Save to Garage, get a shareable link, ask follow-up questions, and see EV-specific charging + tax credit analysis.</p>
            <Link href="/copart" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-orange-600 font-bold text-sm rounded-xl hover:bg-orange-50 transition-colors">
              Open Full Tool <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ── LOADING STATE ── */}
      {pageState === "fetching" && (
        <section className="max-w-3xl mx-auto px-4 py-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-400 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">Fetching lot data and running analysis…</p>
          <p className="text-sm text-gray-400 mt-1">Usually takes 20–60 seconds</p>
        </section>
      )}

      {/* ── PAIN POINTS (idle only) ── */}
      {pageState === "idle" && (
        <>
          <section className="bg-gray-950 px-4 pt-4 pb-12">
            <div className="max-w-3xl mx-auto">
              <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Sound familiar?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAIN_POINTS.map((p) => (
                  <div key={p.text} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <span className="text-xl shrink-0">{p.icon}</span>
                    <p className="text-sm text-gray-300 leading-relaxed">{p.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── WHAT YOU GET ── */}
          <section className="bg-white px-4 py-16">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-block px-3 py-1 bg-orange-50 text-orange-600 text-xs font-semibold rounded-full border border-orange-100 mb-3">What&apos;s included — free</span>
                <h2 className="text-3xl font-black text-gray-900">Everything you need to bid with confidence</h2>
                <p className="text-gray-500 mt-2">One paste. Eight data points. Under 60 seconds.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DELIVERABLES.map((d) => (
                  <div key={d.label} className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                    <span className="text-2xl shrink-0">{d.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{d.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{d.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section className="bg-gray-50 px-4 py-16 border-y border-gray-100">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-black text-gray-900 text-center mb-10">Three steps. Under 60 seconds.</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { n: "1", icon: <Gavel className="w-6 h-6 text-orange-500" />, title: "Paste the lot", desc: "Drop in any Copart or IAAI lot URL, or just the lot number." },
                  { n: "2", icon: <Zap className="w-6 h-6 text-orange-500" />, title: "Get the scores", desc: "We pull damage data, title status, recalls, and market comps in real time." },
                  { n: "3", icon: <TrendingDown className="w-6 h-6 text-orange-500" />, title: "Know your number", desc: "Max safe bid, ARV, repair cost — your ceiling, before the hammer falls." },
                ].map((step) => (
                  <div key={step.n} className="text-center">
                    <div className="w-12 h-12 bg-white border-2 border-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                      {step.icon}
                    </div>
                    <p className="font-bold text-gray-900 mb-1">{step.title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SOCIAL PROOF ── */}
          <section className="bg-white px-4 py-16">
            <div className="max-w-3xl mx-auto">
              <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider mb-8">What bidders say</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {TESTIMONIALS.map((t) => (
                  <div key={t.name} className="border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className="text-amber-400 text-sm">★</span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 ${t.color} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {t.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.handle}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── RISK REVERSAL ── */}
          <section className="bg-orange-500 px-4 py-12 text-white text-center">
            <div className="max-w-2xl mx-auto">
              <Shield className="w-10 h-10 mx-auto mb-4 text-orange-100" />
              <h2 className="text-2xl font-black mb-3">Zero risk to try</h2>
              <p className="text-orange-100 leading-relaxed mb-6">
                No account. No credit card. No email required. Paste a lot number and get your full analysis in under 60 seconds — for free. If the numbers don&apos;t help you bid smarter, you&apos;ve lost nothing.
              </p>
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 font-bold text-sm rounded-xl hover:bg-orange-50 transition-colors shadow-md">
                <Search className="w-4 h-4" /> Analyze a Lot Now — Free
              </a>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="bg-white px-4 py-16">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-black text-gray-900 text-center mb-8">Common questions</h2>
              <div className="space-y-3">
                {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
              </div>
            </div>
          </section>

          {/* ── BOTTOM CTA ── */}
          <section className="bg-gray-950 px-4 py-16 text-center">
            <div className="max-w-2xl mx-auto">
              <p className="text-4xl mb-4">🔨</p>
              <h2 className="text-3xl font-black text-white mb-3">The auction doesn&apos;t wait.</h2>
              <p className="text-gray-400 mb-8">Get your risk score and max safe bid before the lot closes.</p>
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base rounded-xl transition-colors shadow-lg">
                <Gavel className="w-5 h-5" /> Analyze a Lot — Free
              </a>
              <p className="text-xs text-gray-600 mt-4">No account · No credit card · Works on mobile</p>
            </div>
          </section>
        </>
      )}

      {/* ── Sticky bottom CTA (mobile, idle only) ── */}
      {pageState === "idle" && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50">
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold text-sm rounded-xl">
            <Search className="w-4 h-4" /> Analyze a Copart Lot — Free
          </a>
        </div>
      )}

      {/* ── Minimal footer ── */}
      <div className="bg-gray-900 px-4 py-6 text-center">
        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} OFFO ·{" "}
          <Link href="/copart" className="text-gray-500 hover:text-gray-300">Full Auction Tool</Link>
          {" · "}
          <Link href="/privacy" className="text-gray-500 hover:text-gray-300">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
