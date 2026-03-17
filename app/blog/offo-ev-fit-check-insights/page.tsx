"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function OFFOEVFitInsightsPage() {
  useVisitorTracking();

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
            <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full">
              Data Report
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            Three Months of OFFO: What 286 Real EV Fit Checks Revealed
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>OFFO Lab</span>
            <span>·</span>
            <span>March 17, 2026</span>
            <span>·</span>
            <span>7 min read</span>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Intro */}
        <div className="prose prose-gray max-w-none mb-10">
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            We built OFFO to answer a simple question: does this EV actually fit my life? Three months
            in, we have real data. Not survey data, not focus groups &mdash; behavioral data from people who
            used the tool to evaluate actual listings and map actual routines.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Here&rsquo;s what 286 EV fit checks, 133 deal checker receipts, and 1,000 unique visitors taught
            us about how real people evaluate EVs in 2026.
          </p>
        </div>

        {/* Section 1: By the Numbers */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-5">By the numbers</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-3xl font-bold text-indigo-600 mb-1">3,269</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total visits</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-3xl font-bold text-indigo-600 mb-1">1,000</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Unique visitors</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-3xl font-bold text-indigo-600 mb-1">286</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">EV fit checks</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-3xl font-bold text-indigo-600 mb-1">133</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Deal checker receipts</div>
            </div>
          </div>

          <p className="text-gray-700 leading-relaxed">
            Those 3,269 visits came from people actively in the research phase of an EV purchase &mdash; not
            casual browsers. The 286 fit checks represent people who completed a full routine questionnaire:
            they told us how far they drive on a typical day, their hardest day of the week, whether they
            have home charging access, and what their budget looks like.
          </p>
        </section>

        {/* Section 2: What people are checking */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The vehicles people are actually evaluating</h2>

          <p className="text-gray-700 leading-relaxed mb-5">
            The most-checked vehicles weren&rsquo;t the ones you&rsquo;d expect from a headline EV list. Here&rsquo;s what
            people ran fit checks on most often:
          </p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-5">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Most-checked vehicles</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {[
                { rank: 1, vehicle: "Hyundai Sonata Hybrid", note: "Budget-conscious buyers testing hybrid vs. full EV" },
                { rank: 2, vehicle: "Chevy Bolt EV", note: "High range-per-dollar, strong used market" },
                { rank: 3, vehicle: "Nissan Leaf", note: "Most common used EV in the $12–18k range" },
                { rank: 4, vehicle: "Ford Escape SE Plug-in Hybrid", note: "Commuters with uncertain home charging" },
              ].map((item) => (
                <li key={item.rank} className="px-5 py-4 flex items-start gap-4">
                  <span className="text-lg font-bold text-gray-300 w-6 shrink-0">{item.rank}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{item.vehicle}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{item.note}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-gray-700 leading-relaxed">
            The Sonata Hybrid topping the list is a signal worth paying attention to: a large portion of
            our users are &ldquo;EV-curious&rdquo; but still hedging. They&rsquo;re comparing hybrids and full EVs side by
            side before committing. The Bolt and Leaf entries confirm what we see in the used market &mdash; these
            are the accessible entry points, especially for first-time EV buyers under $20k.
          </p>
        </section>

        {/* Section 3: Questionnaire signals */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What the questionnaire revealed about buyer readiness</h2>

          <p className="text-gray-700 leading-relaxed mb-5">
            The fit check questionnaire has eight fields. Four of them drove virtually all of the variance
            in whether someone got a Good Fit vs. Mixed Fit verdict:
          </p>

          <div className="space-y-3 mb-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-5 py-4">
              <div className="font-semibold text-blue-900 mb-1">1. Body style preference</div>
              <div className="text-sm text-blue-800">
                Most users filtered hard on SUV vs. sedan early. People who came in open to either
                converted at significantly higher rates &mdash; they were more decision-ready.
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-5 py-4">
              <div className="font-semibold text-blue-900 mb-1">2. Home charging access</div>
              <div className="text-sm text-blue-800">
                This was the single biggest predictor of fit verdict. Users with a garage or driveway
                outlet got Good Fit on almost every full EV they checked. Users without reliable home
                charging tended toward Mixed Fit regardless of range.
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-5 py-4">
              <div className="font-semibold text-blue-900 mb-1">3. Hardest day of the week pattern</div>
              <div className="text-sm text-blue-800">
                &ldquo;How far do you drive on your longest day?&rdquo; separated casual commuters from high-mileage
                edge cases. Several users with 100+ mile hardest-day patterns received Mixed Fit verdicts
                on vehicles that covered their average just fine.
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-5 py-4">
              <div className="font-semibold text-blue-900 mb-1">4. Budget band</div>
              <div className="text-sm text-blue-800">
                Budget anchored which vehicles got evaluated. Sub-$20k users clustered around the Leaf
                and Bolt. $25–35k users explored Bolt EUV, Ioniq 5, and ID.4. Very few people entered
                a budget and then checked vehicles outside it.
              </div>
            </div>
          </div>

          <p className="text-gray-700 leading-relaxed">
            The takeaway: EV fit is less about range anxiety and more about three practical anchors &mdash;
            where you charge, how bad your worst day is, and what you can actually spend. The questionnaire
            structure reflects this, and the data confirms it holds.
          </p>
        </section>

        {/* Section 4: Feedback */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What users said</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
              <div className="text-4xl font-bold text-green-600 mb-1">4.5<span className="text-2xl text-gray-400">/5</span></div>
              <div className="text-sm text-gray-500 font-medium">Average rating</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
              <div className="text-4xl font-bold text-green-600 mb-1">87.5<span className="text-2xl text-gray-400">%</span></div>
              <div className="text-sm text-gray-500 font-medium">Would recommend</div>
            </div>
          </div>

          <p className="text-gray-700 leading-relaxed mb-4">
            We didn&rsquo;t prompt users for feedback &mdash; the rating prompt appears naturally at the end of the
            fit check flow. The 87.5% recommendation rate is particularly meaningful because it came from
            people who got Mixed Fit verdicts too, not just Good Fit. The tool told them something useful
            even when the answer wasn&rsquo;t a clean yes.
          </p>

          <div className="bg-green-50 border border-green-100 rounded-lg px-5 py-4">
            <p className="text-sm text-green-900 italic">
              &ldquo;It actually made me reconsider the Bolt. I thought range was the issue but OFFO flagged
              that my Tuesday commute pattern was the real variable. That changed how I looked at the
              problem.&rdquo;
            </p>
            <p className="text-xs text-green-700 mt-2 font-medium">— User feedback, February 2026</p>
          </div>
        </section>

        {/* Section 5: The Garage gap */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The signal we didn&rsquo;t expect: the Garage gap</h2>

          <p className="text-gray-700 leading-relaxed mb-4">
            Here&rsquo;s the number that surprised us: <strong>2 listings saved to My Garage</strong>.
          </p>

          <p className="text-gray-700 leading-relaxed mb-4">
            286 fit checks. 133 receipts. 2 saves. That&rsquo;s a 0.7% save rate on a feature designed to be
            a core retention mechanism.
          </p>

          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg px-5 py-4 mb-5">
            <p className="text-sm text-amber-900 font-medium mb-1">What this tells us</p>
            <p className="text-sm text-amber-800">
              Users aren&rsquo;t failing to find value &mdash; they&rsquo;re finishing the flow and closing the tab before
              saving becomes compelling. The save action is optional and buried. Most users don&rsquo;t understand
              what &ldquo;My Garage&rdquo; gets them until they&rsquo;ve already left.
            </p>
          </div>

          <p className="text-gray-700 leading-relaxed">
            This is a UX problem, not a product problem. The fit check and receipt generate real value &mdash;
            the feedback confirms it. But we never convert that value into a reason to return. Every completed
            fit check should end with a clear save-or-share moment, not a passive option buried in the UI.
          </p>
        </section>

        {/* Section 6: What's next */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What we&rsquo;re doing about it</h2>

          <p className="text-gray-700 leading-relaxed mb-4">
            Two changes are rolling out based directly on this data:
          </p>

          <div className="space-y-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
              <div className="font-semibold text-gray-900 mb-1">Email nudge sequence</div>
              <div className="text-sm text-gray-600">
                Users who complete a fit check can now opt in to a 3-email sequence: a Day 1 summary of
                their result, a Day 3 prompt to compare a second option, and a Day 7 reminder to save their
                scenario to My Garage. Each email delivers something genuinely useful, not just a re-engagement ping.
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
              <div className="font-semibold text-gray-900 mb-1">Save-to-Garage prompt at flow completion</div>
              <div className="text-sm text-gray-600">
                The fit check results page will surface a direct save CTA before users leave. The current
                flow ends without a natural next step &mdash; that&rsquo;s what we&rsquo;re fixing. No account required, just
                one click.
              </div>
            </div>
          </div>

          <p className="text-gray-700 leading-relaxed">
            The broader lesson: 286 people trusted OFFO with a real decision. The data says we gave them
            something useful. Now we need to give them a reason to come back to it.
          </p>
        </section>

        {/* CTA */}
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-7 mb-10 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Run your own EV fit check</h3>
          <p className="text-gray-600 text-sm mb-5 max-w-md mx-auto">
            Answer 8 questions about your routine and get a personalized fit verdict for any EV you&rsquo;re
            considering &mdash; including the ones in this data set.
          </p>
          <Link
            href="/routine"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
          >
            Start my fit check →
          </Link>
        </div>

        {/* Related */}
        <div className="border-t border-gray-200 pt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Related reading</h3>
          <div className="space-y-3">
            <Link
              href="/blog/ev-regret-routine"
              className="block text-indigo-600 hover:text-indigo-800 font-medium text-sm"
            >
              EV Regret Isn&rsquo;t About Range. It&rsquo;s About Routine. →
            </Link>
            <Link
              href="/blog/used-ev-buying-checklist"
              className="block text-indigo-600 hover:text-indigo-800 font-medium text-sm"
            >
              Used EV Buying Checklist: 10 Things to Check Before You Buy →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-10 text-center text-gray-500 text-sm border-t border-gray-200 mt-4">
        <p>OFFO Labs &middot; Building decision intelligence that reduces regret</p>
        <p className="mt-2">
          <Link href="/blog" className="text-indigo-600 hover:text-indigo-700">
            ← All posts
          </Link>
        </p>
      </footer>
    </div>
  );
}
