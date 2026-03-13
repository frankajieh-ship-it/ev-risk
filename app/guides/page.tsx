import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/content/guides";
import type { SeoPageContent } from "@/content/types";

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
  color: string;
  badge: string;
}[] = [
  {
    id: "no-home-charging",
    label: "No Home Charging",
    description:
      "How to own an EV without a garage — apartment strategies, workplace charging, and weekly plans.",
    slug: "no-home-charging",
    color: "blue",
    badge: "Charging",
  },
  {
    id: "winter-ev-routine",
    label: "Winter EV Routine",
    description:
      "Cold-weather range, preconditioning, buffer rules, and which models handle winter best.",
    slug: "winter-ev-routine",
    color: "indigo",
    badge: "Winter",
  },
  {
    id: "budget-evs",
    label: "Budget EVs",
    description:
      "Which EVs under $25K actually work — by model, range, and real-world use case.",
    slug: "budget-evs",
    color: "emerald",
    badge: "Budget",
  },
  {
    id: "used-ev-proof-checklist",
    label: "Used EV Checklist",
    description:
      "Battery health, recall status, charging history — 10 checks before you buy a used EV.",
    slug: "used-ev-proof-checklist",
    color: "amber",
    badge: "Used EV",
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    badge: "bg-indigo-100 text-indigo-800",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
  },
};

function getSupportingGuides(pillarId: string): SeoPageContent[] {
  return Object.values(guides).filter(
    (g) => g.pillar === pillarId && g.slug !== pillarId
  );
}

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <a
            href="/"
            className="text-xs font-medium text-blue-600 uppercase tracking-wider hover:text-blue-800 transition-colors"
          >
            OFFO
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Guides
          </span>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            EV Guides
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Practical guides built from real EV ownership patterns — not spec
            sheets. Each pillar covers one major decision area.
          </p>
        </div>

        {/* EVFit CTA */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10">
          <h2 className="text-base font-bold text-gray-900 mb-1">
            Not sure which guide applies to you?
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Answer 8 questions about your commute and charging situation — get a
            personalized EV fit score.
          </p>
          <Link
            href="/routine"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Run Your EV Fit Check →
          </Link>
        </div>

        {/* Pillar cards */}
        <div className="space-y-8">
          {PILLARS.map((pillar) => {
            const colors = colorMap[pillar.color];
            const supporting = getSupportingGuides(pillar.id);
            return (
              <div
                key={pillar.id}
                className={`border ${colors.border} rounded-2xl overflow-hidden`}
              >
                {/* Pillar header */}
                <div className={`${colors.bg} px-6 py-5`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors.badge} mb-2 inline-block`}
                      >
                        {pillar.badge}
                      </span>
                      <h2 className={`text-xl font-bold ${colors.text} mb-1`}>
                        <Link
                          href={`/guides/${pillar.slug}`}
                          className="hover:underline"
                        >
                          {pillar.label}
                        </Link>
                      </h2>
                      <p className="text-sm text-gray-600">{pillar.description}</p>
                    </div>
                    <Link
                      href={`/guides/${pillar.slug}`}
                      className={`flex-shrink-0 text-sm font-semibold ${colors.text} hover:underline whitespace-nowrap`}
                    >
                      Full guide →
                    </Link>
                  </div>
                </div>

                {/* Supporting posts */}
                {supporting.length > 0 && (
                  <div className="bg-white px-6 py-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Related guides
                    </p>
                    <ul className="space-y-2">
                      {supporting.map((g) => (
                        <li key={g.slug}>
                          <Link
                            href={`/guides/${g.slug}`}
                            className="flex items-center justify-between gap-2 group"
                          >
                            <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                              {g.headline}
                            </span>
                            <span className="text-xs text-gray-400 group-hover:text-blue-500 flex-shrink-0">
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

        {/* Other guides (no pillar or different pillar) */}
        {(() => {
          const others = Object.values(guides).filter((g) => !g.pillar);
          if (others.length === 0) return null;
          return (
            <div className="mt-10">
              <h2 className="text-lg font-bold text-gray-900 mb-4">More Guides</h2>
              <div className="space-y-3">
                {others.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/guides/${g.slug}`}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow group"
                  >
                    <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                      {g.headline}
                    </span>
                    <span className="text-sm text-gray-400 group-hover:text-blue-500">→</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-10 border-t border-gray-100 mt-10">
          <p>OFFO provides AI-powered analysis for informational purposes only.</p>
        </div>
      </div>
    </div>
  );
}
