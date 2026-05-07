import Link from "next/link";

export default function HowWeVetEveryEvDealPage() {
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
            <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 text-xs font-semibold px-3 py-1 rounded-full">
              How It Works
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            How We Find and Vet Every Used EV Deal on OFFO
          </h1>
          <p className="text-white/50 text-lg italic mb-4 leading-relaxed">
            From listing page to GREEN verdict — here&apos;s exactly what happens before a deal appears on our site.
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <span>OFFO Labs</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>6 min read</span>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Intro */}
        <div className="space-y-4 mb-10 text-white/70 leading-relaxed">
          <p>
            Buying a used electric vehicle should feel exciting.
          </p>
          <p>
            Instead, it often feels like walking through a minefield.
          </p>
          <p>
            Battery health is invisible. Title issues hide in PDFs. Prices swing wildly with no clear
            anchor. And the usual advice — &ldquo;just run a Carfax&rdquo; — tells you about accidents and theft
            but says nothing about whether the battery has already degraded, whether the car will
            actually work for your daily commute, or whether the dealer is quietly charging $3,000–$4,000
            over market.
          </p>
          <p>
            We built OFFO because we kept watching smart buyers walk into dealerships blind. So we
            created a pipeline that does the homework for them — automatically, transparently, and for
            free — before they ever make a call.
          </p>
          <p className="font-medium text-white/80">
            Here&apos;s exactly how every deal on OFFO gets found and vetted.
          </p>
        </div>

        {/* Step 1 */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm flex-shrink-0">
              1
            </div>
            <h2 className="text-2xl font-bold text-white">We Find the Listings</h2>
          </div>
          <p className="text-white/70 leading-relaxed mb-4">
            Every day our system scans used EV inventory across CarGurus, AutoTrader, Cars.com,
            Carvana, CarMax, Facebook Marketplace, and major auction sites like Copart and IAAI.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            When a listing looks promising — right price range, reasonable mileage, clean-looking
            history — we pull it in. We capture the basics (year, make, model, mileage, price,
            location, and the original URL) and automatically read the full listing page for any
            extra details the seller mentioned: battery reports, service records, damage disclosures,
            and more.
          </p>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-4">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">Sources we monitor</p>
            <div className="flex flex-wrap gap-2">
              {["CarGurus", "AutoTrader", "Cars.com", "Carvana", "CarMax", "Facebook Marketplace", "Copart", "IAAI"].map((s) => (
                <span key={s} className="bg-white/[0.06] text-white/60 text-xs px-3 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>

          <p className="text-white/50 text-sm leading-relaxed">
            You can do the same thing yourself in seconds — just paste any CarGurus (or similar)
            link on OFFO and the process runs instantly.
          </p>
        </section>

        {/* Step 2 */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm flex-shrink-0">
              2
            </div>
            <h2 className="text-2xl font-bold text-white">The VIN Audit</h2>
          </div>
          <p className="text-white/70 leading-relaxed mb-6">
            This is the part most car-buying tools skip or do halfway.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            Once we have a VIN, we run a full cross-check against national databases. We specifically
            look for:
          </p>

          <div className="space-y-2 mb-6">
            {[
              "Salvage or rebuilt title history",
              "Reported accidents (even minor ones)",
              "Number of owners and how quickly the car changed hands",
              "Open safety recalls for that exact make, model, and year",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 bg-[#161b22] border border-white/[0.06] rounded-lg px-4 py-3">
                <span className="text-[#00d97e] mt-0.5">✓</span>
                <span className="text-sm text-white/70">{item}</span>
              </div>
            ))}
          </div>

          <p className="text-white/70 leading-relaxed mb-4">
            We also verify that the VIN actually matches an electric vehicle. (Yes, misclassified
            or mistyped listings still happen.)
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-300/80 leading-relaxed">
              Only listings that clear this audit move forward. Everything else stays behind the scenes.
            </p>
          </div>
        </section>

        {/* Step 2b — Battery health */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-500/15 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
              2b
            </div>
            <h2 className="text-2xl font-bold text-white">Battery Health Estimation</h2>
          </div>
          <p className="text-white/70 leading-relaxed mb-4">
            This is the part most people ask about — and where we want to be precise about what we&apos;re actually doing.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            We don&apos;t pull a live SOH reading from the car. What we build is an <span className="text-white font-medium">expected health range</span> based
            on VIN-level data: model year, trim, EPA-rated range, reported mileage, and the known degradation curve
            for that battery chemistry. The result is a range like &ldquo;88–93% expected at this mileage&rdquo; — not a
            single number we can&apos;t honestly claim from a listing alone.
          </p>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wide mb-4">Degradation rates by chemistry</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { chem: "NMC / NCM", rate: "~2.0% / year", note: "Most common — Hyundai, Kia, VW, Ford" },
                { chem: "LFP", rate: "~1.5% / year", note: "Tesla Standard Range, BYD — better longevity" },
                { chem: "NCA", rate: "~2.3% / year", note: "Older Tesla Model S/X pre-2021" },
                { chem: "Air-cooled", rate: "~3.0% / year", note: "Pre-2023 Nissan Leaf — highest degradation risk" },
              ].map(({ chem, rate, note }) => (
                <div key={chem} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-white mb-0.5">{chem}</p>
                  <p className="text-[#00d97e] text-sm font-mono mb-1">{rate}</p>
                  <p className="text-xs text-white/40">{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
            <p className="text-sm text-amber-300/80 leading-relaxed">
              <span className="font-semibold text-amber-300">What we&apos;re explicit about:</span> OBD2 SOH readings
              are noisy — a reading in February in a cold climate isn&apos;t the same as one after several warm-weather
              full cycles. Our estimate is &ldquo;expected range for this VIN at this mileage&rdquo; based on chemistry and
              age, not a live measurement. Confidence is shown accordingly in the receipt.
            </p>
          </div>

          <p className="text-white/50 text-sm leading-relaxed">
            Why it still matters: two identical listings, one at 92% and one at 78%, can differ by $2,000–$4,000
            at resale. Sellers almost never disclose it. The buyer who checks wins.
          </p>
        </section>

        {/* Step 3 */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm flex-shrink-0">
              3
            </div>
            <h2 className="text-2xl font-bold text-white">AI-Powered Scoring</h2>
          </div>
          <p className="text-white/70 leading-relaxed mb-4">
            With the VIN audit complete, we run an EV-specific analysis layer.
          </p>
          <p className="text-white/70 leading-relaxed mb-5">
            The system looks at over 50 signals that matter most for used EVs:
          </p>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-4 space-y-3">
            {[
              "Is battery health data provided, or is it completely unknown?",
              "Are service and maintenance records shown?",
              "Does the asking price make sense compared to similar cars in the same region and mileage?",
              "Are there any red flags in the listing text itself?",
            ].map((signal) => (
              <div key={signal} className="flex items-start gap-3">
                <span className="text-[#00d97e] text-xs mt-1 flex-shrink-0">→</span>
                <span className="text-sm text-white/60 leading-relaxed">{signal}</span>
              </div>
            ))}
          </div>

          <p className="text-white/50 text-sm leading-relaxed">
            All of this feeds into a single, easy-to-understand verdict.
          </p>
        </section>

        {/* Step 4 */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#00d97e]/15 rounded-full flex items-center justify-center text-[#00d97e] font-bold text-sm flex-shrink-0">
              4
            </div>
            <h2 className="text-2xl font-bold text-white">The Final Verdict</h2>
          </div>
          <p className="text-white/70 leading-relaxed mb-6">
            Every deal gets one of three badges:
          </p>

          <div className="space-y-3 mb-6">
            <div className="bg-[#161b22] border border-[#00d97e]/20 rounded-xl p-4 flex items-start gap-4">
              <span className="bg-[#00d97e]/15 text-[#00d97e] text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">GREEN</span>
              <p className="text-sm text-white/60 leading-relaxed">Low risk, solid evidence, worth considering.</p>
            </div>
            <div className="bg-[#161b22] border border-amber-500/20 rounded-xl p-4 flex items-start gap-4">
              <span className="bg-amber-500/15 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">YELLOW</span>
              <p className="text-sm text-white/60 leading-relaxed">Proceed with caution — specific things you should verify.</p>
            </div>
            <div className="bg-[#161b22] border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
              <span className="bg-red-500/15 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">RED</span>
              <p className="text-sm text-white/60 leading-relaxed">High risk or hard blocker — we still show it so you can see why.</p>
            </div>
          </div>

          <p className="text-white/60 text-sm leading-relaxed">
            You also get a Deal Quality Score (0–100) so you can compare similar cars at a glance,
            plus the top risk flags written in plain English.
          </p>
        </section>

        {/* What you see */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">What You Actually See on OFFO</h2>
          <p className="text-white/70 leading-relaxed mb-5">Every listing shows:</p>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-4 space-y-2">
            {[
              "Photo, price, mileage, and location",
              "The GREEN / YELLOW / RED verdict badge",
              "Deal Quality Score",
              "Top risk flags in plain language",
              "Direct link to the full analysis",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="text-[#00d97e] text-sm">✓</span>
                <span className="text-sm text-white/60">{item}</span>
              </div>
            ))}
          </div>

          <p className="text-white/50 text-sm leading-relaxed">
            You can filter and sort by price, mileage, location, or verdict. Everything is free to
            browse — no account required.
          </p>
        </section>

        {/* Why we built it */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">Why We Built It This Way</h2>
          <div className="space-y-4 text-white/70 leading-relaxed">
            <p>
              The used EV market moves fast and the information gap between sellers and buyers is huge.
              Dealers know the real story. Most buyers don&apos;t — unless they&apos;re willing to spend hundreds
              of dollars on multiple reports and still miss the EV-specific details that actually matter.
            </p>
            <p>
              OFFO runs the entire process automatically so you don&apos;t have to. Every deal you see on
              our site has already been sourced, audited, scored, and verified.
            </p>
            <p>
              And if you find a listing somewhere else that isn&apos;t in our feed yet? Just paste the URL
              on OFFO. The same full analysis runs on demand in under 30 seconds — completely free.
            </p>
          </div>
        </section>

        {/* CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <Link
            href="/deals"
            className="bg-[#00d97e] hover:bg-[#00c970] text-black font-semibold text-sm px-5 py-3.5 rounded-xl transition-colors text-center"
          >
            Browse verified deals →
          </Link>
          <Link
            href="/receipt"
            className="bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-sm px-5 py-3.5 rounded-xl transition-colors text-center border border-white/[0.08]"
          >
            Analyze any listing →
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
      </main>
    </div>
  );
}
