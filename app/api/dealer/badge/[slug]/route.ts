/**
 * GET /api/dealer/badge/[slug]
 *
 * Returns an inline SVG badge for a verified OFFO dealer.
 * Public endpoint — no auth required.
 * Cached for 1 hour to reduce DB load from external embeds.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();

  let dealerName = "";
  let isVerified = false;

  if (supabase) {
    const { data } = await supabase
      .from("dealerships")
      .select("name, is_verified")
      .eq("slug", slug)
      .maybeSingle();

    if (data) {
      dealerName = data.name ?? "";
      isVerified = data.is_verified ?? false;
    }
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
  const profileUrl = `${SITE_URL}/dealers/${slug}`;
  const badgeReceiptUrl = `${SITE_URL}/receipt?src=dealer_badge&utm_source=dealer_badge&utm_medium=badge&utm_campaign=${encodeURIComponent(slug)}`;

  // Truncate name to keep badge compact
  const displayName = dealerName.length > 22 ? dealerName.slice(0, 21) + "…" : dealerName;

  const svg = isVerified
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="52" viewBox="0 0 200 52">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:#161b22"/>
    </linearGradient>
  </defs>
  <rect width="200" height="52" rx="10" fill="url(#bg)" stroke="#00d97e" stroke-width="1.5"/>
  <!-- Shield checkmark -->
  <path d="M14 10 L22 10 L22 22 Q18 26 14 28 Q10 26 10 22 L10 10 Z" fill="none" stroke="#00d97e" stroke-width="1.5" stroke-linejoin="round"/>
  <polyline points="12.5,19 15.5,22 21,15" fill="none" stroke="#00d97e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- OFFO text -->
  <text x="32" y="22" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11" font-weight="700" fill="#00d97e" letter-spacing="0.05em">OFFO</text>
  <text x="32" y="36" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="10" fill="#c9d1d9">${displayName}</text>
  <text x="32" y="47" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="9" fill="#6b7280">Verified Dealer</text>
  <!-- invisible link target — opens receipt page with UTM from dealer badge -->
  <a href="${badgeReceiptUrl}"><rect width="200" height="52" rx="10" fill="transparent"/></a>
</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40" viewBox="0 0 160 40">
  <rect width="160" height="40" rx="8" fill="#161b22" stroke="#21262d" stroke-width="1"/>
  <text x="80" y="25" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">Not Verified</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
