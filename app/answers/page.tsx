import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "EV Questions Answered — The OFFO FAQ | OFFO",
  description:
    "Straight answers to the most common EV questions: winter range loss, apartment charging, cold-weather models, used EV risks, auction buys, and more.",
  alternates: { canonical: `${SITE_URL}/answers` },
  openGraph: {
    title: "EV Questions Answered — The OFFO FAQ",
    description:
      "Straight answers to the most common EV questions: range, charging, cold weather, used EVs, and auction buys.",
    url: `${SITE_URL}/answers`,
    type: "article",
    siteName: "OFFO",
  },
};

const QA_SECTIONS = [
  {
    section: "Buying a Used EV",
    items: [
      {
        q: "What should I check before buying a used EV?",
        a: "The five things that matter most: (1) State of Health (SoH) — a battery health report from the OBD port tells you actual capacity vs new. (2) Title status — flood and salvage titles mean unknown water damage to the battery pack. (3) Open recalls — check NHTSA by VIN; EV recalls often relate to battery management software. (4) Charging history — frequent DC fast charging accelerates degradation; ask for charging logs if available. (5) Whether it has a heat pump — critical for cold climates. OFFO's receipt tool checks all five automatically when you paste a listing URL.",
      },
      {
        q: "Is a salvage title EV worth buying?",
        a: "Sometimes — but only if you know exactly what was damaged. Salvage EVs from hail or minor front-end collisions can be excellent value. Salvage EVs from flood damage are almost always a bad idea — water intrusion into the battery pack is expensive or impossible to repair. The OFFO Auction Audit scores salvage risk by damage type, so you can tell a hail-damaged Tesla (often safe) from a flood-damaged Leaf (almost never safe).",
      },
      {
        q: "How much does used EV battery degradation cost?",
        a: "Most EV batteries lose 2–3% capacity per year under normal use. A 5-year-old EV with a 250-mile EPA range might deliver 220–235 miles in practice. The cost of this lost range is effectively zero — you don't pay for degradation unless you need replacement, which runs $8,000–$20,000 for most models. At current used EV prices, a 15–20% degraded battery is priced in. Nissan Leafs without active thermal management degrade faster and are the main exception to watch.",
      },
      {
        q: "What years of Tesla Model Y are best to buy used?",
        a: "2021+ Model Y Long Range for cold climates — that's when Tesla added the heat pump. Pre-2021 Model Ys use resistance heating and lose 30–40% more range in winter. Any year of Model Y has excellent battery longevity — 100,000+ miles with under 10% degradation is common. Avoid vehicles from known flood regions (Hurricane Ian Florida inventory, Houston 2022 flooding).",
      },
      {
        q: "Can you buy a used EV at auction (Copart, IAAI)?",
        a: "Yes, and the deals can be significant — salvage EVs sell for 30–60% below clean-title market value. The risk is proportional to damage type. Hail, minor collision, and theft-recovery titles are often viable. Flood and fire titles carry unknown battery pack damage that can cost more to fix than the car is worth. OFFO's Auction Audit analyzes damage type, arbitrage potential, repair cost estimates, and max safe bid for any Copart or IAAI lot number.",
      },
    ],
  },
  {
    section: "Cold Weather & Winter Range",
    items: [
      {
        q: "How much range do EVs lose in winter?",
        a: "Real-world data shows: mild climates (above 30°F) lose 10–15%. Cold climates (10–30°F) lose 20–30%. Extreme cold (below 10°F) can cut range by 35–45%. The biggest factor is cabin heating — resistance heaters draw 4–6 kW continuously. Heat pump models (Tesla Model Y 2021+, Hyundai Ioniq 5/6, Kia EV6, BMW iX) cut heating energy use by 40–60%, retaining significantly more range in cold weather.",
      },
      {
        q: "Which EV has the best range in cold weather?",
        a: "Heat pump models dominate cold-weather performance: Hyundai Ioniq 6, Kia EV6, Tesla Model Y (2021+), BMW iX, and Hyundai Ioniq 5. The Ioniq 6 consistently leads real-world cold-weather tests. For extreme cold (Minneapolis, Buffalo, Anchorage), prioritize heat pump + large battery: Ioniq 6 Long Range, Model Y Long Range, or Ioniq 5 AWD Long Range.",
      },
      {
        q: "What is a winter buffer routine for EVs?",
        a: "A winter buffer routine means starting each week with at least 70–80% charge instead of the 20–80% cycle you'd use in summer. This gives you a reserve for days when cold cuts range more than expected. The full routine: (1) Set weekly minimum charge to 70%. (2) Precondition the battery to 65–70°F before departure while plugged in. (3) Schedule departure time in your EV's app so preconditioning happens on grid power, not battery. (4) Avoid leaving the car unplugged overnight below 20°F.",
      },
      {
        q: "Does extreme cold damage EV batteries permanently?",
        a: "No — cold slows lithium-ion chemistry temporarily but doesn't degrade it permanently. The battery management system (BMS) protects the pack by limiting charge rate and output power in extreme cold. What does cause permanent degradation: repeated fast charging to 100%, deep discharges below 10%, and sustained high heat (Phoenix summers over many years). Cold is inconvenient; heat is the real long-term enemy.",
      },
    ],
  },
  {
    section: "Charging Without a Garage",
    items: [
      {
        q: "Can I own an EV without home charging?",
        a: "Yes, but it requires discipline. The key requirement is reliable access to Level 2 charging near where you park most — workplace, nearby public charger, or a charging-enabled parking garage. In cities like NYC, SF, and Chicago where most residents rent without parking, EV ownership works best for drivers who charge at work or have consistent access to a nearby ChargePoint/Blink station. It's harder but viable for many commuters.",
      },
      {
        q: "What is Level 1 vs Level 2 vs DC fast charging?",
        a: "Level 1 (120V outlet): 3–5 miles of range per hour. Good for overnight in mild climates if you drive under 30 miles/day. Level 2 (240V, 7–11 kW): 15–30 miles per hour. Full overnight charge on most EVs. This is what a home EVSE (Electric Vehicle Supply Equipment) delivers. DC Fast Charging (50–350 kW): 100–200+ miles in 20–40 minutes. This is what you use on road trips or when you need a quick top-up.",
      },
      {
        q: "How much does a Level 2 home charger cost to install?",
        a: "The charger unit itself: $200–$600 (JuiceBox, ChargePoint Home, Grizzl-E are popular). Installation: $300–$1,000 depending on panel capacity and outlet distance. Total: $500–$1,600 typical. Federal tax credits cover 30% up to $1,000 through 2032. Many utilities offer rebates ($100–$500). If your panel needs upgrading, add $1,000–$3,000. Most EV owners pay $700–$1,200 all-in.",
      },
    ],
  },
  {
    section: "EV Fit by City & Climate",
    items: [
      {
        q: "What cities are best for EV ownership?",
        a: "The best EV cities combine mild climate, dense charging infrastructure, and low electricity rates: Seattle, Portland, San Jose, San Francisco, San Diego, and Tacoma lead the country. For cold-climate best-in-class: Boulder/Denver, Burlington VT, and Ann Arbor have strong utility programs that offset winter challenges. The worst EV cities share thin charging networks and extreme temperatures: some rural Great Plains cities and extreme cold markets without strong utility investment.",
      },
      {
        q: "Is Texas a good state for EV ownership?",
        a: "Yes for most Texas metro areas — Austin, Dallas, Houston, and San Antonio all have solid and growing charging infrastructure. ERCOT's deregulated electricity market means EV rate plans vary widely; shop providers for the best off-peak rate. The main Texas-specific concern: the 2021 winter storm proved that extreme cold events (rare but real) can strand EVs with low charge. Standard practice: maintain above 50% during winter storm watches. Normal Texas winters are mild and well-suited to EV ownership.",
      },
      {
        q: "Is Florida good for EVs?",
        a: "Florida is excellent for EV range year-round — near-zero winter range loss and moderate heat. The main Florida-specific concerns: (1) Hurricane preparedness — keep charge above 50% during storm watches and have a plan if power is out for 3+ days. (2) Flood risk — avoid EVs from heavy flood zones (Miami-Dade post-Ian, Houston post-Harvey). FPL, Duke Energy Florida, and TECO have all invested heavily in charging. Florida is consistently one of the top 5 EV markets by volume.",
      },
    ],
  },
  {
    section: "EV Costs & Incentives",
    items: [
      {
        q: "How much does it cost to charge an EV at home?",
        a: "Average US electricity rate is $0.16/kWh (2025). A 75 kWh battery (Tesla Model Y) costs about $12 for a full charge from empty. At 3 miles/kWh efficiency, that's ~225 miles for $12 — roughly $0.05/mile vs $0.12–0.18/mile for a 30 MPG gas car at $3.50/gallon. Annual savings: $1,000–$2,000 for most drivers. Off-peak rates ($0.07–0.10/kWh in many states) cut costs further — program your charger to run between 11pm–6am.",
      },
      {
        q: "What is the federal EV tax credit in 2025?",
        a: "The Inflation Reduction Act provides up to $7,500 for new EVs and $4,000 for used EVs (max 30% of purchase price). Key eligibility rules: income caps ($150K single / $300K married for new; $75K single / $150K married for used), vehicle price caps ($55K cars / $80K trucks and SUVs for new; $25K for used), and manufacturer assembly requirements. The credit is now transferable to dealers as a point-of-sale discount. Check fueleconomy.gov for the current list of qualifying vehicles — it changes as manufacturers adjust sourcing.",
      },
      {
        q: "How long do EV batteries last?",
        a: "Most EV batteries are warranted for 8 years / 100,000 miles to retain at least 70% capacity. Real-world data shows most batteries exceed this significantly. Tesla reports less than 12% degradation at 200,000 miles for Model 3/Y. Chevy Bolt owners have reported under 8% at 100,000 miles. Nissan Leaf (non-e+, without active thermal management) is the outlier — Arizona/Florida Leafs can show 20%+ degradation at 50,000 miles. Heat kills batteries; cold is temporary.",
      },
    ],
  },
  {
    section: "Auction & Salvage EVs",
    items: [
      {
        q: "What does OFFO score on auction reports?",
        a: "OFFO's Auction Audit scores seven risk factors: damage classification (hail vs flood vs collision vs fire), salvage risk (0–100), title status severity, battery pack exposure risk, odometer integrity, arbitrage potential (max safe bid vs current market value), and open NHTSA recalls. The overall OFFO score summarizes these into a single verdict: Green (buy), Yellow (proceed with inspection), or Red (pass). Each factor links to the specific data point from the Copart or IAAI listing.",
      },
      {
        q: "What damage types are safe to buy at auction?",
        a: "Safe: hail damage (exterior only — battery unaffected), minor collision/front-end (if airbags not deployed and frame undamaged), theft recovery with no damage. Risky: side/rear collision (unknown battery exposure), rollover (structural compression), water damage of any kind. Never buy: flood titles on EVs (salt water in battery cells is irreparable), fire titles (thermal runaway can re-ignite during charging), unknown damage type with no photos.",
      },
    ],
  },
];

