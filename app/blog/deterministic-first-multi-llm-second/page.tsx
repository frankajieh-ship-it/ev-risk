import Link from "next/link";
import MermaidDiagram from "@/components/MermaidDiagram";
import {
  getReceiptPipelineDiagram,
  getAuctionPipelineDiagram,
  getRoutineFitDiagram,
} from "@/lib/content/diagram-export";
import {
  generateReceiptExample,
  generateRoutineExample,
} from "@/lib/content/scenario-generator";

export default function DeterministicFirstPage() {
  // Server-side: call pure synchronous generators at render time
  const receiptExample = generateReceiptExample("edge_case");
  const routineExample = generateRoutineExample("simple");

  const receiptDiagram = getReceiptPipelineDiagram();
  const auctionDiagram = getAuctionPipelineDiagram();
  const routineDiagram = getRoutineFitDiagram();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link
            href="/blog"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block"
          >
            ← Back to OFFO Labs Blog
          </Link>
          <div className="mb-3">
            <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full">
              Engineering
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            Deterministic First, Multi-LLM Second: How OFFO&rsquo;s Deal Intelligence Pipeline Works
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>OFFO Engineering</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>14 min read</span>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Section 1: Introduction */}
        <div className="prose prose-gray max-w-none mb-10">
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            When someone pastes a $42,000 used EV listing into OFFO at 11pm on a Sunday, they
            want a verdict in under two seconds — not a spinner for 30 seconds while three AI models
            deliberate. But they also want the analysis to be right.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            These two goals appear to be in tension. They&rsquo;re not, if you sequence the pipeline correctly.
          </p>
          <p className="text-gray-700 leading-relaxed">
            This post describes how OFFO&rsquo;s deal intelligence pipeline works: a deterministic rule engine
            that produces a full, meaningful receipt in under 500ms, followed by an asynchronous three-model
            AI chain that upgrades it in the background. The user never sees a loading state for the AI.
          </p>
        </div>

        {/* Section 2: The Two-Layer Architecture */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The two-layer architecture</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Every OFFO receipt is generated twice. The first generation is instant and deterministic.
            The second is async and AI-powered.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Layer 1 — Lite Receipt</div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>~150 deterministic rule patterns</li>
                  <li>Negation-aware regex extraction</li>
                  <li>Hard blocker detection</li>
                  <li>Fit score + evidence score</li>
                  <li className="font-semibold text-green-700">Returns in &lt; 500ms</li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Layer 2 — AI Upgrade (async)</div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>Grok: damage classification + tone</li>
                  <li>Gemini: routine impact + owner translation</li>
                  <li>GPT-4o: repair cost breakdown (skipped when not needed)</li>
                  <li>Max 3 model calls enforced</li>
                  <li className="font-semibold text-blue-700">15-minute background budget</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="text-gray-700 leading-relaxed">
            The key insight: the deterministic layer is not a placeholder. It produces a real,
            actionable verdict based on signals that AI frequently gets wrong anyway — title status,
            accident history, service records. These facts don&rsquo;t require inference. They require pattern
            matching, and pattern matching is fast.
          </p>
        </section>

        {/* Section 3: Receipt Pipeline Diagram */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Receipt pipeline</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            Here&rsquo;s the full receipt pipeline from POST to response, including the background AI upgrade
            path. The client gets Layer 1 synchronously; Layer 2 streams back via polling on{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">generation_status</code>.
          </p>
          <MermaidDiagram diagram={receiptDiagram} id="receipt-pipeline" />
        </section>

        {/* Section 4: The Signal Extraction Engine */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Signal extraction: negation-aware pattern matching</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The most important design decision in the rule engine is negation awareness. A listing that
            says &ldquo;no frame damage&rdquo; is categorically different from one that says &ldquo;frame damage.&rdquo;
            Early versions of GPT-based extractors failed this test regularly.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            Each signal pattern carries both a positive match and an optional negation override:
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm mb-4">
            <code>{`// lib/receipt-signal-extractor.ts
const HARD_BLOCKER_PATTERNS: SignalPattern[] = [
  {
    signalId: "frame_damage_major",
    positive: [/\\b(frame\\s+damage|structural\\s+damage|unibody\\s+damage)\\b/],
    negation: [/\\b(no\\s+frame\\s+damage|no\\s+structural\\s+damage)\\b/],
  },
];

// Negation is checked first — if the negation regex matches,
// the positive match is discarded even if it also fires.`}
            </code>
          </pre>
          <p className="text-gray-700 leading-relaxed mb-4">
            This matters for listings that use softening language: &ldquo;fully repaired flood vehicle&rdquo; still
            triggers <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">title_salvage</code> via
            structured field extraction, even if the listing text tries to minimize it.
          </p>

          {/* Live example from scenario generator */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-4">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
              Live example — generated by scenario-generator.ts at build time
            </div>
            <div className="text-sm font-semibold text-gray-800 mb-1">{receiptExample.title}</div>
            <p className="text-sm text-gray-600 mb-4">{receiptExample.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold text-gray-700 mb-1">Input signals detected ({receiptExample.output.signal_count})</div>
                <ul className="space-y-0.5 text-gray-600 font-mono text-xs">
                  {receiptExample.output.signals.slice(0, 6).map((s) => (
                    <li key={s} className="truncate">· {s}</li>
                  ))}
                  {receiptExample.output.signals.length > 6 && (
                    <li className="text-gray-400">+ {receiptExample.output.signals.length - 6} more</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-gray-700 mb-1">Scoring result</div>
                <div className="space-y-1 text-xs">
                  <div>Verdict: <span className={`font-bold ${receiptExample.output.scoring.verdict === "RED" ? "text-red-600" : receiptExample.output.scoring.verdict === "GREEN" ? "text-green-600" : "text-yellow-600"}`}>{receiptExample.output.scoring.verdict}</span></div>
                  <div>Fit score: <span className="font-mono">{receiptExample.output.scoring.fit_score}</span></div>
                  <div>Evidence score: <span className="font-mono">{receiptExample.output.scoring.evidence_score}</span></div>
                  <div>Hard blocker: <span className="font-mono">{receiptExample.output.scoring.hard_blocker_hit ? "YES" : "no"}</span></div>
                </div>
              </div>
            </div>
          </div>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm">
            <code>{JSON.stringify(receiptExample.output.scoring, null, 2)}</code>
          </pre>
        </section>

        {/* Section 5: The Auction AI Chain */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The auction AI chain: three models, max three calls</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The auction pipeline is more AI-intensive than the receipt pipeline because auction lots
            don&rsquo;t have structured fields — we&rsquo;re working from raw listing text, copart photos, and VIN lookups.
            But we still enforce a hard cap: maximum three meaningful model calls per request.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            The routing logic is encoded in{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">canSkipRepairCost()</code>:
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm mb-4">
            <code>{`// lib/auction/auction-ai-chain.ts
function canSkipRepairCost(
  metrics: DeterministicMetrics,
  arv: number | null,
  isPaid: boolean
): boolean {
  // Only skip when damage is confirmed minor AND we have real damage data
  // (not a data-absent default) — source_confidence: "low" means skip is unsafe
  if (
    metrics.damage_severity_baseline === "minor" &&
    arv !== null &&
    metrics.source_confidence !== "low"
  ) return true;
  return false;
}`}
            </code>
          </pre>
          <p className="text-gray-700 leading-relaxed mb-4">
            When the skip fires, GPT-4o is never called. Gemini handles routine impact in parallel with
            a skipped repair cost slot, and Grok runs the final polish. Total: 2 calls. When the skip
            doesn&rsquo;t fire (severe damage, unknown ARV, low source confidence), all three stages run —
            GPT-4o and Gemini run in parallel at step 2, Grok finalizes at step 3.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            Each step is logged as an <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">AiStepLog</code>:
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm mb-6">
            <code>{`export interface AiStepLog {
  step: string;
  model: string;
  status: "success" | "failed" | "skipped" | "cancelled";
  latency_ms: number;
  error?: string;
}`}
            </code>
          </pre>
          <MermaidDiagram diagram={auctionDiagram} id="auction-pipeline" />
        </section>

        {/* Section 6: Routine Fit Scoring */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Routine fit: six dimensions, one sigmoid</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The routine fit engine is the most mathematically interesting part of OFFO. It converts a
            user&rsquo;s daily driving pattern into a 0&ndash;100 score across six weighted dimensions. No AI is
            involved — it&rsquo;s a pure function.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            The range buffer dimension (25% weight) uses a logistic sigmoid instead of piecewise linear
            buckets. This eliminates the cliff problem where a user at 59% range usage scores dramatically
            differently from one at 61%:
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm mb-4">
            <code>{`// lib/compute-routine-fit.ts — Phase 4A: sigmoid range buffer
// Centered at 62% usage. Approximate values:
//   0%  → 100   30% → ~96   50% → ~82   60% → ~68
//  70%  → ~50   80% → ~31   90% → ~17  100% →  ~8

function rangeScoreFromUsagePct(usagePct: number): number {
  const pct = Math.max(0, Math.min(100, usagePct));
  // Logistic sigmoid: 100 / (1 + e^(k*(pct - center)))
  const raw = 100 / (1 + Math.exp(0.085 * (pct - 62)));
  return Math.max(5, Math.round(raw));
}`}
            </code>
          </pre>
          <p className="text-gray-700 leading-relaxed mb-4">
            Cross-dimension multipliers apply after individual scoring. The catastrophic failure zone
            collapses the final score when routine is near-unworkable:
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm mb-6">
            <code>{`// Catastrophic zone: usage > 90% OR (public charging + poor density)
// × 0.85 collapse multiplier applied to weighted sum

// Compound checks (non-catastrophic):
// × 0.91 — low charging + cold climate street parking
// × 0.93 — public charging + high mileage
// × 0.95 — shared charger + long commute`}
            </code>
          </pre>

          {/* Live routine example */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">
              Live example — {routineExample.title}
            </div>
            <p className="text-sm text-gray-600 mb-4">{routineExample.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white rounded-lg border border-green-200 p-3">
                <div className="text-2xl font-bold text-green-700">{routineExample.output.fit.score_0_100}</div>
                <div className="text-xs text-gray-500 mt-1">Score</div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-3">
                <div className="text-sm font-bold text-green-700">{routineExample.output.fit.label}</div>
                <div className="text-xs text-gray-500 mt-1">Label</div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-3">
                <div className="text-sm font-bold text-gray-700">{routineExample.output.fit.mental_load}</div>
                <div className="text-xs text-gray-500 mt-1">Mental load</div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-3">
                <div className="text-sm font-bold text-gray-700">
                  {(routineExample.output.fit.failure_probability * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Failure prob.</div>
              </div>
            </div>
            {routineExample.output.fit.dimensions && (
              <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                {Object.entries(routineExample.output.fit.dimensions).map(([dim, score]) => (
                  <div key={dim} className="bg-white rounded border border-gray-200 p-2">
                    <div className="text-sm font-bold text-gray-800">{score}</div>
                    <div className="text-xs text-gray-400 capitalize">{dim}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <MermaidDiagram diagram={routineDiagram} id="routine-pipeline" />
        </section>

        {/* Section 7: Why Not AI-First */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why not AI-first?</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The original OFFO prototype was AI-first. A single GPT-4 call received the listing text
            and returned a structured receipt. It was slow (8&ndash;18 seconds), expensive ($0.04&ndash;0.12 per call),
            and wrong in predictable ways.
          </p>
          <div className="space-y-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="font-semibold text-red-800 mb-1">Problem 1: Factual signals are not inference problems</div>
              <p className="text-sm text-gray-700">
                &ldquo;Salvage title&rdquo; in a listing is not ambiguous. It doesn&rsquo;t require reasoning — it requires reading.
                A regex finds it in 0.1ms. GPT-4 occasionally missed it when buried in dense listing text.
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="font-semibold text-red-800 mb-1">Problem 2: Negation failures</div>
              <p className="text-sm text-gray-700">
                &ldquo;No frame damage&rdquo; would sometimes be parsed as frame damage being mentioned. The rule engine
                checks the negation pattern first and short-circuits — eliminating this class of error entirely.
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="font-semibold text-red-800 mb-1">Problem 3: Timeout cascades</div>
              <p className="text-sm text-gray-700">
                A single model timeout left the user with an error page. The deterministic layer means
                users always get a real receipt — AI upgrades it when available, but the receipt exists
                immediately regardless.
              </p>
            </div>
          </div>
          <p className="text-gray-700 leading-relaxed">
            The deterministic layer handles the 80% of the signal space that doesn&rsquo;t require inference.
            The AI chain handles the 20% that does: nuanced damage tone, routine lifestyle translation,
            repair cost breakdown when ARV is unknown.
          </p>
        </section>

        {/* Section 8: Debug Tracing */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Observability: opt-in pipeline tracing</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            To instrument the pipeline for debugging without affecting production latency, we added an
            opt-in trace system. Pass <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">debug_trace: true</code> in
            the request body and the pipeline captures timings and step logs, then persists them
            to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">pipeline_traces</code> via
            a fire-and-forget write.
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-5 overflow-x-auto text-sm mb-4">
            <code>{`// lib/debug-trace.ts
export interface PipelineTrace {
  trace_id: string;
  pipeline: "receipt" | "auction" | "routine";
  created_at: string;
  total_latency_ms: number;
  steps: PipelineStep[];
  timings: Record<string, number>;
  meta: Record<string, unknown>;
}

// In route.ts — zero cost when disabled
const debugEnabled = body.debug_trace === true;
const trace = debugEnabled ? createTrace("receipt") : null;

// Before return:
if (trace) {
  finalizeTrace(trace, { verdict, fit_score, signal_count });
  persistTrace(trace); // fire-and-forget — never blocks response
}`}
            </code>
          </pre>
          <p className="text-gray-700 leading-relaxed">
            Traces are retrievable via{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">GET /api/admin/trace/:traceId</code>{" "}
            (admin key required). This lets us replay a user&rsquo;s exact pipeline run for debugging without
            any live-traffic impact.
          </p>
        </section>

        {/* Section 9: What's Next */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What&rsquo;s next</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The two-layer pattern has proven stable. The areas we&rsquo;re actively improving:
          </p>
          <ul className="space-y-3 text-gray-700 mb-6">
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold mt-0.5">→</span>
              <span>
                <strong>ARV resolution pipeline:</strong> The four-phase ARV chain (listing comparables →
                VIN decode → depreciation curve → AI fallback) is the highest-variance component.
                Improving P1 and P2 hit rates lets us skip GPT-4o more often.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold mt-0.5">→</span>
              <span>
                <strong>Rule pattern expansion:</strong> The ~150-pattern signal set was built from
                analyzing real listing text. We continue adding patterns as we see new seller language
                patterns in production data.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold mt-0.5">→</span>
              <span>
                <strong>Routine fit calibration:</strong> The sigmoid center (62%) and multiplier values
                (0.85, 0.91, 0.93, 0.95) were set analytically. We&rsquo;re building a feedback loop to
                calibrate them against real EV owner satisfaction data.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold mt-0.5">→</span>
              <span>
                <strong>Trace-driven content:</strong> The scenario generator in{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">lib/content/scenario-generator.ts</code>{" "}
                calls real functions and embeds live outputs into blog posts at build time — which means
                this post updates automatically when the scoring engine changes.
              </span>
            </li>
          </ul>
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-6">
            <p className="text-gray-700 leading-relaxed">
              The core principle behind all of this: be deterministic wherever determinism is possible.
              Reserve inference for the genuinely ambiguous. Move the inference off the critical path.
              The result is a system that is faster, cheaper, and more predictable than an AI-first approach
              — and more reliable when models have outages or rate limits.
            </p>
          </div>
        </section>

        {/* Footer nav */}
        <div className="border-t border-gray-200 pt-8 flex items-center justify-between">
          <Link href="/blog" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            ← All posts
          </Link>
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            Try OFFO →
          </Link>
        </div>
      </main>
    </div>
  );
}
