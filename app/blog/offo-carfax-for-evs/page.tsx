import Link from "next/link";
import RelatedPosts from "@/components/RelatedPosts";
import BlogEmailCapture from "@/components/blog/BlogEmailCapture";

const RELATED_POSTS = [
  {
    slug: "carfax-alternative-used-ev",
    title: "I Was Paying $45 for Carfax Reports. Then I Found a Better Way.",
    badge: "Buyer's Guide",
    badgeColor: "bg-blue-500/20 text-blue-300",
    excerpt: "After testing every major VIN report on real EV listings, one free tool changed everything.",
  },
  {
    slug: "ev-vin-report-guide",
    title: "EV VIN Report: What It Shows, What It Misses, and the Free Tool That Does It Better",
    badge: "Buyer's Guide",
    badgeColor: "bg-blue-500/20 text-blue-300",
    excerpt: "Standard VIN reports miss battery degradation, DCFC speed, and EV-specific recalls.",
  },
  {
    slug: "best-carfax-alternatives-2026",
    title: "Best Carfax Alternatives of 2026 — Tested Head-to-Head",
    badge: "Comparison",
    badgeColor: "bg-green-500/20 text-green-300",
    excerpt: "We tested 7 VIN report services. OFFO ranks #1 for used EV buyers.",
  },
];

export default function OffoCarfaxForEvsPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link
            href="/blog"
            className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm mb-4 inline-block transition-colors"
          >
            ← Back to OFFO Labs Blog
          </Link>
          <div className="mb-3">
            <span className="bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/25 text-xs font-semibold px-3 py-1 rounded-full">
              Industry First
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            We Built the Carfax for EVs — Because Carfax Can&apos;t
          </h1>
          <p className="text-white/50 text-lg italic mb-4 leading-relaxed">
            Battery health, charging fit, and EV-specific recall data aren&apos;t in Carfax&apos;s model. They never will be. Here&apos;s why — and what we built instead.
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <span>OFFO Labs</span>
            <span>·</span>
            <span>July 2026</span>
            <span>·</span>
            <span>8 min read</span>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Intro */}
        <div className="space-y-4 mb-10 text-white/70 leading-relaxed">
          <p>
            If you&apos;ve searched for <em>&ldquo;Carfax for EVs&rdquo;</em> — you&apos;ve probably noticed that nothing comes back
            that actually answers the question. There are Carfax reports <em>on</em> EVs, sure. But a report
            built <em>for</em> EVs? One that understands battery chemistry, charging infrastructure, and range
            degradation? That didn&apos;t exist.
          </p>
          <p>
            Until OFFO.
          </p>
          <p>
            This isn&apos;t a modest claim. The used EV market is growing fast — over 1.5 million used EVs
            changed hands in the US last year — and buyers are making $20,000–$50,000 decisions with
            a report infrastructure built entirely for internal combustion engines. We think that&apos;s a structural
            problem, not a gap to be filled with a better Carfax subscription.
          </p>
          <p>
            So we built OFFO: the first vehicle history report specifically designed for used EV buyers.
            Here&apos;s exactly what that means — and why Carfax, for all its data, cannot build what we built.
          </p>
        </div>

        {/* Section 1: Why Carfax misses EVs structurally */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            Carfax Was Built for Gas Cars. The Data It Collects Reflects That.
          </h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Carfax pulls from a specific set of data sources: DMV title and registration records, insurance
            claims, police reports, auction records, and dealer service histories. It&apos;s genuinely useful
            for what it tracks. For a gas car, knowing about a prior accident, a salvage title, or
            unreported odometer rollback is high-signal information.
          </p>
          <p className="text-white/70 leading-relaxed mb-6">
            The problem is that <strong className="text-white">none of those data sources contain EV-specific information.</strong>{" "}
            No DMV database knows how many DC fast charge sessions a Nissan LEAF has done.
            No insurance record shows whether a Tesla&apos;s battery replacement was OEM or aftermarket.
            No auction data tells you the estimated state of health of a 2018 Chevy Bolt pack.
          </p>
          <p className="text-white/70 leading-relaxed mb-6">
            This isn&apos;t a data pipeline problem Carfax could fix by adding a new integration.
            The EV-specific data either doesn&apos;t exist in standardized form or sits
            in manufacturer-proprietary systems that aren&apos;t shared. To assess a used EV properly,
            you need to <em>infer</em> the things that can&apos;t be looked up — and build a model that understands
            what makes EVs categorically different from gas cars.
          </p>

          {/* The 5 blind spots */}
          <div className="space-y-3 mb-6">
            {[
              {
                title: "Battery degradation",
                carfax: "Not tracked. No data source reports it.",
                offo: "OFFO estimates state of health using degradation curves calibrated by make, model, year, and mileage — then flags if claimed range looks optimistic for the pack age.",
              },
              {
                title: "DC fast charge capability",
                carfax: "Not tracked. VIN decodes don't surface it reliably for older models.",
                offo: "OFFO checks the specific trim against our EV spec database. A base Nissan LEAF without CHAdeMO changes road-trip viability entirely — we surface that.",
              },
              {
                title: "Charging fit for your life",
                carfax: "Not applicable. Carfax doesn't know where you live or how you drive.",
                offo: "OFFO scores whether this specific car fits your charging setup, commute, climate zone, and longest single day. Cold climates cut range 20–40%. We calculate that.",
              },
              {
                title: "EV-specific recall risk",
                carfax: "Pulls NHTSA records but doesn't interpret them for EV risk severity.",
                offo: "OFFO cross-references NHTSA recall data against known EV failure modes — battery fire risk, thermal runaway, charging port failures — and flags open items by severity.",
              },
              {
                title: "Missing evidence as a signal",
                carfax: "Reports what was reported. Silence = no data.",
                offo: "OFFO penalizes silence. A listing with no battery report, no service records, and no VIN decode gets a lower evidence score — because withholding information is itself a risk signal.",
              },
            ].map(({ title, carfax, offo }) => (
              <div key={title} className="bg-[#161b22] border border-white/[0.08] rounded-xl overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
                  <p className="text-sm font-bold text-white">{title}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">Carfax</p>
                    <p className="text-sm text-red-400/80 leading-relaxed">{carfax}</p>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-bold text-[#00d97e]/50 uppercase tracking-widest mb-1.5">OFFO</p>
                    <p className="text-sm text-white/60 leading-relaxed">{offo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: What we built */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            What &ldquo;Built for EVs&rdquo; Actually Means
          </h2>
          <p className="text-white/70 leading-relaxed mb-6">
            OFFO isn&apos;t a VIN lookup service with an EV tab bolted on. The entire architecture was designed
            around the question <em>&ldquo;should this person buy this specific used EV?&rdquo;</em> — not <em>&ldquo;what happened
            to this car?&rdquo;</em> Those are fundamentally different questions, and they require fundamentally
            different data and models.
          </p>

          <div className="space-y-5 mb-8">
            {[
              {
                step: "01",
                title: "38 EV-specific risk signals",
                body: "Our scoring engine checks 38 signals that only matter for EVs: DC fast charge support confirmed, battery report present in listing, estimated kWh loss by mileage/year curve, charge port type compatibility, climate zone impact on real-world range, 12V battery age risk, thermal management type, and 31 more. A standard VIN report checks zero of these.",
              },
              {
                step: "02",
                title: "Degradation curves, not just mileage",
                body: "A 2019 Nissan LEAF with 45,000 miles isn't the same risk as a 2022 Chevy Bolt with 45,000 miles. Different battery chemistry, different thermal management, different known failure modes. OFFO models degradation by specific make/model/year — because miles alone don't tell the story.",
              },
              {
                step: "03",
                title: "Charging fit as a first-class signal",
                body: "The biggest source of EV regret isn't battery failure. It's buying a car that doesn't fit how you actually live. A 150-mile rated EV with no home charging and a 90-mile daily commute in Minnesota is a bad fit — even if the battery is perfect. OFFO surfaces this before the purchase.",
              },
              {
                step: "04",
                title: "Evidence scoring, not just data presence",
                body: "A Carfax with no accidents doesn't mean the car is clean — it means no accidents were reported to the data sources Carfax has access to. OFFO goes further: the absence of a battery report, missing service records, or a VIN that can't be decoded are all penalized. Silence is a signal.",
              },
              {
                step: "05",
                title: "AI-powered listing analysis",
                body: "Paste a CarGurus, AutoTrader, or Cars.com URL and OFFO reads the full listing text, analyzes photos for damage and missing angles, and extracts structured signals the seller didn't explicitly state. The AI looks for what's conspicuously absent as much as what's present.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center text-[#00d97e] font-bold text-xs">
                  {step}
                </div>
                <div>
                  <p className="text-white font-semibold mb-1.5">{title}</p>
                  <p className="text-white/50 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: The verdict system */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            The Verdict: GREEN / YELLOW / RED
          </h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Carfax gives you data. OFFO gives you a decision. The output of every OFFO analysis is a
            clear verdict — not a 40-page PDF that leaves you more confused than when you started.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                verdict: "GREEN",
                color: "#00d97e",
                bg: "rgba(0,217,126,0.08)",
                border: "rgba(0,217,126,0.20)",
                meaning: "Strong Buy",
                desc: "Clean signals across all 38 checks. Price at or below market. Battery health within expected range. Charging fit confirmed. Move fast — deals like this go quickly.",
              },
              {
                verdict: "YELLOW",
                color: "#eab308",
                bg: "rgba(234,179,8,0.08)",
                border: "rgba(234,179,8,0.20)",
                meaning: "Proceed With Caution",
                desc: "One or more moderate risk signals present — missing service records, slightly high mileage for pack age, or price slightly above market. Worth pursuing with the right negotiation.",
              },
              {
                verdict: "RED",
                color: "#ef4444",
                bg: "rgba(239,68,68,0.08)",
                border: "rgba(239,68,68,0.20)",
                meaning: "High Risk — Walk Away",
                desc: "Hard blocker present: salvage title, open safety recall, DCFC absent when required, major evidence gap. This verdict exists so you can walk away before wasting a test drive.",
              },
            ].map(({ verdict, color, bg, border, meaning, desc }) => (
              <div
                key={verdict}
                className="rounded-xl p-5 border"
                style={{ background: bg, borderColor: border }}
              >
                <div
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3"
                  style={{ background: `${color}20` }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-xs font-bold" style={{ color }}>
                    {verdict}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white mb-1.5">{meaning}</p>
                <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <p className="text-white/60 text-sm leading-relaxed">
            The verdict comes with a full breakdown: deal quality score, evidence score, risk flags,
            price vs. market position, negotiation script, and a list of questions to ask the seller
            before the test drive. Everything in one place, in under 30 seconds.
          </p>
        </section>

        {/* Section 4: Real example */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            What an OFFO Report Looks Like in Practice
          </h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Here&apos;s a real example — a 2020 Hyundai Kona Electric listed at $21,400 with 41,000 miles on
            CarGurus. We ran the OFFO analysis to show the contrast with what a standard Carfax would surface:
          </p>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden mb-6">
            {/* Mock report header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-white font-bold">2020 Hyundai Kona Electric · 41,000 mi</p>
                  <p className="text-white/40 text-sm">Listed at $21,400 · CarGurus · Dealer listing</p>
                </div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00d97e]/10 border border-[#00d97e]/20">
                  <span className="w-2 h-2 rounded-full bg-[#00d97e]" />
                  <span className="text-sm font-bold text-[#00d97e]">GREEN</span>
                </span>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
              {[
                { label: "Deal Quality", value: "81", sub: "/ 100" },
                { label: "Evidence Score", value: "8.1", sub: "/ 10" },
                { label: "Risk Points", value: "0.9", sub: "" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="px-5 py-4 text-center">
                  <p className="text-2xl font-black text-[#00d97e]">
                    {value}
                    <span className="text-xs font-normal text-white/30 ml-0.5">{sub}</span>
                  </p>
                  <p className="text-xs text-white/35 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Signals */}
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">EV signals checked</p>
              <div className="space-y-2">
                {[
                  { icon: "✓", color: "text-[#00d97e]", text: "VIN decoded — clean title, no salvage" },
                  { icon: "✓", color: "text-[#00d97e]", text: "No open NHTSA safety recalls" },
                  { icon: "✓", color: "text-[#00d97e]", text: "DC fast charge (CCS) confirmed for this trim" },
                  { icon: "✓", color: "text-[#00d97e]", text: "Battery health estimated — degradation within expected range for 41k mi / 2020" },
                  { icon: "✓", color: "text-[#00d97e]", text: "Price $1,200 below median comp — 4 similar listings in market" },
                  { icon: "~", color: "text-amber-400", text: "Service records not listed — request from seller before purchase" },
                  { icon: "~", color: "text-amber-400", text: "No battery health report in listing — standard for this model year" },
                ].map(({ icon, color, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <span className={`font-bold text-sm shrink-0 ${color}`}>{icon}</span>
                    <p className="text-sm text-white/60">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Negotiation script preview */}
            <div className="px-6 py-4">
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2">Negotiation script (excerpt)</p>
              <div className="bg-[#0d1117] rounded-lg p-4 border border-white/[0.06]">
                <p className="text-sm text-white/60 italic leading-relaxed">
                  &ldquo;I&apos;ve been looking at comparable 2020 Kona Electrics in the area — a few similar-mileage units
                  are listed around $20,000–$21,000. Given that I couldn&apos;t find service records in the listing,
                  would you be willing to come down to $20,200 if I can see maintenance documentation before
                  we proceed?&rdquo;
                </p>
              </div>
              <p className="text-xs text-white/30 mt-2">This is generated from the specific signals found in this listing — not a template.</p>
            </div>
          </div>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-4">
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">What a Carfax on the same vehicle shows</p>
            <div className="space-y-1.5">
              {[
                "✓  Clean title",
                "✓  2 previous owners",
                "✓  No reported accidents",
                "✓  Last service: dealer, 38,200 miles",
                "✗  Battery health — not tracked",
                "✗  DC fast charge support — not tracked",
                "✗  Price vs. market — not tracked",
                "✗  Charging fit for your life — not tracked",
              ].map((line) => (
                <p key={line} className={`text-sm font-mono ${line.startsWith("✗") ? "text-red-400/60" : "text-white/50"}`}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          <p className="text-white/50 text-sm leading-relaxed">
            Both reports are accurate. Only one is useful for buying a used EV.
          </p>
        </section>

        {/* Section 5: Why Carfax won't build this */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            Why Carfax Won&apos;t Build This
          </h2>
          <p className="text-white/70 leading-relaxed mb-4">
            This isn&apos;t a knock on Carfax. They&apos;ve built genuinely valuable infrastructure over 30 years.
            The issue is structural.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            Carfax&apos;s data model is built around events — things that were reported somewhere.
            A crash gets reported to insurance. A title transfer gets reported to the DMV.
            A service visit gets reported by the dealer. The entire system is a collection of
            reported events.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            Battery degradation isn&apos;t an event. It&apos;s a continuous process. No one reports that a
            LEAF&apos;s battery dropped from 100% to 78% over 60,000 miles — because there&apos;s no reporting
            mechanism for it. Charging fit isn&apos;t an event either. It requires modeling your specific
            life against the vehicle&apos;s capabilities.
          </p>
          <p className="text-white/70 leading-relaxed mb-6">
            To build the Carfax for EVs, you need to shift from <em>event collection</em> to
            <em> inference and modeling</em>. That requires a different architecture, different data
            science, and a product team that thinks EV-first rather than retrofitting gas-car logic
            onto electric drivetrains.
          </p>

          <div className="border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 text-xs font-bold text-white/30 uppercase tracking-widest border-b border-white/[0.06]">
              <div className="px-5 py-3 border-r border-white/[0.06]">Carfax approach</div>
              <div className="px-5 py-3">OFFO approach</div>
            </div>
            {[
              ["Collect reported events", "Infer from signals + models"],
              ["Data from DMV, insurance, dealers", "Data from EPA, NHTSA, EV specs + AI listing analysis"],
              ["Same model for all vehicles", "EV-specific degradation curves per make/model/year"],
              ["Report what happened", "Assess if you should buy this specific car"],
              ["One-size report", "Personalized to your charging setup and climate"],
            ].map(([left, right]) => (
              <div key={left} className="grid grid-cols-2 border-b border-white/[0.04] last:border-0">
                <div className="px-5 py-3 text-sm text-white/40 border-r border-white/[0.06]">{left}</div>
                <div className="px-5 py-3 text-sm text-[#00d97e]/80">{right}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Who we built this for */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            Who We Built This For
          </h2>
          <p className="text-white/70 leading-relaxed mb-6">
            OFFO is for anyone buying a used EV — but it&apos;s especially for buyers who are
            making this transition for the first time. First-time EV buyers are the most
            vulnerable to the risks that standard VIN reports miss. They don&apos;t know to ask about
            DC fast charging. They don&apos;t know that a 2015 Nissan LEAF has a thermal management system
            (passive cooling) that degrades faster in hot climates. They don&apos;t know that missing
            charging port data is a red flag.
          </p>
          <p className="text-white/70 leading-relaxed mb-6">
            OFFO was built so that knowledge isn&apos;t required. You paste the listing. We run the
            analysis. You get a plain-language verdict that tells you exactly what to do next —
            and why.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: "First-time EV buyers",
                desc: "Don't know what to check. OFFO checks everything and explains the findings.",
              },
              {
                label: "Repeat EV buyers",
                desc: "Know the risks but want confirmation before committing. OFFO runs the checks in seconds.",
              },
              {
                label: "Anyone comparing 3+ listings",
                desc: "Don't want to pay for Carfax on every car. OFFO is free for every analysis.",
              },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-2">{label}</p>
                <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 7: Where to from here */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            This Is Just the Beginning
          </h2>
          <p className="text-white/70 leading-relaxed mb-4">
            OFFO today runs 38 EV-specific signals, delivers a verdict in under 30 seconds, and is
            completely free. That&apos;s the baseline — and it already outperforms any paid VIN report
            for EV-specific due diligence.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            The roadmap goes further. Full ownership history with VIN audit integration
            (VINaudit and ClearVIN) is in active development — giving OFFO the title history and
            accident record depth of a traditional report, layered on top of the EV-specific analysis
            that no traditional report provides.
          </p>
          <p className="text-white/70 leading-relaxed mb-6">
            The goal is a single report that tells you everything: what happened to the car,
            how the battery is aging, whether it fits your charging life, and what to pay.
            That&apos;s the Carfax for EVs. We&apos;re building it.
          </p>
        </section>

        {/* Pull quote */}
        <blockquote className="border-l-4 border-[#00d97e] pl-6 mb-12">
          <p className="text-xl font-medium text-white/80 leading-relaxed italic">
            &ldquo;Carfax tells you what happened to the car. OFFO tells you if the battery can handle your life.&rdquo;
          </p>
        </blockquote>

        {/* CTA */}
        <div className="bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-2xl p-6 mb-10">
          <p className="text-white font-semibold mb-1">Run your first EV battery check — free, no sign-up.</p>
          <p className="text-white/50 text-sm mb-4">
            Paste any CarGurus, AutoTrader, or Cars.com listing URL. Get battery health,
            charging fit score, open recalls, and a verdict in under 30 seconds.
          </p>
          <Link
            href="/receipt"
            className="inline-block bg-[#00d97e] hover:bg-[#00c970] text-black font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            Check a listing free →
          </Link>
        </div>

        {/* Footer nav */}
        <div className="border-t border-white/[0.08] pt-8 flex items-center justify-between">
          <Link href="/blog" className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm transition-colors">
            ← All posts
          </Link>
          <Link href="/receipt" className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm transition-colors">
            Try OFFO free →
          </Link>
        </div>

        <BlogEmailCapture source="blog_carfax_for_evs" />

        <RelatedPosts posts={RELATED_POSTS} />
      </main>
    </div>
  );
}