export default function AnswersPage() {
  const allQA = QA_SECTIONS.flatMap((s) => s.items.map((item) => ({ q: item.q, a: item.a })));

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allQA.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OFFO", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "EV Answers", item: `${SITE_URL}/answers` },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <JsonLd data={faqJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <Link href="/" className="text-xs font-medium text-blue-600 uppercase tracking-wider hover:text-blue-800 transition-colors">
            OFFO
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Answers</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
          EV Questions, Answered
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Straight answers to the most common questions about buying, charging, and owning an electric vehicle.
        </p>

        {/* Sections */}
        {QA_SECTIONS.map((section) => (
          <div key={section.section} className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              {section.section}
            </h2>
            <div className="space-y-3">
              {section.items.map((item, i) => (
                <details
                  key={i}
                  className="group bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors list-none flex items-center justify-between">
                    {item.q}
                    <span className="text-gray-400 group-open:rotate-180 transition-transform ml-3 shrink-0">
                      &#9662;
                    </span>
                  </summary>
                  <div className="px-5 pb-5 pt-1 text-sm text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}

        {/* Internal links */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4">Go deeper</h2>
          <div className="space-y-2">
            <Link href="/local" className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all group">
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">EV ownership by city — 100+ local guides</span>
              <span className="text-gray-400 group-hover:text-blue-500">→</span>
            </Link>
            <Link href="/guides/winter-ev-routine" className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all group">
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">Winter EV Routine Playbook</span>
              <span className="text-gray-400 group-hover:text-blue-500">→</span>
            </Link>
            <Link href="/guides/no-home-charging" className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all group">
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">No Home Charging Survival Guide</span>
              <span className="text-gray-400 group-hover:text-blue-500">→</span>
            </Link>
            <Link href="/guides/used-ev-proof-checklist" className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all group">
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">Used EV Proof Checklist</span>
              <span className="text-gray-400 group-hover:text-blue-500">→</span>
            </Link>
            <Link href="/copart" className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all group">
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">Analyze a Copart or IAAI auction lot</span>
              <span className="text-gray-400 group-hover:text-blue-500">→</span>
            </Link>
          </div>
        </div>

        {/* Tool CTA */}
        <div className="bg-blue-600 rounded-2xl p-6 text-center text-white">
          <h2 className="text-lg font-bold mb-1">Check a specific listing</h2>
          <p className="text-sm text-blue-100 mb-4">Paste any listing URL and get a full AI analysis in under 60 seconds.</p>
          <Link
            href="/receipt"
            className="inline-block bg-white text-blue-700 font-semibold py-2.5 px-6 rounded-xl hover:bg-blue-50 transition-colors text-sm"
          >
            Run OFFO Check →
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          OFFO provides AI-powered analysis for informational purposes only. Not financial, legal, or automotive advice.
        </p>
      </div>
    </div>
  );
}
