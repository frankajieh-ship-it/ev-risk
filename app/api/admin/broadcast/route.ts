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
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <img src="https://offolab.com/offo-logo.png" alt="OFFO" width="80" style="height:auto;" />
    </div>

    <!-- Heading -->
    <h1 style="font-size:22px;font-weight:700;color:#ffffff;margin:0 0 12px;line-height:1.3;">
      Thank you for being part of OFFO from the beginning
    </h1>

    <!-- Intro -->
    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 20px;">
      Hey — we mean it. You found OFFO early, when it was rough around the edges and still
      figuring itself out. That kind of trust is rare, and we don't take it lightly.
    </p>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 20px;">
      We're currently going through a revamp — updating the website, improving how things work,
      and building features that are actually worth your time. Some parts of the site may be
      temporarily limited while we finish up. We'll be back to full functionality shortly.
    </p>

    <!-- Free forever pledge -->
    <div style="background:#00d97e14;border:1px solid #00d97e33;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <p style="font-size:15px;font-weight:700;color:#00d97e;margin:0 0 8px;">
        OFFO will always be free for you — now and in the future.
      </p>
      <p style="font-size:14px;color:#c9d1d9;line-height:1.6;margin:0;">
        Because you were here from the start, OFFO is and will remain completely free for early
        users like you — no paywalls, no subscription, no catches. That's a promise.
        Whatever we build next, you're covered.
      </p>
    </div>

    <!-- What's coming -->
    <div style="background:#161b22;border:1px solid #21262d;border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="font-size:13px;font-weight:600;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 16px;">
        What's coming next
      </p>

      <div style="display:flex;align-items:flex-start;margin-bottom:14px;">
        <span style="font-size:16px;margin-right:12px;line-height:1.4;">🔋</span>
        <div>
          <p style="font-size:14px;font-weight:600;color:#ffffff;margin:0 0 2px;">Real battery health data</p>
          <p style="font-size:13px;color:#8b949e;margin:0;line-height:1.5;">
            Actual State of Health readings from physical OBD scans — not estimates.
            Know exactly what battery you're buying before you commit.
          </p>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;margin-bottom:14px;">
        <span style="font-size:16px;margin-right:12px;line-height:1.4;">✅</span>
        <div>
          <p style="font-size:14px;font-weight:600;color:#ffffff;margin:0 0 2px;">OFFO Verified listings</p>
          <p style="font-size:13px;color:#8b949e;margin:0;line-height:1.5;">
            Used EVs physically inspected and verified by OFFO — dealer inventory you can
            trust, listed directly on the platform.
          </p>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;">
        <span style="font-size:16px;margin-right:12px;line-height:1.4;">🚗</span>
        <div>
          <p style="font-size:14px;font-weight:600;color:#ffffff;margin:0 0 2px;">Smarter receipt analysis</p>
          <p style="font-size:13px;color:#8b949e;margin:0;line-height:1.5;">
            Faster verdicts, cleaner UI, and more accurate title and accident history
            — so you get answers in seconds, not minutes.
          </p>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="https://offolab.com/receipt"
         style="display:inline-block;background:#00d97e;color:#0d1117;font-size:14px;font-weight:700;
                padding:13px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.02em;">
        Run a free receipt check
      </a>
    </div>

    <p style="font-size:13px;color:#8b949e;line-height:1.7;margin:0 0 8px;text-align:center;">
      Free for early users, always. No account required.
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
        sequenceStep: "revamp_announcement_2026_05",
        subject: "You're part of something — a note from OFFO 🔋",
        html: buildEmailHtml(email),
        idempotencyKey: `broadcast_revamp_2026_05_${user.id}`,
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
