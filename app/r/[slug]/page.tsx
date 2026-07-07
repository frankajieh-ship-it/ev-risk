import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ShareSnapshot } from "@/types/receipt";
import SharePageClient from "./SharePageClient";

interface SharePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function getShareData(slug: string): Promise<{
  snapshot: ShareSnapshot;
  created_at: string;
  view_count: number;
} | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("shared_receipts")
    .select("snapshot_summary_json, created_at, view_count")
    .eq("share_slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  return {
    snapshot: data.snapshot_summary_json as ShareSnapshot,
    created_at: data.created_at,
    view_count: data.view_count || 0,
  };
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getShareData(slug);

  if (!data) {
    return { title: "Share Not Found | OFFO" };
  }

  const { snapshot } = data;
  const vehicle = [snapshot.listing_summary.year, snapshot.listing_summary.make, snapshot.listing_summary.model]
    .filter(Boolean)
    .join(" ");
  const verdictLabel = snapshot.verdict === "GREEN" ? "Low Risk" : snapshot.verdict === "YELLOW" ? "Moderate Risk" : "High Risk";

  return {
    title: `${vehicle || "Vehicle"} — ${verdictLabel} | OFFO`,
    description: snapshot.verdict_reason || `${snapshot.risk_flags.length} risk flags found. Check before buying.`,
    openGraph: {
      title: `${verdictLabel}: ${vehicle || "Used Car Check"}`,
      description: snapshot.verdict_reason || `${snapshot.risk_flags.length} risk flags identified by OFFO.`,
      type: "website",
      siteName: "OFFO",
    },
    twitter: {
      card: "summary",
      title: `${verdictLabel}: ${vehicle || "Used Car Check"}`,
      description: snapshot.verdict_reason,
    },
  };
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { slug } = await params;
  const resolvedSearch = await searchParams;
  const refUserId = typeof resolvedSearch?.ref === "string" ? resolvedSearch.ref : null;
  const data = await getShareData(slug);

  if (!data) notFound();

  // Increment view count (fire-and-forget, server-side)
  if (isSupabaseConfigured()) {
    supabase
      .from("shared_receipts")
      .update({
        view_count: data.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("share_slug", slug)
      .then(() => {});
  }

  return <SharePageClient snapshot={data.snapshot} createdAt={data.created_at} slug={slug} refUserId={refUserId} />;
}
