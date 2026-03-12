/**
 * Co-Shopper Invite Landing Page
 *
 * /i/[token]
 *
 * Loads the inviter's routine share snapshot, marks invite as opened,
 * and shows the inviter's fit report with a "Run my fit too" CTA.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RoutineShareSnapshot } from "@/lib/share-snapshot";
import RoutineSharePageClient from "@/app/r/routine/[slug]/RoutineSharePageClient";

interface Props {
  params: Promise<{ token: string }>;
}

async function getInviteData(token: string): Promise<{
  snapshot: RoutineShareSnapshot;
  created_at: string;
  share_slug: string;
} | null> {
  if (!isSupabaseConfigured()) return null;

  const now = new Date().toISOString();

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("id, share_slug, status, expires_at")
    .eq("token", token)
    .single();

  if (inviteError || !invite) return null;
  if (invite.expires_at && invite.expires_at < now) return null;

  const { data: share, error: shareError } = await supabase
    .from("shared_routines")
    .select("snapshot_json, created_at")
    .eq("share_slug", invite.share_slug)
    .eq("is_active", true)
    .single();

  if (shareError || !share) return null;

  // Mark invite as opened (fire-and-forget)
  if (invite.status === "sent") {
    supabase
      .from("invites")
      .update({ status: "opened", opened_at: now })
      .eq("id", invite.id)
      .then(() => {});

    supabase
      .from("user_events")
      .insert({
        event_name: "invite_opened",
        event_data: { invite_token: token, share_slug: invite.share_slug },
        page_path: `/i/${token}`,
        timestamp: now,
      })
      .then(() => {});
  }

  return {
    snapshot: share.snapshot_json as RoutineShareSnapshot,
    created_at: share.created_at,
    share_slug: invite.share_slug,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getInviteData(token);

  if (!data) return { title: "EV Fit Invite | OFFO" };

  const { snapshot } = data;
  const vehicle = snapshot.vehicle
    ? [snapshot.vehicle.year, snapshot.vehicle.make, snapshot.vehicle.model].filter(Boolean).join(" ")
    : null;
  const title = vehicle
    ? `Someone shared their ${vehicle} fit check — run yours | OFFO`
    : `Someone shared their EV fit check — run yours | OFFO`;
  const description = `They got ${snapshot.fit_label} (${snapshot.score_0_100}/100). See how your EV routine compares.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "OFFO" },
    twitter: { card: "summary", title, description },
  };
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const data = await getInviteData(token);

  if (!data) notFound();

  return (
    <RoutineSharePageClient
      snapshot={data.snapshot}
      createdAt={data.created_at}
      slug={data.share_slug}
      inviteToken={token}
    />
  );
}
