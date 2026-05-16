import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const VALUE_PROPS = [
  {
    icon: "👥",
    title: "Know your buyer before they walk in",
    body: "See anonymized, high-intent buyer profiles actively researching vehicles in your inventory. Filter by make, model, fit score, and metro area.",
  },
  {
    icon: "📊",
    title: "Real market pricing intelligence",
    body: "Get suggested low, target, and high prices for every vehicle in your inventory — computed from live comparable listings, not stale book values.",
  },
  {
    icon: "✅",
    title: "OFFO-verified inventory badge",
    body: "Listings in the OFFO dealer network display a verified badge to buyers running risk checks — building trust before first contact.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Apply",
    body: "Submit your dealership details. Takes under 2 minutes.",
  },
  {
    number: "02",
    title: "Get approved",
    body: "Our team reviews applications within 1 business day and sends a confirmation email.",
  },
  {
    number: "03",
    title: "Access your dashboard",
    body: "Log in to your dealer workspace — manage inventory, view buyer demand, and track your funnel.",
  },
];

const KPI_CARDS = [
  { label: "High-intent buyers this week", value: "—", sub: "researching your inventory" },
  { label: "Inventory match score", value: "—", sub: "avg. buyer–vehicle fit" },
  { label: "Avg. days on lot", value: "—", sub: "across active inventory" },
  { label: "Funnel", value: "Views → Reports → Receipts", sub: "full buyer journey visibility" },
];

export default function ForDealersPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <Header variant="homepage" />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-full text-[#00d97e] text-xs font-semibold mb-6">
          OFFO for Dealers
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5 leading-tight">
          Know your EV buyer
          <br />
          <span className="text-[#00d97e]">before they walk in.</span>
        </h1>
        <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
          OFFO gives EV dealerships anonymized buyer demand data, real-time pricing
          intelligence, and verified inventory listings — so you spend less time guessing
          and more time closing.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dealers/join"
            className="px-6 py-3 bg-[#00d97e] text-[#0d1117] font-semibold rounded-xl hover:bg-[#00f090] transition-colors text-sm"
          >
            Apply for dealer access
          </Link>
          <a
            href="#how"
            className="px-6 py-3 bg-white/[0.06] border border-white/[0.10] text-white/70 font-semibold rounded-xl hover:bg-white/[0.10] transition-colors text-sm"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid sm:grid-cols-3 gap-4">
          {VALUE_PROPS.map((prop) => (
            <div
              key={prop.title}
              className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6"
            >
              <div className="text-3xl mb-4">{prop.icon}</div>
              <h3 className="font-semibold text-white mb-2 text-[0.9375rem] leading-snug">
                {prop.title}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed">{prop.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-6">
            Dealer dashboard preview
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_CARDS.map((card) => (
              <div
                key={card.label}
                className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4"
              >
                <p className="text-xs text-white/40 mb-2 leading-snug">{card.label}</p>
                <p className="text-xl font-bold text-white mb-1">{card.value}</p>
                <p className="text-xs text-white/30">{card.sub}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/25 mt-4 text-center">
            Live data shown after approval — KPIs computed from real buyer activity on OFFO
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col gap-3">
              <span className="text-[#00d97e] font-bold text-sm font-mono">{step.number}</span>
              <h3 className="font-semibold text-white text-[0.9375rem]">{step.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-24 text-center">
        <div className="bg-[#00d97e]/[0.06] border border-[#00d97e]/20 rounded-2xl p-10">
          <h2 className="text-2xl font-bold mb-3">Ready to grow your EV business?</h2>
          <p className="text-white/50 text-sm mb-8 max-w-md mx-auto leading-relaxed">
            Join the OFFO dealer network. Free to apply — approved dealerships get full
            access to the buyer intelligence dashboard.
          </p>
          <Link
            href="/dealers/join"
            className="inline-block px-7 py-3.5 bg-[#00d97e] text-[#0d1117] font-semibold rounded-xl hover:bg-[#00f090] transition-colors text-sm"
          >
            Apply for dealer access
          </Link>
          <p className="text-xs text-white/25 mt-4">
            Reviewed within 1 business day · No credit card required
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
