/**
 * /auction/[resultId] — Dynamic OG metadata
 *
 * Server component layout that generates per-result Open Graph tags.
 * The page itself is a client component so metadata must live here.
 *
 * OG image shows vehicle title + salvage grade so shared links
 * render useful previews on Twitter/X, Facebook, iMessage, Slack, etc.
 */

import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/api-auth";
import type { NormalizedAuctionLot } from "@/lib/auction/types";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ resultId: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ resultId: string }> }): Promise<Metadata> {
  const { resultId } = await params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

  // Default fallback
  const fallback: Metadata = {
    title: "Copart Auction Risk Report | OFFO",
    description: "Free salvage risk score, ARV estimate, repair cost breakdown, and max safe bid for any Copart auction lot.",
    openGraph: {
      title: "Copart Auction Risk Report | OFFO",
      description: "Free salvage risk score, ARV, repair cost, and max safe bid.",
      url: `${appUrl}/auction/${resultId}`,
      siteName: "OFFO",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Copart Auction Risk Report | OFFO",
      description: "Free salvage risk score, ARV, repair cost, and max safe bid.",
    },
  };

  if (!resultId?.startsWith("auc_")) return fallback;

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return fallback;

    const { data: row } = await supabase
      .from("auction_analyses")
      .select("raw_data, final_report")
      .eq("result_id", resultId)
      .maybeSingle();

    if (!row?.raw_data || !row?.final_report) return fallback;

    const lot = row.raw_data as NormalizedAuctionLot;
    const report = row.final_report as Record<string, unknown>;
    const salvageRisk = report.salvage_risk as Record<string, unknown> | null;

    const vehicleName = [lot.year, lot.make, lot.model].filter(Boolean).join(" ") || "Salvage Vehicle";
    const grade = (salvageRisk?.grade as string) ?? null;
    const score = (salvageRisk?.score as number) ?? null;
    const primaryDamage = lot.primary_damage ?? null;

    const gradeLabel = grade === "green" ? "Low Risk" : grade === "yellow" ? "Moderate Risk" : grade === "red" ? "High Risk" : null;
    const scoreStr = score !== null ? ` · Score ${score}/100` : "";
    const damageStr = primaryDamage ? ` · ${primaryDamage}` : "";

    const title = `${vehicleName} — ${gradeLabel ?? "Risk Report"} | OFFO`;
    const description = `Free Copart auction analysis: salvage risk${scoreStr}${damageStr}. See ARV, repair cost estimate, and max safe bid.`;

    const arbitrage = report.arbitrage as Record<string, unknown> | null;
    const maxSafeBid = arbitrage?.max_safe_bid as number | null;
    const arv = arbitrage?.arv as number | null;

    const extendedDesc = [
      description,
      arv ? `Market value ~$${Math.round(arv).toLocaleString()}.` : null,
      maxSafeBid ? `Max safe bid: $${Math.round(maxSafeBid).toLocaleString()}.` : null,
    ].filter(Boolean).join(" ");

    return {
      title,
      description: extendedDesc,
      openGraph: {
        title,
        description: extendedDesc,
        url: `${appUrl}/auction/${resultId}`,
        siteName: "OFFO",
        type: "website",
        images: lot.photos?.[0]
          ? [{ url: lot.photos[0], width: 1200, height: 630, alt: vehicleName }]
          : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: extendedDesc,
        images: lot.photos?.[0] ? [lot.photos[0]] : [],
      },
    };
  } catch {
    return fallback;
  }
}

export default function AuctionResultLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
