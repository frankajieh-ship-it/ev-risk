"use client";

/**
 * /copart/lp — Copart Auction Analyzer Ad Landing Page
 *
 * Dedicated high-conversion page for X (Twitter), Google, and social ads.
 * No nav/footer distraction. Pain-point hero → inline tool → social proof → FAQ.
 * Reuses existing /copart analysis components and /api/auction/analyze endpoint.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  TrendingUp,
  Wrench,
  TriangleAlert,
  Bookmark,
} from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import AuctionBidGuidanceCard from "@/components/copart/AuctionBidGuidanceCard";
import { computeSafeBidRange, computeMaxSafeBid } from "@/lib/copart-arbitrage-engine";
import { getOrCreateReceiptToken, getOrCreatePersistentSessionId } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { SalvageRiskResult } from "@/lib/salvage-risk-scorer";
import type { AuctionEvalReport, NhtsaRecallSummary } from "@/lib/auction/types";
import type { ArbitrageResult } from "@/lib/copart-arbitrage-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = "idle" | "fetching" | "done" | "error";

interface AnalysisResult {
  report: AuctionEvalReport;
  salvageRisk: SalvageRiskResult | null;
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
    a: "Max safe bid = After-Repair Value − estimated repair cost − your target margin − auction fees. Use the margin slider to see how your bid ceiling changes at different profit targets.",
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
    <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#161b22]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-white/80 hover:bg-white/[0.04] transition-colors"
      >
        {q}
        {open ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0 ml-3" /> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0 ml-3" />}
      </button>
      {open && <div className="px-5 pb-4 text-sm text-white/50 leading-relaxed border-t border-white/[0.06]">{a}</div>}
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
        className="flex-1 px-4 py-3.5 border-2 border-white/[0.10] rounded-xl text-sm text-white placeholder:text-white/30 bg-[#0d1117] focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-colors"
        disabled={loading}
        autoFocus
      />
      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md whitespace-nowrap"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {loading ? "Analyzing…" : "Get Max Safe Bid — Free"}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CopartLandingPage() {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [targetMargin, setTargetMargin] = useState(20);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { trackEvent } = useEventTracking();

  const isAuctionUrl = (s: string) => {
    try { const u = new URL(s); return u.hostname.endsWith("copart.com") || u.hostname.endsWith("iaai.com"); }
    catch { return false; }
  };

  const analyze = useCallback(async (input: string) => {
    setPageState("fetching");
    setErrorMsg("");
    setResult(null);
    setTargetMargin(20);
    trackEvent("copart_lp_analyze_started", { source: "lp" });

    try {
      const receiptToken = getOrCreateReceiptToken();
      const sessionId = getOrCreatePersistentSessionId();
      const isUrl = isAuctionUrl(input);

      const res = await fetch("/api/auction/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: isUrl ? input : undefined,
          lot_number: !isUrl ? input : undefined,
          auction_source: "copart",
          receipt_token: receiptToken,
          session_id: sessionId,
          page_source: "copart_lp",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.report) {
        throw new Error(data.error || data.message || `Analysis failed (${res.status})`);
      }

      const r = data.report;
      setResult({
        report: r,
        salvageRisk: (r.salvage_risk as SalvageRiskResult) ?? null,
        recalls: (r.recalls as NhtsaRecallSummary[]) ?? [],
        arbitrage: (r.arbitrage as ArbitrageResult | undefined) ?? null,
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
  const lot = report?.lot;
  const salvage = result?.salvageRisk;
  const arb = result?.arbitrage;

  // Compute live safe bid from arb data + slider margin
  const liveSafeBid = arb?.arv != null
    ? computeSafeBidRange(arb.arv, arb.repair_cost_low, arb.repair_cost_high, arb.auction_fees_estimate, targetMargin)
    : null;
  const liveMaxBid = arb?.arv != null
    ? computeMaxSafeBid(arb.arv, arb.repair_cost_estimate, arb.auction_fees_estimate, targetMargin)
    : null;

  // Photo: single stable key → no hooks-size-change error between renders
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const lotKey = lot
    ? `${lot.photos?.[0] ?? ""}|${lot.make ?? ""}|${lot.model ?? ""}|${lot.year ?? ""}|${lot.vin ?? ""}`
    : "";
  useEffect(() => {
    if (!lotKey) { setPhotoUrl(null); return; }
    const parts = lotKey.split("|");
    const lotPhoto = parts[0] || null;
    const make = parts[1] || null;
    const model = parts[2] || null;
    const year = parts[3] || null;
    const vin = parts[4] || null;

    if (lotPhoto) { setPhotoUrl(lotPhoto); return; }
    if (!make || !model) { setPhotoUrl(null); return; }

    const params = new URLSearchParams();
    params.set("make", make);
    params.set("model", model);
    if (year) params.set("year", year);
    if (vin) params.set("vin", vin);
    fetch(`/api/photos?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.photo_urls?.[0]) setPhotoUrl(d.photo_urls[0]); })
      .catch(() => {});
  }, [lotKey]);

  return (
    <div className="min-h-screen bg-[#0d1117]">

      <Header variant="receipt" />

      {/* ── HERO ── */}
      <section className="bg-gradient-to-b from-[#0d1117] to-[#0d1117] border-b border-white/[0.08] text-white px-4 py-14 sm:py-20">
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

          <p className="text-white/60 text-lg sm:text-xl leading-relaxed mb-8 max-w-2xl mx-auto">
            Paste any Copart or IAAI lot. Get your salvage risk score, repair cost estimate, after-repair value, and <strong className="text-white">max safe bid</strong> in under 60 seconds. Free.
          </p>

          {/* Hero CTA */}
          <div className="bg-[#161b22] border border-white/[0.10] rounded-2xl p-4 sm:p-6 text-left">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Analyze any Copart or IAAI lot — free</p>
            <LotInputForm onAnalyze={analyze} loading={pageState === "fetching"} />
            {pageState === "error" && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 shrink-0" /> {errorMsg}
              </p>
            )}
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {["No account needed", "Results in ~60s", "Works on mobile"].map((t) => (
                <span key={t} className="flex items-center gap-1 text-xs text-white/40">
                  <CheckCircle className="w-3.5 h-3.5 text-[#00d97e]" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>


      {pageState === "done" && result && report && lot && salvage && (
        <section ref={resultsRef} className="max-w-3xl mx-auto px-4 py-10 space-y-5">

          {/* Vehicle card with photo */}
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="relative h-52 bg-[#161b22]">
              {photoUrl ? (
                <Image
                  src={`/api/proxy-image?url=${encodeURIComponent(photoUrl)}`}
                  alt={`${lot.year ?? ""} ${lot.make ?? ""} ${lot.model ?? ""}`}
                  fill className="object-cover" unoptimized
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <Gavel className="w-10 h-10 text-white/10" />
                  <p className="text-xs text-white/25">Loading photo…</p>
                </div>
              )}
              <div className="absolute top-3 right-3">
                {salvage.grade === "green" && <span className="px-3 py-1.5 bg-[#00d97e] text-[#0d1117] text-xs font-bold rounded-full">LOW RISK</span>}
                {salvage.grade === "yellow" && <span className="px-3 py-1.5 bg-amber-500 text-[#0d1117] text-xs font-bold rounded-full">MODERATE RISK</span>}
                {salvage.grade === "red" && <span className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-full">HIGH RISK</span>}
              </div>
            </div>
            <div className="p-4 bg-[#161b22] border-t border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-white">{lot.year} {lot.make} {lot.model}{lot.trim ? ` ${lot.trim}` : ""}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-white/40">
                    {lot.primary_damage && <span className="text-orange-400 font-medium">{lot.primary_damage}</span>}
                    {lot.title_status && <span>{lot.title_status} title</span>}
                    {lot.odometer && <span>{lot.odometer.toLocaleString()} mi</span>}
                  </div>
                  {lot.current_bid && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/15 border border-orange-500/25 rounded-full">
                      <span className="text-xs font-bold text-orange-400">Current bid: ${lot.current_bid.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/30">Risk score</p>
                  <p className={`text-3xl font-black ${salvage.grade === "green" ? "text-[#00d97e]" : salvage.grade === "yellow" ? "text-amber-400" : "text-red-400"}`}>{salvage.score}</p>
                  <p className="text-xs text-white/30">/ 100</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save shortcut */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-white/30">Analyzing {lot.lot_number ? `lot #${lot.lot_number}` : "this lot"}</p>
            <Link href={`/copart${lot.lot_number ? `?lot=${lot.lot_number}` : ""}`} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
              <Bookmark className="w-3.5 h-3.5" /> Save to Garage →
            </Link>
          </div>

          {/* Key numbers grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-3 text-center">
              <Gavel className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <p className="text-xs text-white/40 font-medium">Bid discount</p>
              <p className="text-xl font-black text-white">{salvage.suggested_bid_discount}%</p>
              <p className="text-xs text-white/30">off KBB clean value</p>
            </div>
            {arb?.arv != null && (
              <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-3 text-center">
                <TrendingUp className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-xs text-white/40 font-medium">After-repair value</p>
                <p className="text-xl font-black text-white">${arb.arv.toLocaleString()}</p>
                <p className="text-xs text-white/30">{arb.arv_source === "none" ? "estimated" : "market data"}</p>
              </div>
            )}
            {arb?.repair_cost_estimate != null && (
              <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-3 text-center">
                <Wrench className="w-4 h-4 text-white/40 mx-auto mb-1" />
                <p className="text-xs text-white/40 font-medium">Est. repair cost</p>
                <p className="text-xl font-black text-white">
                  {arb.repair_cost_estimate >= 1000 ? `$${(arb.repair_cost_estimate / 1000).toFixed(1)}k` : `$${arb.repair_cost_estimate.toLocaleString()}`}
                </p>
                <p className="text-xs text-white/30">${(arb.repair_cost_low / 1000).toFixed(1)}k–${(arb.repair_cost_high / 1000).toFixed(1)}k range</p>
                {lot.primary_damage && <p className="text-xs text-orange-400 mt-0.5 font-medium truncate">{lot.primary_damage}</p>}
              </div>
            )}
            {liveSafeBid != null && liveMaxBid != null ? (
              <div className={`border rounded-xl p-3 text-center ${liveMaxBid >= 0 ? "bg-[#00d97e]/10 border-[#00d97e]/20" : "bg-red-500/10 border-red-500/20"}`}>
                <TrendingDown className={`w-4 h-4 mx-auto mb-1 ${liveMaxBid >= 0 ? "text-[#00d97e]" : "text-red-400"}`} />
                <p className="text-xs text-white/40 font-medium">Max safe bid</p>
                <p className={`text-xl font-black ${liveMaxBid >= 0 ? "text-[#00d97e]" : "text-red-400"}`}>${Math.max(0, liveMaxBid).toLocaleString()}</p>
                <p className="text-xs text-white/30">{arb?.auction_fees_estimate ? `incl. ~$${arb.auction_fees_estimate.toLocaleString()} fees` : `at ${targetMargin}% margin`}</p>
              </div>
            ) : arb?.safe_bid_range != null ? (
              <div className={`border rounded-xl p-3 text-center ${arb.safe_bid_range.high >= 0 ? "bg-[#00d97e]/10 border-[#00d97e]/20" : "bg-red-500/10 border-red-500/20"}`}>
                <TrendingDown className={`w-4 h-4 mx-auto mb-1 ${arb.safe_bid_range.high >= 0 ? "text-[#00d97e]" : "text-red-400"}`} />
                <p className="text-xs text-white/40 font-medium">Max safe bid</p>
                <p className={`text-xl font-black ${arb.safe_bid_range.high >= 0 ? "text-[#00d97e]" : "text-red-400"}`}>${Math.max(0, arb.safe_bid_range.high).toLocaleString()}</p>
                <p className="text-xs text-white/30">at {targetMargin}% margin</p>
              </div>
            ) : null}
          </div>

          {/* Margin slider */}
          {arb?.arv != null && liveSafeBid != null && (
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white/80">Your profit margin target</p>
                  <p className="text-xs text-white/40 mt-0.5">Adjust to see how your max bid changes</p>
                </div>
                <span className="text-2xl font-black text-orange-400">{targetMargin}%</span>
              </div>
              <input type="range" min={10} max={30} step={5} value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))} className="w-full accent-orange-500" />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>10% (aggressive)</span><span>20% (default)</span><span>30% (conservative)</span>
              </div>
              {liveSafeBid && (
                <div className="mt-3 flex items-center justify-between bg-[#0d1117] border border-orange-500/20 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-white/40">Safe bid range at {targetMargin}%</span>
                  <span className="text-sm font-bold text-white">${Math.max(0, liveSafeBid.low).toLocaleString()} – ${Math.max(0, liveSafeBid.high).toLocaleString()}</span>
                </div>
              )}
              <p className="text-xs text-white/30 mt-2">Repair cost is an estimate — actual costs vary by region and shop.</p>
            </div>
          )}

          <AuctionBidGuidanceCard result={salvage} askingPrice={lot.current_bid ?? null} currentBid={lot.current_bid ?? null} vin={lot.vin ?? null} />

          {result.recalls.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
              <TriangleAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">{result.recalls.length} open NHTSA recall{result.recalls.length > 1 ? "s" : ""}</p>
                <ul className="space-y-0.5">
                  {result.recalls.slice(0, 3).map((r, i) => (
                    <li key={i} className="text-xs text-red-400/70">• {r.Component}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 text-center">
            <p className="text-lg font-bold text-white mb-1">Want the full report?</p>
            <p className="text-sm text-white/50 mb-4">Save to Garage, get a shareable link, EV battery analysis, tax credit eligibility, and more.</p>
            <Link href="/copart" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white font-bold text-sm rounded-xl hover:bg-orange-400 transition-colors">
              Open Full Tool <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ── LOADING STATE ── */}
      {pageState === "fetching" && (
        <section className="max-w-3xl mx-auto px-4 py-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-400 mx-auto mb-4" />
          <p className="text-white/60 font-semibold">Fetching lot data and running analysis…</p>
          <p className="text-sm text-white/30 mt-1">Usually takes 20–60 seconds</p>
        </section>
      )}

      {/* ── PAIN POINTS (idle only) ── */}
      {pageState === "idle" && (
        <>
          <section className="bg-[#0d1117] px-4 pt-4 pb-12 border-b border-white/[0.06]">
            <div className="max-w-3xl mx-auto">
              <p className="text-center text-sm font-semibold text-white/30 uppercase tracking-wider mb-6">Sound familiar?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAIN_POINTS.map((p) => (
                  <div key={p.text} className="flex items-start gap-3 bg-[#161b22] border border-white/[0.08] rounded-xl p-4">
                    <span className="text-xl shrink-0">{p.icon}</span>
                    <p className="text-sm text-white/50 leading-relaxed">{p.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── WHAT YOU GET ── */}
          <section className="bg-[#0d1117] px-4 py-16 border-b border-white/[0.06]">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-block px-3 py-1 bg-orange-500/15 text-orange-400 text-xs font-semibold rounded-full border border-orange-500/25 mb-3">What&apos;s included — free</span>
                <h2 className="text-3xl font-black text-white">Everything you need to bid with confidence</h2>
                <p className="text-white/40 mt-2">One paste. Eight data points. Under 60 seconds.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DELIVERABLES.map((d) => (
                  <div key={d.label} className="flex items-start gap-3 p-4 bg-[#161b22] border border-white/[0.08] rounded-xl hover:border-orange-500/30 transition-colors">
                    <span className="text-2xl shrink-0">{d.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white/80">{d.label}</p>
                      <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{d.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section className="bg-[#0d1117] px-4 py-16 border-b border-white/[0.06]">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-black text-white text-center mb-10">Three steps. Under 60 seconds.</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { n: "1", icon: <Gavel className="w-6 h-6 text-orange-400" />, title: "Paste the lot", desc: "Drop in any Copart or IAAI lot URL, or just the lot number." },
                  { n: "2", icon: <Zap className="w-6 h-6 text-orange-400" />, title: "Get the scores", desc: "We pull damage data, title status, recalls, and market comps in real time." },
                  { n: "3", icon: <TrendingDown className="w-6 h-6 text-orange-400" />, title: "Know your number", desc: "Max safe bid, ARV, repair cost — your ceiling, before the hammer falls." },
                ].map((step) => (
                  <div key={step.n} className="text-center">
                    <div className="w-12 h-12 bg-[#161b22] border border-orange-500/25 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      {step.icon}
                    </div>
                    <p className="font-bold text-white/80 mb-1">{step.title}</p>
                    <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SOCIAL PROOF ── */}
          <section className="bg-[#0d1117] px-4 py-16 border-b border-white/[0.06]">
            <div className="max-w-3xl mx-auto">
              <p className="text-center text-xs font-semibold text-white/30 uppercase tracking-wider mb-8">What bidders say</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {TESTIMONIALS.map((t) => (
                  <div key={t.name} className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-5">
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className="text-amber-400 text-sm">★</span>
                      ))}
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 ${t.color} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>{t.avatar}</div>
                      <div>
                        <p className="text-xs font-semibold text-white/80">{t.name}</p>
                        <p className="text-xs text-white/30">{t.handle}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── RISK REVERSAL ── */}
          <section className="bg-orange-500/10 border-y border-orange-500/20 px-4 py-12 text-center">
            <div className="max-w-2xl mx-auto">
              <Shield className="w-10 h-10 mx-auto mb-4 text-orange-400" />
              <h2 className="text-2xl font-black text-white mb-3">Zero risk to try</h2>
              <p className="text-white/50 leading-relaxed mb-6">
                No account. No credit card. No email required. Paste a lot number and get your full analysis in under 60 seconds — for free. If the numbers don&apos;t help you bid smarter, you&apos;ve lost nothing.
              </p>
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-bold text-sm rounded-xl hover:bg-orange-400 transition-colors">
                <Search className="w-4 h-4" /> Analyze a Lot Now — Free
              </a>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="bg-[#0d1117] px-4 py-16 border-b border-white/[0.06]">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-black text-white text-center mb-8">Common questions</h2>
              <div className="space-y-3">
                {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
              </div>
            </div>
          </section>

          {/* ── BOTTOM CTA ── */}
          <section className="bg-[#0d1117] px-4 py-16 text-center">
            <div className="max-w-2xl mx-auto">
              <p className="text-4xl mb-4">🔨</p>
              <h2 className="text-3xl font-black text-white mb-3">The auction doesn&apos;t wait.</h2>
              <p className="text-white/40 mb-8">Get your risk score and max safe bid before the lot closes.</p>
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white font-bold text-base rounded-xl transition-colors">
                <Gavel className="w-5 h-5" /> Analyze a Lot — Free
              </a>
              <p className="text-xs text-white/20 mt-4">No account · No credit card · Works on mobile</p>
            </div>
          </section>
        </>
      )}

      {/* ── Sticky bottom CTA (mobile, idle only) ── */}
      {pageState === "idle" && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-white/[0.08] px-4 py-3 z-50">
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold text-sm rounded-xl">
            <Search className="w-4 h-4" /> Analyze a Copart Lot — Free
          </a>
        </div>
      )}

      <Footer />
    </div>
  );
}
