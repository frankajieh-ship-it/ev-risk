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
  const footer = emailFooter(email, "activation");

  const body = `
    <h2 style="font-size:20px;font-weight:700;color:#ffffff;margin:0 0 16px;line-height:1.3;">
      Temporary issue with VIN history lookup
    </h2>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 20px;">
      Hi — just a quick heads up.
    </p>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 20px;">
      Our VIN history data provider is currently experiencing an issue that is affecting the
      ownership and accident history feature on OFFO. VIN history lookups may not return
      results right now.
    </p>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 20px;">
      All other features — AI receipt analysis, price sanity checks, inspection checklists,
      and negotiation scripts — are working normally.
    </p>

    <div style="background:#00d97e14;border:1px solid #00d97e33;border-radius:10px;padding:18px 22px;margin:0 0 24px;">
      <p style="font-size:14px;color:#00d97e;font-weight:600;margin:0 0 6px;">We'll notify you when it's back online.</p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        We're working to restore full VIN history access as quickly as possible.
        You'll hear from us the moment it's live again.
      </p>
    </div>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 32px;">
      Sorry for the inconvenience — and thanks for your patience.
    </p>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0;">
      — The OFFO Team
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
        sequenceType: "activation",
        sequenceStep: "vin_outage_2026_07",
        subject: "Heads up: VIN history temporarily unavailable",
        html: buildEmailHtml(email),
        idempotencyKey: `broadcast_vin_outage_2026_07_${user.id}`,
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
