import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/content/guides";
import type { SeoPageContent } from "@/content/types";
import PageTracker from "@/components/PageTracker";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "EV Guides — Charging, Winter, Budget & More | OFFO",
  description:
    "Practical EV guides covering no-home charging, winter range, budget EVs, and used EV buying. Built from real ownership patterns.",
  alternates: {
    canonical: "https://offolab.com/guides",
  },
  openGraph: {
    title: "EV Guides | OFFO",
    description:
      "Practical guides for EV buyers and owners — charging without a garage, winter routines, budget picks, and used EV checklists.",
    url: "https://offolab.com/guides",
    siteName: "OFFO",
  },
};

const PILLARS: {
  id: string;
  label: string;
  description: string;
  slug: string;
  accent: string;
  badge: string;
}[] = [
  {
    id: "no-home-charging",
    label: "No Home Charging",
    description:
      "How to own an EV without a garage — apartment strategies, workplace charging, and weekly plans.",
    slug: "no-home-charging",
    accent: "blue",
    badge: "Charging",
  },
  {
    id: "winter-ev-routine",
    label: "Winter EV Routine",
    description:
      "Cold-weather range, preconditioning, buffer rules, and which models handle winter best.",
    slug: "winter-ev-routine",
    accent: "indigo",
    badge: "Winter",
  },
  {
    id: "budget-evs",
    label: "Budget EVs",
    description:
      "Which EVs under $25K actually work — by model, range, and real-world use case.",
    slug: "budget-evs",
    accent: "green",
    badge: "Budget",
  },
  {
    id: "used-ev-proof-checklist",
    label: "Used EV Checklist",
    description:
      "Battery health, recall status, charging history — 10 checks before you buy a used EV.",
    slug: "used-ev-proof-checklist",
    accent: "amber",
    badge: "Used EV",
  },
];

const accentMap: Record<string, { badge: string; heading: string; link: string; dot: string }> = {
  blue: {
    badge: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    heading: "text-blue-300",
    link: "text-blue-400 hover:text-blue-300",
    dot: "bg-blue-500/40",
  },
  indigo: {
    badge: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20",
    heading: "text-indigo-300",
    link: "text-indigo-400 hover:text-indigo-300",
    dot: "bg-indigo-500/40",
  },
  green: {
    badge: "bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/20",
    heading: "text-[#00d97e]",
    link: "text-[#00d97e] hover:text-[#00f090]",
    dot: "bg-[#00d97e]/40",
  },
  amber: {
    badge: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    heading: "text-amber-300",
    link: "text-amber-400 hover:text-amber-300",
    dot: "bg-amber-500/40",
  },
};

function getSupportingGuides(pillarId: string): SeoPageContent[] {
  return Object.values(guides).filter(
    (g) => g.pillar === pillarId && g.slug !== pillarId
  );
}

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      <PageTracker event="guides_page_viewed" />
      <Header variant="homepage" />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-4 pt-14 pb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3 leading-tight">
            EV Guides
          </h1>
          <p className="text-white/55 text-lg leading-relaxed">
            Practical guides built from real EV ownership patterns — not spec sheets. Each pillar covers one major decision area.
          </p>
        </section>

        <div className="max-w-3xl mx-auto px-4 pb-20">
          {/* EV Fit CTA */}
          <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-6 mb-10">
            <h2 className="text-base font-bold text-white mb-1">
              Not sure which guide applies to you?
            </h2>
            <p className="text-sm text-white/50 mb-4">
              Answer 8 questions about your commute and charging situation — get a personalized EV fit score.
            </p>
            <Link
              href="/routine"
              className="inline-block bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] font-semibold py-2.5 px-5 rounded-xl text-sm transition-colors"
            >
              Run Your EV Fit Check →
            </Link>
          </div>

          {/* Pillar cards */}
          <div className="space-y-5">
            {PILLARS.map((pillar) => {
              const a = accentMap[pillar.accent];
              const supporting = getSupportingGuides(pillar.id);
              return (
                <div
                  key={pillar.id}
                  className="bg-[#161b22] border border-white/[0.08] rounded-2xl overflow-hidden"
                >
                  {/* Pillar header */}
                  <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${a.badge} mb-2.5 inline-block`}>
                          {pillar.badge}
                        </span>
                        <h2 className={`text-xl font-bold ${a.heading} mb-1.5`}>
                          <Link href={`/guides/${pillar.slug}`} className="hover:opacity-80 transition-opacity">
                            {pillar.label}
                          </Link>
                        </h2>
                        <p className="text-sm text-white/50 leading-relaxed">{pillar.description}</p>
                      </div>
                      <Link
                        href={`/guides/${pillar.slug}`}
                        className={`flex-shrink-0 text-sm font-semibold ${a.link} transition-colors whitespace-nowrap`}
                      >
                        Full guide →
                      </Link>
                    </div>
                  </div>

                  {/* Supporting posts */}
                  {supporting.length > 0 && (
                    <div className="border-t border-white/[0.06] px-6 py-4">
                      <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-3">
                        Related guides
                      </p>
                      <ul className="space-y-2">
                        {supporting.map((g) => (
                          <li key={g.slug}>
                            <Link
                              href={`/guides/${g.slug}`}
                              className="flex items-center justify-between gap-2 group"
                            >
                              <span className="text-sm text-white/60 group-hover:text-white transition-colors">
                                {g.headline}
                              </span>
                              <span className="text-xs text-white/25 group-hover:text-white/60 flex-shrink-0 transition-colors">
                                →
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Other guides (no pillar) */}
          {(() => {
            const others = Object.values(guides).filter((g) => !g.pillar);
            if (others.length === 0) return null;
            return (
              <div className="mt-10">
                <h2 className="text-lg font-bold text-white mb-4">More Guides</h2>
                <div className="space-y-2">
                  {others.map((g) => (
                    <Link
                      key={g.slug}
                      href={`/guides/${g.slug}`}
                      className="flex items-center justify-between p-4 bg-[#161b22] border border-white/[0.08] rounded-xl hover:border-white/[0.15] transition-colors group"
                    >
                      <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                        {g.headline}
                      </span>
                      <span className="text-sm text-white/25 group-hover:text-white/60 transition-colors">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      <Footer />
    </div>
  );
}
