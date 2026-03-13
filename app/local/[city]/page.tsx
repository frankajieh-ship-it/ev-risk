import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCity, getAllCitySlugs } from "@/content/cities";
import JsonLd from "@/components/seo/JsonLd";
import FaqSection from "@/components/seo/FaqSection";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

interface PageProps {
  params: Promise<{ city: string }>;
}

export function generateStaticParams() {
  return getAllCitySlugs().map((city) => ({ city }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getCity(citySlug);
  if (!city) return {};

  const title = `EV Ownership in ${city.name}, ${city.state} — Is It a Good Fit?`;
  const description = `Planning to buy an EV in ${city.name}? Here's what to know about charging, winter range, and whether an EV fits your ${city.name} commute.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/local/${city.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/local/${city.slug}`,
      type: "article",
      siteName: "OFFO",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function LocalCityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = getCity(citySlug);
  if (!city) notFound();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OFFO", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Local EV Guides",
        item: `${SITE_URL}/local`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `EV in ${city.name}`,
        item: `${SITE_URL}/local/${city.slug}`,
      },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `EV Ownership in ${city.name}, ${city.state}`,
    description: `Charging access, winter range, and EV fit for ${city.name} drivers.`,
    url: `${SITE_URL}/local/${city.slug}`,
    datePublished: "2026-03-01",
    author: { "@type": "Organization", name: "OFFO Lab" },
    publisher: { "@type": "Organization", name: "OFFO Lab" },
  };

  const climateBadge =
    city.climateBand === "cold"
      ? { label: "Cold Climate", color: "bg-blue-100 text-blue-800" }
      : city.climateBand === "hot"
      ? { label: "Hot Climate", color: "bg-orange-100 text-orange-800" }
      : city.climateBand === "mild"
      ? { label: "Mild Climate", color: "bg-green-100 text-green-800" }
      : { label: "Varied Climate", color: "bg-purple-100 text-purple-800" };

  const faqItems = [
    {
      question: `Is ${city.name} a good city for EV ownership?`,
      answer: city.fitNote,
    },
    {
      question: `How much range do EVs lose in ${city.name} winters?`,
      answer:
        city.climateBand === "mild"
          ? `${city.name}'s mild climate means minimal range impact — expect only ${city.winterRangeLoss} loss in the coldest months. This is one of the best climates for year-round EV ownership.`
          : `In ${city.name}'s cold winters, expect ${city.winterRangeLoss} range loss during the coldest months. Planning your weekly charging with a buffer above 70% is the standard practice for experienced EV owners here.`,
    },
    {
      question: `How is the EV charging infrastructure in ${city.name}?`,
      answer: city.chargingContext,
    },
    {
      question: `What EV is best for ${city.name}?`,
      answer:
        city.climateBand === "cold"
          ? `For cold climates like ${city.name}, prioritize heat pump-equipped models: Tesla Model Y (2021+), Hyundai Ioniq 5, Kia EV6, and Hyundai Ioniq 6. These models retain significantly more range in cold weather than resistance-heater vehicles.`
          : `For ${city.name}'s climate, most modern EVs with 200+ miles of EPA range work well. The Tesla Model Y, Hyundai Ioniq 5, and Chevy Equinox EV are popular choices that balance range, price, and charging speed.`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={articleJsonLd} />

      <div className="max-w-2xl mx-auto px-4 py-10">
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
            {city.name}
          </span>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full ${climateBadge.color}`}
            >
              {climateBadge.label}
            </span>
            <span className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
              {city.region}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            EV Ownership in {city.name}, {city.state}
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            {city.fitNote}
          </p>
        </div>

        {/* EVFit CTA */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Does an EV fit your {city.name} commute?
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Answer 8 quick questions and get a personalized fit score that
            accounts for your climate, mileage, and charging access.
          </p>
          <Link
            href="/routine"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Run Your EV Fit Check →
          </Link>
        </div>

        {/* City-specific content */}
        <div className="space-y-4 mb-10">
          {/* Winter range */}
          <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-lg">
              ❄️
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Winter Range in {city.name}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {city.climateBand === "mild"
                  ? `${city.name}'s mild winters mean minimal range loss — expect ${city.winterRangeLoss} in the coldest months. Year-round range is close to EPA estimates.`
                  : `Expect ${city.winterRangeLoss} range loss during ${city.name}'s coldest months. A weekly buffer routine (never start below 70%) prevents most cold-weather surprises.`}
              </p>
            </div>
          </div>

          {/* Charging context */}
          <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-lg">
              ⚡
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Charging in {city.name}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">{city.chargingContext}</p>
            </div>
          </div>

          {/* Best models for climate */}
          <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-lg">
              🚗
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Best EV Models for {city.name}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {city.climateBand === "cold"
                  ? `For ${city.name}'s cold winters, prioritize heat pump models: Tesla Model Y (2021+), Hyundai Ioniq 5, Kia EV6, and Ioniq 6. These retain significantly more range in cold weather.`
                  : city.climateBand === "hot"
                  ? `${city.name}'s summers favor EVs with robust thermal management. Tesla, Hyundai Ioniq 5, and Kia EV6 handle heat well. Avoid older Nissan Leafs without thermal management in hot climates.`
                  : `Most modern EVs with 200+ mile range work well in ${city.name}. The Tesla Model Y, Hyundai Ioniq 5, and Chevy Equinox EV are solid all-around choices.`}
              </p>
            </div>
          </div>
        </div>

        {/* Relevant guides */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Relevant Guides for {city.name} Drivers
          </h2>
          <div className="space-y-3">
            {city.climateBand === "cold" && (
              <>
                <Link
                  href="/guides/winter-ev-routine"
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow group"
                >
                  <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                    Winter EV Routine Playbook
                  </span>
                  <span className="text-sm text-gray-400 group-hover:text-blue-500">→</span>
                </Link>
                <Link
                  href="/guides/ev-winter-range-reality"
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow group"
                >
                  <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                    EV Winter Range Reality: What Actually Happens
                  </span>
                  <span className="text-sm text-gray-400 group-hover:text-blue-500">→</span>
                </Link>
              </>
            )}
            <Link
              href="/guides/no-home-charging"
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow group"
            >
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                No Home Charging Survival Guide
              </span>
              <span className="text-sm text-gray-400 group-hover:text-blue-500">→</span>
            </Link>
            <Link
              href="/guides/used-ev-proof-checklist"
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow group"
            >
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                Used EV Proof Checklist
              </span>
              <span className="text-sm text-gray-400 group-hover:text-blue-500">→</span>
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <FaqSection items={faqItems} />
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-6 border-t border-gray-100">
          <p>
            OFFO provides AI-powered analysis for informational purposes only.
            Not financial, legal, or automotive advice.
          </p>
        </div>
      </div>
    </div>
  );
}
