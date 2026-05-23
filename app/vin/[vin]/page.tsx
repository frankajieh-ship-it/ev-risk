/**
 * /vin/[vin] — Public ISR landing page
 *
 * Shows a public-safe receipt preview for any VIN that has been analyzed on OFFO.
 * Revalidates every 24h. 404s if VIN not found.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

interface VinSummary {
  receipt_id: string;
  vin: string;
  created_at: string;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  verdict: string | null;
  mileage: number | null;
  title_status: string | null;
}

async function getVinSummary(vin: string): Promise<VinSummary | null> {
  try {
    const res = await fetch(`${APP_URL}/api/receipt/public/${encodeURIComponent(vin)}`, {
      next: { revalidate: 86400 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vin: string }>;
}): Promise<Metadata> {
  const { vin } = await params;
  const data = await getVinSummary(vin.toUpperCase());

  if (!data) {
    return { title: "VIN Not Found | OFFO", robots: { index: false, follow: false } };
  }

  const vehicleLabel = [data.vehicle_year, data.vehicle_make, data.vehicle_model]
    .filter(Boolean)
    .join(" ") || "Used EV";

  const title = `${vehicleLabel} (${vin.toUpperCase()}) — OFFO Receipt Preview`;
  const description = `See the OFFO receipt preview for this ${vehicleLabel}: verdict, title status, mileage, and battery risk summary.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/vin/${vin.toUpperCase()}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/vin/${vin.toUpperCase()}`,
      type: "website",
      siteName: "OFFO",
      images: [
        {
          url: `${APP_URL}/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  GREEN: {
    label: "Recommended",
    color: "text-[#00d97e]",
    bg: "bg-[#00d97e]/10",
    border: "border-[#00d97e]/30",
  },
  YELLOW: {
    label: "Caution",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
  },
  RED: {
    label: "Risky",
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
  },
};

export default async function VinPage({
  params,
}: {
  params: Promise<{ vin: string }>;
}) {
  const { vin } = await params;
  const data = await getVinSummary(vin.toUpperCase());

  if (!data) notFound();

  const vehicleLabel = [data.vehicle_year, data.vehicle_make, data.vehicle_model]
    .filter(Boolean)
    .join(" ") || "Used EV";

  const verdict = data.verdict ? VERDICT_CONFIG[data.verdict] : null;

  const titleStatusDisplay: Record<string, string> = {
    clean: "Clean title",
    salvage: "Salvage title",
    rebuilt: "Rebuilt title",
    unknown: "Title unknown",
  };

  const analyzedDate = data.created_at
    ? new Date(data.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-xs text-white/40">
          <Link href="/" className="hover:text-white/60 transition-colors">OFFO</Link>
          <span>/</span>
          <Link href="/receipt" className="hover:text-white/60 transition-colors">Receipt</Link>
          <span>/</span>
          <span className="text-white/60 font-mono">{vin.toUpperCase()}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-white/40 font-mono mb-2">VIN: {vin.toUpperCase()}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{vehicleLabel}</h1>
          {analyzedDate && (
            <p className="text-xs text-white/30">Analyzed on OFFO · {analyzedDate}</p>
          )}
        </div>

        {/* Receipt preview card */}
        <div className="bg-[#161b22] border border-white/[0.07] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">OFFO Receipt Preview</p>
            {verdict && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${verdict.bg} ${verdict.color} ${verdict.border} border`}>
                {verdict.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Mileage */}
            <div className="bg-[#0d1117] rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Mileage</p>
              <p className="text-base font-semibold text-white">
                {data.mileage ? data.mileage.toLocaleString() + " mi" : "—"}
              </p>
            </div>

            {/* Title Status */}
            <div className="bg-[#0d1117] rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Title Status</p>
              <p className={`text-base font-semibold ${
                data.title_status === "clean" ? "text-[#00d97e]" :
                data.title_status === "salvage" || data.title_status === "rebuilt" ? "text-amber-400" :
                "text-white/60"
              }`}>
                {data.title_status ? titleStatusDisplay[data.title_status] ?? data.title_status : "—"}
              </p>
            </div>
          </div>

          {/* Blur overlay — full receipt requires running a check */}
          <div className="mt-6 relative">
            <div className="space-y-3 select-none">
              {["Battery degradation risk", "Open recall check", "Price vs. market", "Charging fit score"].map((label) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                  <span className="text-sm text-white/30">{label}</span>
                  <span className="text-sm font-mono bg-white/10 text-transparent rounded px-8 py-0.5 blur-sm">████</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#161b22]/80 rounded-xl">
              <p className="text-sm font-semibold text-white mb-1">Full receipt available free</p>
              <p className="text-xs text-white/50 mb-4 text-center max-w-xs">Run a full OFFO check to see battery risk, recalls, and price analysis for this vehicle.</p>
              <Link
                href={`/receipt?vin=${vin.toUpperCase()}`}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-bold rounded-xl hover:bg-[#00c970] transition-colors"
              >
                Run a full receipt check →
              </Link>
            </div>
          </div>
        </div>

        {/* What OFFO checks */}
        <div className="bg-[#161b22] border border-white/[0.07] rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">What OFFO checks on every EV</p>
          <div className="space-y-3">
            {[
              { label: "Battery degradation risk", desc: "Estimated SOH based on mileage, model, and chemistry" },
              { label: "Open NHTSA recalls", desc: "Battery, safety, and charging system recalls" },
              { label: "Price vs. market comps", desc: "Compared to similar year/make/model/mileage listings" },
              { label: "Title & accident history", desc: "Flags salvage, rebuilt, or disclosed accidents" },
              { label: "Charging fit score", desc: "Range vs. your commute and charging access" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="text-[#00d97e] text-sm shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="text-sm text-white/80 font-medium">{item.label}</p>
                  <p className="text-xs text-white/40">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href={`/receipt?vin=${vin.toUpperCase()}`}
            className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 bg-[#00d97e] text-[#0d1117] text-sm font-bold rounded-xl hover:bg-[#00c970] transition-colors mb-3"
          >
            Run a full receipt check on this vehicle →
          </Link>
          <p className="text-xs text-white/30">Free · No account required</p>
        </div>

      </div>
    </div>
  );
}
