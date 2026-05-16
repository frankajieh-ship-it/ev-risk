import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import DealCard, { type CuratedDeal } from "@/components/deals/DealCard";

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface PageParams {
  make: string;
  model: string;
  year: string;
}

async function getDeals(make: string, model: string, year: string): Promise<CuratedDeal[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    make,
    model,
    year_min: year,
    year_max: year,
    per_page: "50",
    sort: "price_asc",
  });
  try {
    const res = await fetch(`${baseUrl}/api/deals?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.deals ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { make, model, year } = await params;
  const makeLabel = slugToLabel(make);
  const modelLabel = slugToLabel(model);
  const title = `${year} ${makeLabel} ${modelLabel} Deals — Pre-Analyzed by OFFO`;
  const description = `Browse OFFO-curated ${year} ${makeLabel} ${modelLabel} listings with battery health, price check, and risk flags. Free analysis — no sign-up required.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `https://offolab.com/deals/${make}/${model}/${year}`,
    },
  };
}

export default async function DealsByVehiclePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { make, model, year } = await params;

  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 2010 || yearNum > new Date().getFullYear() + 1) {
    notFound();
  }

  const makeLabel = slugToLabel(make);
  const modelLabel = slugToLabel(model);
  const deals = await getDeals(makeLabel, modelLabel, year);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="homepage" />

      <main className="max-w-7xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-white/40 mb-6 flex-wrap">
          <Link href="/deals" className="hover:text-white/70 transition-colors">Deal Watch</Link>
          <span>/</span>
          <Link href={`/deals?make=${makeLabel}`} className="hover:text-white/70 transition-colors">{makeLabel}</Link>
          <span>/</span>
          <span className="text-white/60">{modelLabel}</span>
          <span>/</span>
          <span className="text-white/60">{year}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {year} {makeLabel} {modelLabel} — Deal Watch
          </h1>
          <p className="text-sm text-white/50">
            OFFO-curated listings pre-checked for battery health, recalls, and market price.
          </p>
        </div>

        {/* Analyze CTA */}
        <div className="mb-8 flex flex-wrap gap-3 items-center">
          <Link
            href={`/receipt?make=${encodeURIComponent(makeLabel)}&model=${encodeURIComponent(modelLabel)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors"
          >
            Analyze any {makeLabel} {modelLabel} listing →
          </Link>
          <span className="text-xs text-white/40">Paste a URL or VIN — free, 10 seconds</span>
        </div>

        {/* Deal grid or empty state */}
        {deals.length === 0 ? (
          <div className="text-center py-20 border border-white/[0.06] rounded-2xl">
            <p className="text-white/60 mb-2">No active {year} {makeLabel} {modelLabel} deals right now.</p>
            <p className="text-sm text-white/40 mb-6">Check back soon — new listings are added daily.</p>
            <Link href="/deals" className="text-sm text-[#00d97e] hover:text-[#00f090] transition-colors">
              Browse all deals →
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-white/40 mb-4">{deals.length} listing{deals.length !== 1 ? "s" : ""} found</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deals.map((deal, i) => (
                <DealCard key={deal.id} deal={deal} rank={i + 1} totalDeals={deals.length} />
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-10 text-center">
              <Link
                href={`/receipt?make=${encodeURIComponent(makeLabel)}&model=${encodeURIComponent(modelLabel)}`}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors"
              >
                Analyze your own {makeLabel} {modelLabel} listing →
              </Link>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
