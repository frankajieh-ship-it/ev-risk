/**
 * Universal CRM Unsubscribe
 *
 * GET /api/email/crm/unsubscribe?token=<base64(email)>&seq=<sequence_type|all>
 *
 * Token format: Buffer.from(email).toString("base64") — same as existing
 * /api/email/nudge/unsubscribe so live emails in inboxes continue to work.
 *
 * seq param:
 *   - Specific sequence type (activation, win_back, conversion, weekly_digest) → opts out of that sequence only
 *   - "all" or absent → opts out of all marketing + marks email_sequences.unsubscribed=true (backward compat)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import type { SequenceType } from "@/lib/crm-email";

const VALID_SEQ_TYPES = new Set<string>([
  "activation", "win_back", "conversion", "weekly_digest", "deal_watch", "recall",
]);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const seq = searchParams.get("seq");

  if (!token) {
    return new NextResponse(errorPage("Missing unsubscribe token."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Decode email — same format as existing nudge unsubscribe
  let email: string;
  try {
    email = Buffer.from(decodeURIComponent(token), "base64").toString("utf8");
    if (!email || !email.includes("@")) throw new Error("invalid");
  } catch {
    return new NextResponse(errorPage("Invalid unsubscribe link."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new NextResponse(errorPage("Service unavailable. Please try again later."), {
      status: 503,
      headers: { "Content-Type": "text/html" },
    });
  }

  const isGlobal = !seq || seq === "all" || !VALID_SEQ_TYPES.has(seq);
  const now = new Date().toISOString();

  if (isGlobal) {
    // Global unsubscribe: opt out of all marketing + backward-compat email_sequences update
    await supabase.from("crm_email_preferences").upsert(
      { email, all_marketing: false, updated_at: now },
      { onConflict: "email" }
    );
    // Backward compat: mark existing nudge sequences as unsubscribed
    await supabase.from("email_sequences")
      .update({ unsubscribed: true })
      .eq("email", email);
  } else {
    // Per-sequence unsubscribe
    const seqField = seq as SequenceType;
    await supabase.from("crm_email_preferences").upsert(
      { email, [seqField]: false, updated_at: now },
      { onConflict: "email" }
    );
  }

  const sequenceLabel = isGlobal
    ? "all OFFO emails"
    : `${seq?.replace(/_/g, " ")} emails`;

  return new NextResponse(successPage(email, sequenceLabel), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function successPage(email: string, sequenceLabel: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Unsubscribed — OFFO</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:80px auto;padding:32px 24px;text-align:center;">
    <div style="font-size:40px;margin-bottom:16px;">✓</div>
    <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 12px;">You've been unsubscribed</h1>
    <p style="font-size:15px;color:#6b7280;margin:0 0 8px;">
      <strong>${email}</strong> has been removed from ${sequenceLabel}.
    </p>
    <p style="font-size:13px;color:#9ca3af;margin:0 0 32px;">
      It may take up to 24 hours to take effect.
    </p>
    <a href="${SITE_URL}" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      Back to OFFO
    </a>
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Error — OFFO</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:80px auto;padding:32px 24px;text-align:center;">
    <h1 style="font-size:20px;color:#111827;">Something went wrong</h1>
    <p style="font-size:15px;color:#6b7280;">${message}</p>
    <a href="${SITE_URL}" style="color:#4f46e5;">Back to OFFO</a>
  </div>
</body>
</html>`;
}
