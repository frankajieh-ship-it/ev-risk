/**
 * Email Nudge Send (Internal)
 *
 * POST /api/email/nudge/send
 * Processes pending nudge emails for Day 1, Day 3, and Day 7.
 *
 * Called daily by the send-nudge-emails Netlify scheduled function.
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";

// Superseded by /api/email/activation/send which uses safeSend() with proper
// idempotency, daily cap, and 48h cooldown. This route bypassed all guards.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Superseded by /api/email/activation/send" },
    { status: 410 }
  );
}

const SITE_URL = "https://offolab.com";

// ─── Email HTML builders ────────────────────────────────────────────────────

function unsubscribeLink(email: string): string {
  const token = Buffer.from(email).toString("base64");
  return `${SITE_URL}/api/email/nudge/unsubscribe?token=${encodeURIComponent(token)}`;
}

function emailFooter(email: string): string {
  return `
  <div style="text-align:center;padding-top:20px;border-top:1px solid #e5e7eb;margin-top:24px;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">
      Sent by <a href="${SITE_URL}" style="color:#6b7280;">OFFO Lab</a> &mdash;
      <a href="${unsubscribeLink(email)}" style="color:#9ca3af;">Unsubscribe</a>
    </p>
  </div>`;
}

function buildDay1Email(row: any): string {
  const meta = row.metadata || {};
  const vehicle = meta.top_vehicle || meta.vehicle || "your vehicle";
  const verdict = meta.fit_verdict || meta.verdict || "";
  const verdictColor = verdict === "Good Fit" ? "#16a34a" : verdict === "Mixed Fit" ? "#ca8a04" : "#4f46e5";
  const verdictBadge = verdict
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:16px;font-size:13px;font-weight:600;color:white;background:${verdictColor};">${verdict}</span>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#1e293b;margin:0 0 6px;">Your EV fit result is ready</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">${vehicle}</p>
    </div>

    ${verdictBadge ? `<div style="text-align:center;margin-bottom:20px;">${verdictBadge}</div>` : ""}

    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#374151;margin:0 0 12px;">Based on your routine, here's the key thing to know:</p>
      <p style="font-size:14px;color:#374151;margin:0;font-style:italic;">
        ${meta.fit_verdict === "Good Fit"
          ? "Your daily miles and home charging setup are well within range — low mental load expected. You'll mostly just plug in at night."
          : "Your longest days are the main variable. Map at least one reliable public charger near your hardest route before committing."}
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${SITE_URL}/routine/results" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">View my result →</a>
    </div>

    <div style="background:#f0fdf4;border-radius:10px;padding:14px 18px;border:1px solid #bbf7d0;">
      <p style="font-size:13px;color:#166534;margin:0;">
        <strong>Quick tip:</strong> Check a listing on our receipt page to get a price verdict + must-ask questions before you buy.
        <a href="${SITE_URL}/receipt" style="color:#166534;">Try it →</a>
      </p>
    </div>

    ${emailFooter(row.email)}
  </div>
</body>
</html>`;
}

function buildDay3Email(row: any): string {
  const meta = row.metadata || {};
  const vehicle = meta.top_vehicle || meta.vehicle || "your top match";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#1e293b;margin:0 0 6px;">Compare a second option?</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">Most serious buyers check 2–3 vehicles before deciding</p>
    </div>

    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#374151;margin:0 0 10px;">
        You already have a fit score for <strong>${vehicle}</strong>.
      </p>
      <p style="font-size:14px;color:#374151;margin:0;">
        OFFO's compare tool lets you paste two listings side-by-side and get a fit score for each — so you can see exactly which one matches your routine better before you spend a dollar.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${SITE_URL}/compare" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Compare two options →</a>
    </div>

    <div style="background:#eff6ff;border-radius:10px;padding:14px 18px;border:1px solid #bfdbfe;">
      <p style="font-size:13px;color:#1e40af;margin:0;">
        <strong>Did you know?</strong> You can also paste a listing URL on our receipt page to get a price check + risk flags in under 30 seconds.
        <a href="${SITE_URL}/receipt" style="color:#1e40af;">Check a listing →</a>
      </p>
    </div>

    ${emailFooter(row.email)}
  </div>
</body>
</html>`;
}

function buildDay7Email(row: any): string {
  const meta = row.metadata || {};
  const vehicle = meta.top_vehicle || meta.vehicle || "your saved vehicle";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#1e293b;margin:0 0 6px;">Save your scenario before it's gone</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">Your fit results for ${vehicle}</p>
    </div>

    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#374151;margin:0 0 10px;">
        Your fit check results are stored temporarily — but saving them to <strong>My Garage</strong> gives you:
      </p>
      <ul style="margin:0;padding-left:18px;font-size:14px;color:#374151;">
        <li style="margin-bottom:6px;">Permanent access to your fit score and breakdown</li>
        <li style="margin-bottom:6px;">Side-by-side comparison history across all your checks</li>
        <li style="margin-bottom:6px;">Alerts if the listing price drops</li>
      </ul>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${SITE_URL}/saved" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Save to My Garage →</a>
    </div>

    <div style="background:#fefce8;border-radius:10px;padding:14px 18px;border:1px solid #fef08a;">
      <p style="font-size:13px;color:#713f12;margin:0;">
        <strong>Also:</strong> If you're still deciding, our dealer directory lists OFFO-verified EV dealers near you.
        <a href="${SITE_URL}/dealers" style="color:#713f12;">Browse dealers →</a>
      </p>
    </div>

    ${emailFooter(row.email)}
  </div>
</body>
</html>`;
}

function buildNudgeEmail(day: 1 | 3 | 7, row: any): { subject: string; html: string } {
  const meta = row.metadata || {};
  const vehicle = meta.top_vehicle || meta.vehicle || "your EV match";

  switch (day) {
    case 1:
      return {
        subject: `Your EV fit result is ready — ${vehicle}`,
        html: buildDay1Email(row),
      };
    case 3:
      return {
        subject: `Compare a second EV option?`,
        html: buildDay3Email(row),
      };
    case 7:
      return {
        subject: `Save your scenario before it expires`,
        html: buildDay7Email(row),
      };
  }
}

// ─── Send handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!isResendConfigured()) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  const now = new Date();
  const results = { day1: 0, day3: 0, day7: 0, errors: 0 };

  try {
    // ── Day 1: enrolled 23+ hours ago, day1 not sent ──
    const { data: day1Rows } = await supabase
      .from("email_sequences")
      .select("*")
      .is("day1_sent_at", null)
      .eq("unsubscribed", false)
      .lte("enrolled_at", new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString())
      .limit(50);

    for (const row of day1Rows || []) {
      const { subject, html } = buildNudgeEmail(1, row);
      const result = await sendChecklistEmail(row.email, subject, html);
      if (result.success) {
        await supabase.from("email_sequences").update({ day1_sent_at: now.toISOString() }).eq("id", row.id);
        results.day1++;
      } else {
        results.errors++;
        console.error("[Nudge Send] Day 1 failed for", row.email, result.error);
      }
    }

    // ── Day 3: enrolled 3+ days ago, day1 sent, day3 not sent ──
    const { data: day3Rows } = await supabase
      .from("email_sequences")
      .select("*")
      .not("day1_sent_at", "is", null)
      .is("day3_sent_at", null)
      .eq("unsubscribed", false)
      .lte("enrolled_at", new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    for (const row of day3Rows || []) {
      const { subject, html } = buildNudgeEmail(3, row);
      const result = await sendChecklistEmail(row.email, subject, html);
      if (result.success) {
        await supabase.from("email_sequences").update({ day3_sent_at: now.toISOString() }).eq("id", row.id);
        results.day3++;
      } else {
        results.errors++;
        console.error("[Nudge Send] Day 3 failed for", row.email, result.error);
      }
    }

    // ── Day 7: enrolled 7+ days ago, day3 sent, day7 not sent ──
    const { data: day7Rows } = await supabase
      .from("email_sequences")
      .select("*")
      .not("day3_sent_at", "is", null)
      .is("day7_sent_at", null)
      .eq("unsubscribed", false)
      .lte("enrolled_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    for (const row of day7Rows || []) {
      const { subject, html } = buildNudgeEmail(7, row);
      const result = await sendChecklistEmail(row.email, subject, html);
      if (result.success) {
        await supabase.from("email_sequences").update({ day7_sent_at: now.toISOString() }).eq("id", row.id);
        results.day7++;
      } else {
        results.errors++;
        console.error("[Nudge Send] Day 7 failed for", row.email, result.error);
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      sent: results,
    });
  } catch (err) {
    console.error("[Nudge Send] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error", sent: results },
      { status: 500 }
    );
  }
}
