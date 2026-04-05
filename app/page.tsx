"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { ArrowRight, Star, ChevronDown, ChevronUp, Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import LoginModal from "@/components/LoginModal";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import HowItWorksSection from "@/components/landing/HowItWorksSection";


export default function Home() {
  const router = useRouter();

  // Forward auth redirects (PKCE code or hash fragments) to the callback page
  useEffect(() => {
    // PKCE flow: Supabase redirects to Site URL with ?code= query param
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.href = `/auth/callback?code=${encodeURIComponent(code)}`;
      return;
    }
    // Legacy/fallback: hash fragment with error or access_token
    const hash = window.location.hash;
    if (hash && (hash.includes("error=") || hash.includes("access_token="))) {
      window.location.href = `/auth/callback${hash}`;
    }
    // Store invite token for attribution through fit flow
    const inviteToken = params.get("invite_token");
    if (inviteToken) {
      try { sessionStorage.setItem("offo_invite_token", inviteToken); } catch { /* ignore */ }
    }
  }, []);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [totalReceipts, setTotalReceipts] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/homepage/stats")
      .then((r) => r.json())
      .then((d) => { if (d.success && d.total_receipts > 0) setTotalReceipts(d.total_receipts); })
      .catch(() => {}); // non-critical, fall back to static text
  }, []);

  // Track visitor on homepage
  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  const { trackEvent, trackLandingView } = useEventTracking();

  // Fire landing_view on mount
  useEffect(() => {
    trackLandingView();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Homepage inline URL input
  const [listingUrl, setListingUrl] = useState("");

  // Derived paste detection — computed inline, no useEffect needed
  const { detectedDomain, detectedType } = useMemo(() => {
    const trimmed = listingUrl.trim();
    if (!trimmed) return { detectedDomain: null, detectedType: null };

    // Bare Copart lot number (6–12 digits, no spaces)
    if (/^\d{6,12}$/.test(trimmed)) {
      return { detectedDomain: "Copart lot number detected ✓", detectedType: "auction" as const };
    }

    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "");
      const path = url.pathname.toLowerCase();

      if (host.includes("copart.com")) return { detectedDomain: "Copart auction detected ✓", detectedType: "auction" as const };
      if (host.includes("iaai.com") || host.includes("iaaiservices.com")) return { detectedDomain: "IAAI auction detected ✓", detectedType: "auction" as const };
      if (host.includes("manheim.com")) return { detectedDomain: "Manheim auction detected ✓", detectedType: "auction" as const };
      if (host.includes("cargurus.com")) return { detectedDomain: "CarGurus listing detected ✓", detectedType: "listing" as const };
      if (host.includes("cars.com")) return { detectedDomain: "Cars.com listing detected ✓", detectedType: "listing" as const };
      if (host.includes("autotrader.com")) return { detectedDomain: "AutoTrader listing detected ✓", detectedType: "listing" as const };
      if (host.includes("facebook.com") && path.includes("marketplace")) return { detectedDomain: "Facebook Marketplace listing detected ✓", detectedType: "listing" as const };
      if (path.includes("/inventory/") || path.includes("/used/") || path.includes("/vehicle/")) return { detectedDomain: "Dealer listing detected ✓", detectedType: "listing" as const };

      return { detectedDomain: null, detectedType: null };
    } catch {
      return { detectedDomain: null, detectedType: null };
    }
  }, [listingUrl]);

  const handleHomePasteSubmit = () => {
    const trimmed = listingUrl.trim();
    if (!trimmed) return;
    trackEvent("listing_paste_submitted", { page_source: "homepage", detected_type: detectedType, text_length: trimmed.length });
    // Route auction URLs directly to the auction bidder, all others to receipt
    if (detectedType === "auction") {
      const isBareLot = /^\d{6,12}$/.test(trimmed);
      router.push(isBareLot
        ? `/copart?lot=${encodeURIComponent(trimmed)}&src=homepage`
        : `/copart?url=${encodeURIComponent(trimmed)}&src=homepage`
      );
    } else {
      router.push(`/receipt?url=${encodeURIComponent(trimmed)}&src=homepage`);
    }
  };


  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: "How do I know the battery condition of a used EV?", a: "OFFO pulls EPA-rated range, cross-references mileage and year against known degradation curves, and flags if the listing's claimed range is suspiciously optimistic. For deeper analysis, always request a battery health report or OBDII scan from the seller." },
    { q: "Can I charge an EV at an apartment without a garage?", a: "Yes — many apartment dwellers rely on Level 2 public chargers or workplace charging. OFFO's routine fit check accounts for your charging access and flags if a given vehicle's range makes apartment charging viable for your daily pattern." },
    { q: "Can I drive long distances with an EV?", a: "Absolutely. Most modern EVs have 250–350 mi EPA range. OFFO maps your longest single-day drive against the vehicle's real-world range (accounting for climate and highway speed) and tells you if you'll need a mid-trip charge stop." },
    { q: "What are the benefits of buying a used EV?", a: "Used EVs often cost 30–50% less than new, still qualify for up to $4,000 federal used-EV tax credits, and have fewer mechanical parts to fail. OFFO helps you avoid the pitfalls — high-degradation batteries, open recalls, and overpriced salvage vehicles." },
    { q: "What does OFFO's OFFO Score actually mean?", a: "The OFFO Score is a 0–100 composite of routine fit (does this vehicle work for your daily life?), value assessment (is the price fair for the condition?), and risk flags (recalls, battery health, title issues). Higher is better — 80+ is a confident buy." },
  ];

  const featuredVehicles = [
    { year: 2024, make: "Ford", model: "F-150 Lightning", trim: "LARIAT", mileage: "17K mi", range: "320 mi range", score: 98, price: "$51,998", badge: "Ext Range Battery", people: 1240, img: "/car-f150-lightning.webp" },
    { year: 2025, make: "Tesla", model: "Model 3", trim: "Long Range", mileage: "18K mi", range: "330 mi range", score: 96, price: "$39,997", badge: null, people: 3820, img: "/car-tesla-model3.webp" },
    { year: 2024, make: "Tesla", model: "Model X", trim: "Base", mileage: "16K mi", range: "293 mi range", score: 92, price: "$73,997", badge: null, people: 890, img: "/car-tesla-modelx.webp" },
    { year: 2018, make: "Nissan", model: "LEAF", trim: "S", mileage: "22K mi", range: "133 mi range", score: 86, price: "$12,998", badge: null, people: 2100, img: "/car-nissan-leaf.webp" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div id="turnstile-score" className="hidden" />
      <Header variant="homepage" />

      {/* ── Section 1: Hero ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Free · No sign-up required
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Get the second opinion that actually matters.
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-6 leading-relaxed">
              Paste any used car or Copart listing.<br />
              Instantly see routine fit, real risks, and what to ask the seller.
            </p>
            <p className="text-xs text-gray-400">
              Works with CarGurus, AutoTrader, Craigslist, Facebook Marketplace, Copart &amp; IAAI
            </p>
          </div>

          {/* Right: inline paste box — the "aha moment" above the fold */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Analyze any listing or auction</h2>
            <p className="text-sm text-gray-500 mb-4">Paste a URL and get an instant AI deal rating — free, no account needed.</p>
            <input
              id="listing-input"
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleHomePasteSubmit(); }}
              placeholder="Paste any listing or auction link here…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-400 mb-3"
              autoFocus
            />
            {detectedDomain && (
              <p className={`text-xs font-medium mb-3 ${detectedType === "auction" ? "text-orange-600" : "text-green-600"}`}>
                {detectedDomain}
                {detectedType === "auction" && " — Auction Bidder analysis"}
                {detectedType === "listing" && " — Listing analysis"}
              </p>
            )}
            <button
              onClick={handleHomePasteSubmit}
              disabled={!listingUrl.trim()}
              className={`w-full px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                listingUrl.trim()
                  ? detectedType === "auction"
                    ? "bg-orange-500 text-white hover:bg-orange-600 shadow-md"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {detectedType === "auction" ? "Analyze Auction Lot — It's Free" : "Analyze Listing — It's Free"}
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">No account required · Results in ~15 seconds</p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Trust Bar ─────────────────────────────────────── */}
      <div className="border-y border-gray-100 bg-gray-50 py-3">
        <p className="text-center text-xs text-gray-500">
          Used by serious EV shoppers · Powered by Auto.dev + NHTSA data · No sales pitch. Just honest analysis.
        </p>
      </div>

      {/* ── Section 3: How It Works ──────────────────────────────────── */}
      <HowItWorksSection variant="homepage" />

      {/* ── Section 4: Repeat Paste Box (for scrollers) ──────────────── */}
      <section id="paste-box" className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Analyze any car listing or auction</h2>
            <p className="text-sm text-gray-500 mb-4">Paste a CarGurus, Copart, AutoTrader, or any dealer URL — we&apos;ll route it automatically.</p>
            <input
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleHomePasteSubmit(); }}
              placeholder="Paste any listing or auction link here…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-400 mb-3"
            />
            {detectedDomain && (
              <p className={`text-xs font-medium mb-3 ${detectedType === "auction" ? "text-orange-600" : "text-green-600"}`}>
                {detectedDomain}
                {detectedType === "auction" && " — Auction Bidder analysis"}
                {detectedType === "listing" && " — Listing analysis"}
              </p>
            )}
            <button
              onClick={handleHomePasteSubmit}
              disabled={!listingUrl.trim()}
              className={`w-full px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                listingUrl.trim()
                  ? detectedType === "auction"
                    ? "bg-orange-500 text-white hover:bg-orange-600 shadow-md"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {detectedType === "auction" ? "Analyze Auction Lot — It's Free" : "Analyze Listing — It's Free"}
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              CarGurus · Copart · AutoTrader · Cars.com · Dealers · and more
            </p>
          </div>
        </div>
      </section>


      {/* ── Section 6: Social Proof ──────────────────────────────────── */}
      <section className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 mb-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/2">
              <Image
                src="/social-proof-laptop-v2.webp"
                alt="OFFO verdict on laptop — Confident Purchase"
                width={560}
                height={560}
                className="w-full rounded-2xl shadow-lg object-cover"
              />
            </div>
            <div className="w-full md:w-1/2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Real results</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-snug">
                Know the risks before you commit.
              </h2>
              <p className="text-base text-gray-600 leading-relaxed">
                OFFO surfaces what listing pages hide — battery degradation, overpricing, open recalls, and missing service history — so you walk in with the right questions.
              </p>
            </div>
          </div>
        </div>

        {/* Testimonial cards — photo + stars + Google badge style */}
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            {totalReceipts !== null
              ? `${totalReceipts.toLocaleString()}+ vehicles analyzed`
              : "5.0 stars from 200+ reviews"}
          </h2>
          <p className="text-sm text-gray-500 text-center mb-8">Real OFFO users, real decisions.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Marcus T.", location: "Chicago, IL", photo: "/car-bolt-ev.webp", quote: "Saved $2,400 on a used Bolt after seeing the hidden battery risk flag. Would never have caught it myself.", tag: "Used-EV buyer" },
              { name: "Priya S.", location: "Austin, TX", photo: "/car-ioniq5.webp", quote: "Avoided a $6k repair on a salvage Ioniq 5 — the routine impact score was a dealbreaker the seller couldn't argue with.", tag: "First EV purchase" },
              { name: "Jordan R.", location: "Denver, CO", photo: "/car-tesla-model3.webp", quote: "Compared 12 listings in one weekend. First time I've ever felt confident walking into a dealership...", tag: "EV switcher" },
              { name: "Alicia M.", location: "Seattle, WA", photo: "/car-hyundai-kona.webp", quote: "The apartment charging check alone was worth it. OFFO told me exactly which vehicles fit my situation.", tag: "Apartment renter" },
            ].map(({ name, location, photo, quote, tag }) => (
              <div key={name} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="h-36 overflow-hidden bg-gray-50">
                  <Image src={photo} alt={name} width={300} height={144} className="w-full h-full object-cover object-center" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                    </div>
                    <span className="text-xs font-bold text-gray-400 tracking-wide">G</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 underline mb-1">{name}</p>
                  <p className="text-xs text-gray-600 leading-relaxed flex-1">{quote}</p>
                  <p className="text-xs text-gray-400 mt-2">{tag} · {location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: Featured Vehicles ─────────────────────────────── */}
      <section className="py-10 md:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Top searches on OFFO</h2>
          <p className="text-sm text-gray-500 mb-8">Popular vehicles analyzed by OFFO users this week.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredVehicles.map(({ year, make, model, trim, mileage, range, score, price, badge, people, img }) => (
              <Link
                key={`${year}-${make}-${model}`}
                href={`/receipt?q=${encodeURIComponent(`${year} ${make} ${model}`)}`}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="relative h-36 overflow-hidden bg-gray-50">
                  <Image src={img} alt={`${year} ${make} ${model}`} width={300} height={144} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
                  {badge && (
                    <div className="absolute top-0 left-0 bg-black text-white text-xs font-bold px-2 py-1 rounded-br-lg">
                      {badge}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm font-bold text-gray-900">{year} {make} {model}</p>
                  <p className="text-xs text-gray-500 mb-2">{trim} · {mileage} · {range}</p>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{score}/100</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">OFFO Fit Score</p>
                    <p className="text-xs text-blue-500 font-medium">{people.toLocaleString()} fits this</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 border-t border-gray-100 pt-3">{price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 8: FAQ + Contact ──────────────────────────────────── */}
      <section className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Left */}
            <div className="lg:w-64 shrink-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-snug">Your questions,<br />answered</h2>
              <p className="text-sm text-gray-500 mb-1">Can&apos;t find what you&apos;re looking for?</p>
              <p className="text-sm text-gray-500 mb-5">Check out our <Link href="/receipt" className="underline text-gray-700 hover:text-gray-900">Analyze tool</Link> or reach out.</p>
              <a
                href="mailto:hello@offo.app"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact us
              </a>
            </div>

            {/* Right: accordion */}
            <div className="flex-1 divide-y divide-gray-200">
              {faqs.map((faq, i) => (
                <div key={i} className="py-4">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between text-left gap-4"
                  >
                    <span className="text-sm font-medium text-gray-800">{faq.q}</span>
                    {openFaq === i
                      ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                  </button>
                  {openFaq === i && (
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 9: Final CTA ─────────────────────────────────────── */}
      <section className="py-16 md:py-24 text-center">
        <div className="max-w-lg mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to check a listing?</h2>
          <p className="text-sm text-gray-500 mb-6">Takes under 30 seconds. Free, no account needed.</p>
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); document.getElementById("listing-input")?.focus(); }}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
          >
            Paste it here →
          </button>
        </div>
      </section>

      {/* ── Data Sources Trust Bar ──────────────────────────────────── */}
      <section className="bg-[#1a2332] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-0">
            <div className="md:pr-8 md:border-r md:border-white/10 shrink-0 text-center md:text-left">
              <p className="text-teal-400 font-semibold text-sm leading-tight">Powered by</p>
              <p className="text-white font-bold text-base leading-tight">trusted automotive</p>
              <p className="text-white font-bold text-base leading-tight">data sources</p>
            </div>
            <div className="flex flex-wrap justify-center md:justify-start items-center md:pl-8">
              {[
                { name: "Auto.dev", icon: "◎" },
                { name: "NHTSA", icon: "✦" },
                { name: "EPA Fuel Economy", icon: "◈" },
                { name: "NREL EV charging data", icon: "⚡" },
                { name: "AAA EV Studies", icon: "◎" },
              ].map((src, i) => (
                <div key={src.name} className="flex items-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <span className="text-white/40 text-xs">{src.icon}</span>
                    <span className="text-sm font-medium text-white/80 whitespace-nowrap">{src.name}</span>
                  </div>
                  {i < 4 && <span className="text-white/20 text-sm mx-1 hidden sm:inline">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
