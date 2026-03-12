import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RoutineShareSnapshot } from "@/lib/share-snapshot";
import RoutineSharePageClient from "./RoutineSharePageClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getShareData(slug: string): Promise<{
  snapshot: RoutineShareSnapshot;
  created_at: string;
  view_count: number;
} | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("shared_routines")
    .select("snapshot_json, created_at, view_count")
    .eq("share_slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  return {
    snapshot: data.snapshot_json as RoutineShareSnapshot,
    created_at: data.created_at,
    view_count: data.view_count || 0,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getShareData(slug);

  if (!data) return { title: "EV Fit Report | OFFO" };

  const { snapshot } = data;
  const vehicle = snapshot.vehicle
    ? [snapshot.vehicle.year, snapshot.vehicle.make, snapshot.vehicle.model].filter(Boolean).join(" ")
    : null;
  const title = vehicle
    ? `${vehicle} — ${snapshot.fit_label} | OFFO EV Fit`
    : `${snapshot.fit_label} — EV Fit Report | OFFO`;
  const topFlag = snapshot.stress_flags[0]?.label || "EV routine analyzed";
  const description = `${snapshot.fit_label} (${snapshot.score_0_100}/100). ${topFlag}. See how this EV fits your daily routine.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "OFFO",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function RoutineSharePage({ params }: Props) {
  const { slug } = await params;
  const data = await getShareData(slug);

  if (!data) notFound();

  // Increment view count (fire-and-forget)
  if (isSupabaseConfigured()) {
    supabase
      .from("shared_routines")
      .update({
        view_count: data.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("share_slug", slug)
      .then(() => {});
  }

  return (
    <RoutineSharePageClient
      snapshot={data.snapshot}
      createdAt={data.created_at}
      slug={slug}
    />
  );
}
