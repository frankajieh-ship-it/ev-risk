import Link from "next/link";

export default function HybridAiSystemPage() {
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
              Engineering
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            We Built a Hybrid AI System That Actually Helps People Buy Used EVs Without the Regret
          </h1>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <span>OffoLab</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>4 min read</span>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Subtitle */}
        <p className="text-white/50 text-lg italic mb-8 leading-relaxed">
          How a deterministic-first scoring layer + hedged multi-LLM chain turned messy CarGurus listings and Copart auctions into actionable results.
        </p>

        {/* Intro */}
        <div className="space-y-4 mb-10 text-white/70 leading-relaxed">
          <p>
            When I started looking at used EVs seriously, the listings all looked reasonable on paper.
            Decent price, reasonable miles, clean Carfax. Then reality hit. A buyer would pull the trigger,
            only to discover six months later that the battery had been fast-charged heavily, the car lived
            in extreme cold, or the longest driving day in winter consistently ate 30–40% more range than
            advertised — and all of a sudden what was a good deal could lead to stress.
          </p>
          <p>
            That gap between what the listing promises and what the car actually delivers in someone&apos;s
            real routine is what we set out to close. At the same time, salvage auctions (Copart, IAAI)
            present an even harder version of the same problem: you have minutes to decide whether a
            damaged vehicle is worth repairing and whether the math still works after the fix.
          </p>
          <p>
            We needed a system that could answer both questions quickly, consistently, and in a way a
            normal buyer (or rebuilder) could trust.
          </p>
        </div>

        {/* Section: What We Built */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">What We Built</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            We ended up with a hybrid architecture that puts a deterministic rule engine first, then
            layers on an asynchronous multi-LLM chain only where it adds value.
          </p>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">Phase 1 — Lite Receipt</div>
                <p className="text-xs text-white/50 mb-3">Under 500 ms</p>
                <ul className="text-sm text-white/70 space-y-1.5">
                  <li>Deterministic engine extracts signals from any CarGurus listing</li>
                  <li>Scores risk and confidence against V2 thresholds</li>
                  <li>Hard blockers → RED; low confidence → YELLOW; clean → GREEN</li>
                  <li className="font-semibold text-[#00d97e]">Always returns a real result in &lt; 500ms</li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">Phase 2 — AI Upgrade</div>
                <p className="text-xs text-white/50 mb-3">Async, 10–30 seconds</p>
                <ul className="text-sm text-white/70 space-y-1.5">
                  <li>OpenAI primary at T+0s</li>
                  <li>Gemini at T+8s</li>
                  <li>Grok at T+14s</li>
                  <li className="font-semibold text-blue-400">First valid JSON wins. Rest aborted.</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-white/60 text-sm leading-relaxed">
            Missing battery report, service records, or VIN confirmation alone pushes most listings to
            YELLOW — exactly the friction buyers feel later. The same core feeds both used-EV routine
            fit scoring and Copart arbitrage analysis.
          </p>
        </section>

        {/* Section: Scoring */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">The Scoring That Actually Matters</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            The heart of the system is RoutineFitScore — six weighted dimensions that directly map to
            daily ownership friction:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              "Charging Stress",
              "Range Buffer",
              "Budget Fit",
              "Recovery Resilience",
              "Climate Friction",
              "Utility Fit",
            ].map((dim) => (
              <div key={dim} className="bg-[#161b22] border border-white/[0.08] rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-medium text-white/70">{dim}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-4">
            <ul className="space-y-2 text-sm text-white/60">
              <li>→ Sigmoid curve for range buffer (eliminates scoring cliffs)</li>
              <li>→ Compound interaction multipliers: winter + street parking + public charging = ×0.91</li>
              <li>→ Explicit uncertainty penalties when data is missing</li>
            </ul>
          </div>

          <p className="text-white/60 text-sm leading-relaxed">
            The final score translates directly into mental-load labels: <span className="text-[#00d97e] font-medium">Great Fit</span> (low load),{" "}
            <span className="text-amber-400 font-medium">Mixed Fit</span> (medium),{" "}
            <span className="text-red-400 font-medium">High Friction</span> (high).
            For Copart lots we add a probabilistic salvage model that outputs ARV, repair cost range,
            recommended bid ceiling, and margin scenarios.
          </p>
        </section>

        {/* Section: Numbers */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">What the Numbers Show So Far</h2>
          <p className="text-white/60 leading-relaxed mb-6">
            Since March 2026 the system has processed 118 receipt checks and 167 Copart auction analyses.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-5 text-center">
              <p className="text-3xl font-black text-[#00d97e]">&lt; 500ms</p>
              <p className="text-xs text-white/40 mt-1">Lite receipt latency</p>
            </div>
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-5 text-center">
              <p className="text-3xl font-black text-white">91%</p>
              <p className="text-xs text-white/40 mt-1">Full AI upgrade success rate</p>
              <p className="text-xs text-white/25 mt-0.5">after Node.js fix in April</p>
            </div>
            <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-5 text-center">
              <p className="text-3xl font-black text-white">36.4%</p>
              <p className="text-xs text-white/40 mt-1">Save rate on full results</p>
            </div>
          </div>

          <div className="bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-xl p-4 text-sm text-white/60 leading-relaxed">
            These aren&apos;t vanity metrics. They show the deterministic-first design keeps the system
            reliable and fast while the LLM layer only augments where it&apos;s safe. The 36.4% save rate
            is an early signal that the outputs are useful enough for buyers to return to.
          </div>
        </section>

        {/* Section: What This Means */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">What This Means for Buyers Right Now</h2>
          <p className="text-white/70 leading-relaxed mb-4">
            The used-EV market is finally offering real choice at lower prices. The difference between
            a great ownership experience and quiet regret often comes down to the exact same signals our
            system surfaces early: battery history gaps, winter buffer realism, and charging access that
            actually matches your routine.
          </p>
          <p className="text-white/70 leading-relaxed mb-4">
            We built this because we got tired of watching thoughtful buyers make expensive decisions
            with incomplete information. The goal was never to replace human judgment — but to give
            people better information so their judgment could be sharper.
          </p>
          <p className="text-white/70 leading-relaxed">
            The system is live at <Link href="/" className="text-[#00d97e] hover:text-[#00c970] transition-colors">offolab.com</Link>.
            If you&apos;re shopping a used EV or evaluating a salvage lot right now, I&apos;d genuinely value your
            feedback on how the analysis matches (or doesn&apos;t match) what you&apos;re seeing in the real world.
          </p>
        </section>

        {/* CTA */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 mb-10">
          <p className="text-sm font-semibold text-white/80 mb-2">
            What&apos;s the one detail that still feels hardest to evaluate when you&apos;re looking at a used EV listing?
          </p>
          <p className="text-sm text-white/50">We read every comment.</p>
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
