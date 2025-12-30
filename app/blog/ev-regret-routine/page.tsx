"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function EVRegretRoutinePost() {
  // Track blog post visits
  useVisitorTracking();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-br from-gray-50 to-blue-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href="/blog"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block"
          >
            ← Back to Blog
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            EV Regret Isn't About Range. It's About Routine.
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>8 min read</span>
            <span>·</span>
            <span>OFFO Labs</span>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none">
          {/* 1. Opening: Kill the Myth */}
          <div className="mb-12">
            <p className="text-xl text-gray-700 leading-relaxed mb-6">
              Modern EVs have more than enough range for most daily driving. A base Model 3 goes
              270 miles. A Chevy Bolt does 250. Even older Nissan Leafs handle 150 miles.
            </p>

            <p className="text-xl text-gray-700 leading-relaxed mb-6">
              Yet people still report frustration. Regret. A sense that "something is off."
            </p>

            <p className="text-xl text-gray-700 leading-relaxed">
              That contradiction is the real signal.
            </p>
          </div>

          {/* 2. What People Call "Range Anxiety" */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              What People Call "Range Anxiety"
            </h2>

            <p className="text-gray-700 leading-relaxed mb-4">
              When someone says they have "range anxiety," they're usually describing something
              else:
            </p>

            <ul className="space-y-3 mb-6">
              <li className="text-gray-700 leading-relaxed">
                <strong>Unreliable charging</strong> — the charger near their apartment is broken
                again
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Shared chargers</strong> — their building has 4 spots for 40 units
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Poor routine fit</strong> — they moved, changed jobs, or had a kid
              </li>
              <li className="text-gray-700 leading-relaxed">
                <strong>Lack of predictability</strong> — they can't count on charging working when
                they need it
              </li>
            </ul>

            <p className="text-gray-700 leading-relaxed">
              The label "range anxiety" makes it sound like the problem is miles. But most regret
              stories don't involve running out of battery. They involve running out of patience
              with the logistics.
            </p>
          </div>

          {/* 3. The Mental Overhead Concept */}
          <div className="mb-12 bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              The Real Difference: Mental Overhead
            </h2>

            <p className="text-gray-700 leading-relaxed mb-4">
              Here's what separates EVs from gas cars at a systems level:
            </p>

            <div className="bg-white p-4 rounded-lg mb-4">
              <p className="font-semibold text-gray-900 mb-2">ICE anxiety is reactive:</p>
              <p className="text-gray-700 italic">
                "I'm low on gas. I need to stop now."
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg mb-6">
              <p className="font-semibold text-gray-900 mb-2">EV anxiety is proactive:</p>
              <p className="text-gray-700 italic">
                "Will charging work this week? Do I need a backup plan?"
              </p>
            </div>

            <p className="text-gray-700 leading-relaxed mb-4">
              Gas stations are fungible. You stop when you need to. One station is roughly the same
              as another.
            </p>

            <p className="text-gray-700 leading-relaxed mb-4">
              EV charging is contextual. Your home charger is fundamentally different from a public
              DC fast charger. Your apartment building's L2 spot is different from your workplace
              charger. They have different speeds, different costs, different availability
              patterns.
            </p>

            <p className="text-gray-700 leading-relaxed font-semibold">
              Predictability matters more than availability.
            </p>

            <p className="text-gray-700 leading-relaxed">
              A charger that exists but you can't count on creates more friction than no charger at
              all. Because you plan around it, and then it fails.
            </p>
          </div>

          {/* 4. Apartment EV Ownership */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Apartment EV Ownership: Nuanced, Conditional
            </h2>

            <p className="text-gray-700 leading-relaxed mb-6 text-lg font-semibold">
              Apartment EV life can work very well. It can also fail badly. The difference is
              conditions, not ideology.
            </p>

            <p className="text-gray-700 leading-relaxed mb-4">
              If you have:
            </p>

            <ul className="space-y-3 mb-6 bg-green-50 p-6 rounded-lg">
              <li className="text-gray-700 leading-relaxed">
                ✓ <strong>Dedicated L2 access</strong> (not shared, not first-come)
              </li>
              <li className="text-gray-700 leading-relaxed">
                ✓ <strong>Backup plan within 10–15 minutes</strong> (reliable DC fast charger
                nearby)
              </li>
              <li className="text-gray-700 leading-relaxed">
                ✓ <strong>Flexible schedule</strong> (can charge mid-day if needed)
              </li>
              <li className="text-gray-700 leading-relaxed">
                ✓ <strong>Tolerance for occasional friction</strong> (broken chargers,
                occupied spots)
              </li>
            </ul>

            <p className="text-gray-700 leading-relaxed mb-4">
              Then apartment EV ownership feels low-friction. People in this situation often love
              their EVs.
            </p>

            <p className="text-gray-700 leading-relaxed mb-4">
              But if you're dealing with:
            </p>

            <ul className="space-y-3 mb-6 bg-orange-50 p-6 rounded-lg">
              <li className="text-gray-700 leading-relaxed">
                ⚠ <strong>Shared L2 spots</strong> (4 chargers, 40 units)
              </li>
              <li className="text-gray-700 leading-relaxed">
                ⚠ <strong>Time windows</strong> ("charging allowed 10pm–6am only")
              </li>
              <li className="text-gray-700 leading-relaxed">
                ⚠ <strong>Rigid obligations</strong> (kids, shift work, caregiving)
              </li>
              <li className="text-gray-700 leading-relaxed">
                ⚠ <strong>No nearby backup</strong> (closest DC charger is 20+ minutes away)
              </li>
            </ul>

            <p className="text-gray-700 leading-relaxed">
              Then charging becomes weekly overhead. You're not just driving—you're managing
              logistics. That mental load compounds over time.
            </p>
          </div>

          {/* 5. The Hidden Skill: Weekly Energy Budgeting */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              The Hidden Skill: Weekly Energy Budgeting
            </h2>

            <p className="text-gray-700 leading-relaxed mb-4">
              Nobody explains this before you buy, but successful EV owners think in weekly
              rhythms, not tank-to-tank.
            </p>

            <div className="bg-gray-50 p-6 rounded-lg mb-6">
              <p className="font-semibold text-gray-900 mb-3">A typical week might look like:</p>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <strong>Sunday night:</strong> Charge to 80% (overnight at home or apartment)
                </li>
                <li>
                  <strong>Monday–Wednesday:</strong> Daily driving uses 30–40 miles/day
                </li>
                <li>
                  <strong>Wednesday evening:</strong> Top-up charge (1–2 hours, gets you to Friday)
                </li>
                <li>
                  <strong>Friday afternoon:</strong> Quick DC session before weekend errands
                </li>
                <li>
                  <strong>Saturday:</strong> Claw-back day (long errands, maybe hit 20% battery)
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed mb-4">
              This is "waterfall charging"—you're cascading energy across the week, not reacting to
              empty.
            </p>

            <p className="text-gray-700 leading-relaxed mb-4">
              People who treat EVs like gas cars—waiting until low, then scrambling—report the most
              frustration. Because they're solving the wrong problem.
            </p>

            <p className="text-gray-700 leading-relaxed font-semibold">
              The skill isn't finding chargers. It's budgeting energy across your actual routine.
            </p>
          </div>

          {/* 6. Why Some People Love EVs and Others Regret Them */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Why Some People Love EVs and Others Regret Them
            </h2>

            <p className="text-gray-700 leading-relaxed mb-6">
              Two people buy the same car in the same city. One loves it. One quietly regrets it.
            </p>

            <p className="text-gray-700 leading-relaxed mb-4">
              The difference isn't:
            </p>

            <ul className="space-y-2 mb-6 text-gray-700">
              <li>❌ Intelligence</li>
              <li>❌ Commitment to EVs</li>
              <li>❌ Environmental values</li>
              <li>❌ Tech-savviness</li>
            </ul>

            <p className="text-gray-700 leading-relaxed mb-4">
              The difference is <strong>routine fit + predictability</strong>.
            </p>

            <p className="text-gray-700 leading-relaxed mb-4">
              Person A has:
            </p>
            <ul className="space-y-2 mb-6 text-gray-700 bg-green-50 p-4 rounded-lg">
              <li>• Home charging that works 95% of the time</li>
              <li>• Backup DC charger 8 minutes away</li>
              <li>• Predictable weekly routine</li>
              <li>• Low sensitivity to 15-minute detours</li>
            </ul>

            <p className="text-gray-700 leading-relaxed mb-4">
              Person B has:
            </p>
            <ul className="space-y-2 mb-6 text-gray-700 bg-orange-50 p-4 rounded-lg">
              <li>• Apartment charger that's available "most of the time"</li>
              <li>• Shift work with rigid start times</li>
              <li>• Kids' school pickup at 3pm sharp</li>
              <li>• Building policy changed twice this year</li>
            </ul>

            <p className="text-gray-700 leading-relaxed mb-4">
              Person A barely thinks about charging. Person B thinks about it every Sunday night.
            </p>

            <p className="text-gray-700 leading-relaxed font-semibold text-lg">
              Neither person is wrong. The fit is different.
            </p>
          </div>

          {/* 7. Soft Product Bridge */}
          <div className="mb-12 bg-gradient-to-r from-purple-50 to-blue-50 p-8 rounded-2xl border-l-4 border-purple-400">
            <p className="text-gray-700 leading-relaxed text-lg">
              We built a simple sanity-check to help people spot these mismatches early.
            </p>
          </div>

          {/* Closing */}
          <div className="pt-8 border-t border-gray-200">
            <p className="text-gray-600 leading-relaxed mb-4">
              This is a living document. We update it as patterns evolve and new insights emerge
              from real users.
            </p>
            <p className="text-gray-600 leading-relaxed">
              If this resonates with your experience—or if we got something wrong—let us know.
            </p>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <Link
              href="/blog"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              ← Back to Blog
            </Link>
          </div>
          <div className="text-gray-500 text-sm text-center sm:text-right">
            <p>OFFO Labs</p>
            <p>Decision intelligence that reduces regret</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
