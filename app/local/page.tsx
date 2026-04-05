import type { Metadata } from "next";
import Link from "next/link";
import { cities } from "@/content/cities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "EV Ownership by City — Local Guides | OFFO",
  description:
    "Does an EV make sense where you live? Browse city-specific EV guides covering charging infrastructure, winter range loss, and local fit scores for 100+ US cities.",
  alternates: { canonical: `${SITE_URL}/local` },
  openGraph: {
    title: "EV Ownership by City — Local Guides | OFFO",
    description:
      "City-specific EV guides covering charging, winter range, and fit scores for 100+ US cities.",
    url: `${SITE_URL}/local`,
    type: "website",
    siteName: "OFFO",
  },
};

const CLIMATE_ORDER = ["cold", "mild", "hot", "varied"] as const;

const CLIMATE_META: Record<
  string,
  { label: string; description: string; color: string; bg: string }
> = {
  cold: {
    label: "Cold Climate Cities",
    description: "Winters with 20–40%+ range loss. Heat pump models and buffer routines are essential.",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
  mild: {
    label: "Mild Climate Cities",
    description: "Year-round range close to EPA estimates. Easiest conditions for EV ownership.",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  hot: {
    label: "Hot Climate Cities",
    description: "Summer heat is gentler on range than cold, but thermal management matters.",
    color: "text-orange-700",
    bg: "bg-orange-50 border-orange-200",
  },
  varied: {
    label: "Variable Climate Cities",
    description: "Seasonal swings between hot summers and cold winters — plan for both.",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
};

export default function LocalIndexPage() {
  const grouped = CLIMATE_ORDER.reduce<Record<string, typeof cities[string][]>>(
    (acc, band) => {
      acc[band] = Object.values(cities).filter((c) => c.climateBand === band);
      return acc;
    },
    {}
  );

  const totalCities = Object.values(cities).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-2">
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 uppercase tracking-wider hover:text-blue-800 transition-colors"
          >
            OFFO
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
          EV Ownership by City
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Local charging infrastructure, winter range loss, and EV fit scores for{" "}
          {totalCities} US cities.
        </p>

        {/* Climate bands */}
        {CLIMATE_ORDER.map((band) => {
          const citiesInBand = grouped[band];
          if (!citiesInBand?.length) return null;
          const meta = CLIMATE_META[band];

          return (
            <div key={band} className="mb-10">
              <div className={`border rounded-xl p-4 mb-4 ${meta.bg}`}>
                <h2 className={`text-base font-bold mb-1 ${meta.color}`}>
                  {meta.label}
                </h2>
                <p className="text-sm text-gray-600">{meta.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {citiesInBand
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((city) => (
                    <Link
                      key={city.slug}
                      href={`/local/${city.slug}`}
                      className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors">
                          {city.name}
                        </span>
                        <span className="ml-1.5 text-xs text-gray-400">{city.state}</span>
                      </div>
                      <span className="text-xs text-gray-400 group-hover:text-blue-500 shrink-0 ml-2">
                        {city.winterRangeLoss} loss
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          );
        })}

        {/* CTA */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center mt-4">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Not sure if an EV fits your life?
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Answer 8 questions and get a personalized EV fit score based on your
            commute, charging access, and climate.
          </p>
          <Link
            href="/routine"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
          >
            Run Your EV Fit Check →
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          OFFO provides AI-powered analysis for informational purposes only.
        </p>
      </div>
    </div>
  );
}
