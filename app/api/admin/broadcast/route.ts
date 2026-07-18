/**
 * POST /api/admin/broadcast
 *
 * Sends a one-time broadcast email to all confirmed auth users.
 * Protected by ADMIN_API_KEY bearer token.
 * Uses safeSend — suppression-checked, daily-capped, idempotent.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { safeSend, emailWrapper, emailFooter } from "@/lib/crm-email";

export const maxDuration = 60;

const ADMIN_KEY = process.env.ADMIN_API_KEY;

function buildEmailHtml(email: string): string {
  const footer = emailFooter(email, "product_update");

  const body = `
    <h2 style="font-size:20px;font-weight:700;color:#ffffff;margin:0 0 16px;line-height:1.3;">
      What's new at OFFO this week
    </h2>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 20px;">
      Hi — it's been a few days since your last OFFO report. Here's a quick look at what we shipped while you were away.
    </p>

    <!-- Update 1: Checkout fixed -->
    <div style="background:#00d97e14;border:1px solid #00d97e33;border-radius:10px;padding:18px 22px;margin:0 0 20px;">
      <p style="font-size:13px;color:#00d97e;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">✓ Checkout fixed</p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        We found and fixed a bug where the "Unlock Report" button was silently failing for some users.
        If checkout ever gave you trouble before, it should work cleanly now — try it on your next listing.
      </p>
    </div>

    <!-- Update 2: OTA recall detection -->
    <div style="background:#ffffff0a;border:1px solid #30363d;border-radius:10px;padding:18px 22px;margin:0 0 20px;">
      <p style="font-size:13px;color:#e3b341;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">⚡ OTA recall auto-detection</p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        OFFO now automatically flags when a vehicle has an active over-the-air recall — the kind Tesla, Rivian, and Ford
        push silently. We surface it in the report so you know whether it's been applied before you buy.
      </p>
    </div>

    <!-- Update 3: Photo angle analysis -->
    <div style="background:#ffffff0a;border:1px solid #30363d;border-radius:10px;padding:18px 22px;margin:0 0 20px;">
      <p style="font-size:13px;color:#58a6ff;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">📷 Photo angle analysis</p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        The Starter Report now includes a photo audit — we flag listings that are missing standard angles
        (undercarriage, frunk, charge port, rear seat) or that show signs of selective coverage.
        Missing photos are often the most important red flag.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0 24px;">
      <a href="https://offolab.com" style="display:inline-block;background:#00d97e;color:#0d1117;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        Run a new check →
      </a>
    </div>

    <p style="font-size:14px;color:#8b949e;line-height:1.7;margin:0 0 32px;">
      As always — paste a CarGurus or Cars.com link and we'll do the rest. No account required for your first free check.
    </p>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0;">
      — Frank<br/>
      <span style="color:#8b949e;font-size:13px;">Founder, OFFO · <a href="mailto:frank@offolab.com" style="color:#8b949e;">frank@offolab.com</a></span>
    </p>

    ${footer}
  `;

  return emailWrapper(body);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Pull all confirmed auth users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError || !authData) {
    return NextResponse.json({ error: "Failed to list users", detail: authError?.message }, { status: 500 });
  }

  const confirmedUsers = authData.users.filter(
    (u) => u.email && u.email_confirmed_at
  );

  const results = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const user of confirmedUsers) {
    const email = user.email!;
    try {
      const result = await safeSend({
        email,
        userId: user.id,
        sequenceType: "product_update",
        sequenceStep: "product_update_jul17_2026",
        subject: "What's new at OFFO this week",
        html: buildEmailHtml(email),
        idempotencyKey: `broadcast_product_update_jul17_2026_${user.id}`,
      });

      if (result.sent) results.sent++;
      else if (result.skipped) results.skipped++;
      else { results.failed++; if (result.error) results.errors.push(`${email}: ${result.error}`); }
    } catch (err) {
      results.failed++;
      results.errors.push(`${email}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    success: true,
    total_users: confirmedUsers.length,
    ...results,
  });
}
