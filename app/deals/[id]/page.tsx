import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, AlertTriangle, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import type { CuratedDeal } from "@/components/deals/DealCard";
import ShareButton from "@/components/deals/ShareButton";

const VERDICT_CONFIG = {
  GREEN:  { label: "Good Deal",            icon: ShieldCheck,    text: "text-[#00d97e]", bg: "bg-[#00d97e]/10",    border: "border-[#00d97e]/20",    dot: "bg-[#00d97e]" },
  YELLOW: { label: "Proceed with Caution", icon: AlertTriangle,  text: "text-yellow-400", bg: "bg-yellow-500/10",  border: "border-yellow-500/20",   dot: "bg-yellow-400" },
  RED:    { label: "High Risk",            icon: XCircle,        text: "text-red-400",    bg: "bg-red-500/10",     border: "border-red-500/20",      dot: "bg-red-400" },
};

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
  const verdict = deal.verdict ? VERDICT_CONFIG[deal.verdict]?.label ?? deal.verdict : "Analyzed";
  const description = `${verdict} · ${deal.mileage ? `${deal.mileage.toLocaleString()} mi` : "mileage unknown"} · Pre-analyzed by OFFO. ${deal.risk_flags?.[0] ?? ""}`;

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

  const vc = deal.verdict ? VERDICT_CONFIG[deal.verdict] : VERDICT_CONFIG.YELLOW;
  const VerdictIcon = vc.icon;
  const priceStr = deal.price ? `$${deal.price.toLocaleString()}` : "Price unlisted";
  const mileageStr = deal.mileage ? `${deal.mileage.toLocaleString()} mi` : null;

  const evidenceBadge =
    deal.evidence_score == null || deal.evidence_score < 40
      ? { label: "Limited",  cls: "text-white/40 bg-white/[0.05] border-white/10" }
      : deal.evidence_score < 65
      ? { label: "Partial",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" }
      : { label: "Verified", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };

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

          {/* Verdict overlay */}
          <div className={`absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full ${vc.bg} ${vc.border} border backdrop-blur-sm`}>
            <span className={`w-2 h-2 rounded-full ${vc.dot}`} />
            <span className={`text-sm font-semibold ${vc.text}`}>{vc.label}</span>
          </div>

          {deal.url_domain && (
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm">
              <span className="text-xs text-white/50">{deal.url_domain}</span>
            </div>
          )}
        </div>

        {/* Title + price */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{deal.vehicle_label}</h1>
          <div className="flex flex-wrap items-center gap-3 text-white/50 text-sm">
            <span className="text-2xl font-bold text-white">{priceStr}</span>
            {mileageStr && <span>{mileageStr}</span>}
            {deal.location && <span>{deal.location}</span>}
            {deal.last_analyzed_at && (
              <span className="text-white/30 text-xs">
                Analyzed {new Date(deal.last_analyzed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Scores grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs text-white/40 mb-1">Verdict</p>
            <div className={`flex items-center gap-1.5 ${vc.text}`}>
              <VerdictIcon className="w-4 h-4" />
              <span className="text-sm font-semibold">{vc.label}</span>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs text-white/40 mb-1">Evidence</p>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${evidenceBadge.cls}`}>
              {evidenceBadge.label}
            </span>
          </div>
          {deal.fit_score != null && (
            <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Fit Score</p>
              <p className="text-sm font-semibold text-white">{deal.fit_score}/100</p>
            </div>
          )}
          {deal.risk_points != null && (
            <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Risk Points</p>
              <p className={`text-sm font-semibold ${vc.text}`}>{deal.risk_points}/10</p>
            </div>
          )}
        </div>

        {/* Risk flags — all of them */}
        {deal.risk_flags && deal.risk_flags.length > 0 && (
          <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">Risk Flags</h2>
            <div className="flex flex-col gap-2">
              {deal.risk_flags.map((flag, i) => (
                <p key={i} className="text-sm text-white/50 flex items-start gap-2">
                  <span className="text-yellow-500/60 flex-shrink-0 mt-0.5">!</span>
                  {flag}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {deal.receipt_id ? (
            <Link
              href={`/receipt?id=${deal.receipt_id}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-sm font-semibold rounded-xl transition-colors"
            >
              View Full Receipt
            </Link>
          ) : (
            <Link
              href={`/receipt?url=${encodeURIComponent(deal.listing_url)}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 text-sm font-semibold rounded-xl transition-colors"
            >
              Analyze This Listing
            </Link>
          )}
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
