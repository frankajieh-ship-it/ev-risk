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
      Your OFFO reports are now saved to your account
    </h2>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 20px;">
      Quick update — we just shipped something that a few of you asked for directly.
    </p>

    <!-- Main feature -->
    <div style="background:#00d97e14;border:1px solid #00d97e33;border-radius:10px;padding:18px 22px;margin:0 0 20px;">
      <p style="font-size:13px;color:#00d97e;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">✓ Reports saved to your profile</p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        Every report you run on OFFO is now saved to your account under <strong style="color:#ffffff;">My Reports</strong>.
        Open any of them anytime — no need to find the original listing URL again. If you paid for a full report,
        it's waiting for you exactly as you left it.
      </p>
    </div>

    <!-- Garage feature -->
    <div style="background:#ffffff0a;border:1px solid #30363d;border-radius:10px;padding:18px 22px;margin:0 0 20px;">
      <p style="font-size:13px;color:#58a6ff;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">🚗 Save vehicles to your Garage</p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        You can also save any listing to your Garage to track it over time. Your garage shows the OFFO deal score,
        dealer questions to ask before the test drive, and ownership history — all in one place.
      </p>
    </div>

    <!-- Cross-device -->
    <div style="background:#ffffff0a;border:1px solid #30363d;border-radius:10px;padding:18px 22px;margin:0 0 28px;">
      <p style="font-size:13px;color:#e3b341;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">📱 Works on any device</p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        Sign in from your phone, tablet, or a new browser — your reports and garage follow you.
        No more losing a report because you switched devices or cleared your browser.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:0 0 28px;">
      <a href="https://offolab.com/workspace/receipts" style="display:inline-block;background:#00d97e;color:#0d1117;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
        View my saved reports →
      </a>
    </div>

    <p style="font-size:14px;color:#8b949e;line-height:1.7;margin:0 0 32px;">
      If you have any questions or ran into trouble accessing a report you paid for, reply to this email — I'll sort it out personally.
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
        sequenceStep: "product_update_jul23_2026",
        subject: "Your OFFO reports are now saved to your account",
        html: buildEmailHtml(email),
        idempotencyKey: `broadcast_product_update_jul23_2026_${user.id}`,
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
