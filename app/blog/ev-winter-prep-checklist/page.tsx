"use client";

import Link from "next/link";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function EvWinterPrepChecklist() {
  useVisitorTracking();

  const checklist = [
    {
      n: 1,
      title: "Set your minimum charge level to 70%",
      detail: "In summer, cycling 20–80% is best for battery longevity. In winter, start each week above 70% — this is your buffer against unexpected cold days that cut range 25–35%.",
    },
    {
      n: 2,
      title: "Enable departure preconditioning",
      detail: "Every major EV has a departure time scheduler. Set it so the cabin reaches 65–70°F while still plugged in. This keeps the heat draw on grid power rather than battery, recovering 20–30 miles of effective range on cold mornings.",
    },
    {
      n: 3,
      title: "Check your 12V auxiliary battery",
      detail: "Cold weather is harsh on 12V batteries, and EV 12V batteries die just like gas car batteries. A dead 12V strands you even if your traction battery is full. Most EVs will show a 12V warning — if yours is over 3 years old, have it tested.",
    },
    {
      n: 4,
      title: "Verify your home charger works in the cold",
      detail: "Level 2 EVSEs are rated for outdoor use, but cable connectors and cable stiffness can be an issue in extreme cold. Test your charger at -10°F if you live in a cold climate before you actually need it at -10°F.",
    },
    {
      n: 5,
      title: "Download offline maps for your EV app",
      detail: "Cellular connectivity in rural cold areas can be spotty. If your EV uses an app for remote preconditioning or charging status, make sure it has offline capability, or note the car&apos;s own display menus for manual control.",
    },
    {
      n: 6,
      title: "Recalibrate your range expectations",
      detail: "Your car&apos;s range display is calibrated for average conditions. In 15°F weather, subtract 25–35% from whatever it shows. Practice this mental math now so it&apos;s automatic in February.",
    },
    {
      n: 7,
      title: "Pack a cold-weather emergency kit",
      detail: "Jumper cables won&apos;t help a dead traction battery, but a portable charger, warm blanket, hand warmers, and an emergency contact for roadside assist are worth having. AAA now offers EV mobile charging trucks in most metros.",
    },
    {
      n: 8,
      title: "Check tire pressure — it drops in cold",
      detail: "Tires lose about 1 PSI per 10°F temperature drop. Underinflated tires add rolling resistance, cutting range 2–5% in addition to the cold-weather penalty. Check and inflate to spec as temperatures drop.",
    },
    {
      n: 9,
      title: "Know your heat pump status",
      detail: "Heat pump models (Tesla Model Y 2021+, Ioniq 5/6, EV6, BMW iX) retain significantly more range in cold. If you don&apos;t have a heat pump, your resistance heater draws 4–6 kW — on a cold commute, this is the biggest range consumer. Plan accordingly.",
    },
    {
      n: 10,
      title: "Find your nearest public DC fast charger",
      detail: "Know your backup charging location before you need it. For most cold-climate drivers: one nearby DC fast charger, one nearby Level 2 at a shopping center. Add them to favorites in your car&apos;s nav system now.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-br from-blue-50 to-sky-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/blog" className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-4 inline-block">
            ← Back to Blog
          </Link>
          <div className="mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">Checklist</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Winter EV Prep: 10 Things to Do Before the First Frost
          </h1>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <span>7 min read</span>
            <span>·</span>
            <span>March 10, 2026</span>
            <span>·</span>
            <span>OFFO Lab</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="text-xl leading-relaxed mb-8">
            Cold weather cuts EV range by 20–40%. This is not a design flaw — it&apos;s electrochemistry. Lithium-ion cells slow down in the cold, and resistance heaters draw 4–6 kW to heat the cabin. The result: your 250-mile EV delivers 160 miles on a 10°F January morning.
          </p>
          <p className="leading-relaxed mb-10">
            Most of this is recoverable with the right habits. These 10 steps, done once before winter, prevent the majority of cold-weather EV surprises.
          </p>

          <div className="space-y-4 mb-12">
            {checklist.map((item) => (
              <div key={item.n} className="flex gap-4 bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
                  {item.n}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">{item.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">The One Habit That Makes the Biggest Difference</h2>
          <p className="leading-relaxed mb-6">
            Departure preconditioning. Every major EV has it. Fewer than 30% of owners use it consistently. It takes 2 minutes to set up and recovers 20–30 miles of effective range every cold morning — on grid power, not battery power. Set it tonight.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-8">
            <p className="font-semibold text-blue-800 mb-1">See the full Winter EV Routine guide</p>
            <p className="text-sm text-blue-700 mb-3">The OFFO Winter EV Routine Playbook goes deeper on buffer routines, preconditioning scheduling, and cold-climate model comparisons.</p>
            <Link href="/guides/winter-ev-routine" className="inline-block bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Read the Playbook →
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
