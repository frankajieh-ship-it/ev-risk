import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, ArrowLeft } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import type { CuratedDeal } from "@/components/deals/DealCard";
import ShareButton from "@/components/deals/ShareButton";

async function getDeal(id: string): Promise<CuratedDeal | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/deals/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.deal ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) return { title: "Deal Not Found — OFFO" };

  const title = `${deal.vehicle_label} — ${deal.price ? `$${deal.price.toLocaleString()}` : "Price unlisted"} | OFFO Deal Watch`;
  const description = `${deal.mileage ? `${deal.mileage.toLocaleString()} mi · ` : ""}Listed on OFFO Deal Watch. Run a free analysis to see battery health and risk flags.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: deal.photo_url ? [{ url: deal.photo_url }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: deal.photo_url ? [deal.photo_url] : [],
    },
  };
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const priceStr = deal.price ? `$${deal.price.toLocaleString()}` : "Price unlisted";
  const mileageStr = deal.mileage ? `${deal.mileage.toLocaleString()} mi` : null;

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="homepage" />

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Back link */}
        <Link href="/deals" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to all deals
        </Link>

        {/* Hero photo */}
        <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-[#161b22] mb-8">
          {deal.photo_url ? (
            <Image
              src={deal.photo_url}
              alt={deal.vehicle_label}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="text-5xl font-bold text-white/10 tracking-tight">
                {deal.make?.slice(0, 2).toUpperCase() ?? "EV"}
              </span>
              <span className="text-xs text-white/20 uppercase tracking-widest">
                {deal.make ?? "Electric Vehicle"}
              </span>
            </div>
          )}

          {deal.url_domain && (
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm">
              <span className="text-xs text-white/50">{deal.url_domain}</span>
            </div>
          )}
        </div>

        {/* Title + price */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{deal.vehicle_label}</h1>
          <div className="flex flex-wrap items-center gap-3 text-white/50 text-sm">
            <span className="text-2xl font-bold text-white">{priceStr}</span>
            {mileageStr && <span>{mileageStr}</span>}
            {deal.location && <span>{deal.location}</span>}
            {deal.last_analyzed_at && (
              <span className="text-white/30 text-xs">
                Listed {new Date(deal.last_analyzed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/receipt?url=${encodeURIComponent(deal.listing_url)}&src=deal_detail`}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-sm font-semibold rounded-xl transition-colors"
          >
            Run Full Analysis →
          </Link>
          <a
            href={deal.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 px-5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/50 text-sm font-semibold rounded-xl transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Original Listing
          </a>
          <ShareButton label={deal.vehicle_label} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
