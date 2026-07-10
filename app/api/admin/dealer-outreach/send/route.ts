/**
 * POST /api/admin/dealer-outreach/send
 *
 * Sends a dealer outreach email via Resend from dealers@offolab.com.
 * Protected by ADMIN_API_KEY.
 *
 * Body: { to: string, dealerName: string, vehicleLabel: string, replyCheck?: boolean }
 * - replyCheck: true = send a plain test email to verify reply-to works
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const FROM = "OFFO for Dealers <dealers@offolab.com>";
const REPLY_TO = "dealers@offolab.com";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { to, dealerName, vehicleLabel, replyCheck } = body as {
    to: string;
    dealerName?: string;
    vehicleLabel?: string;
    replyCheck?: boolean;
  };

  if (!to) {
    return NextResponse.json({ error: "Missing required field: to" }, { status: 400 });
  }

  const resend = new Resend(resendKey);

  if (replyCheck) {
    // Simple reply-to test — plain email, no dealer branding
    const { data, error } = await resend.emails.send({
      from: FROM,
      reply_to: REPLY_TO,
      to,
      subject: "OFFO dealer email test — please reply to this",
      html: `
        <p>Hi,</p>
        <p>This is a test email from <strong>dealers@offolab.com</strong> via Resend.</p>
        <p>Please reply directly to this email to confirm that replies land in the right inbox.</p>
        <p>— Frank<br/>OFFO<br/>dealers@offolab.com</p>
      `,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id, mode: "reply_check" });
  }

  // Full outreach email
  const name = dealerName || "team";
  const vehicle = vehicleLabel || "one of your EV listings";

  const { data, error } = await resend.emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to,
    subject: `Your ${vehicle} is already on OFFO`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6">
        <p>Hi ${name},</p>

        <p>Quick note — buyers researching used EVs in your area have already been finding your inventory on <strong>OFFO</strong>, our used EV buyer intelligence platform. We analyze listings for battery health, market value, and risk so buyers can purchase with confidence.</p>

        <p>Your <strong>${vehicle}</strong> is one of the vehicles currently showing on our platform.</p>

        <p>We're inviting a small group of dealers to join as <strong>OFFO Verified Dealers</strong> — free for the first 30 days — so you can:</p>

        <ul>
          <li>Get notified when a buyer researches your specific inventory</li>
          <li>Receive their contact info and which vehicle they're looking at</li>
          <li>Show a Verified Dealer badge on your listings that increases buyer trust</li>
        </ul>

        <p>After the trial it's $149/mo, no contract, cancel anytime.</p>

        <p>Reply here and I'll set you up — or visit <a href="https://offolab.com/for-dealers">offolab.com/for-dealers</a> to see the full program.</p>

        <p>— Frank<br/>Founder, OFFO<br/>dealers@offolab.com</p>

        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="font-size:12px;color:#999">
          You're receiving this because your dealership's EV inventory appears on OFFO.<br/>
          <a href="https://offolab.com" style="color:#999">offolab.com</a>
        </p>
      </div>
    `,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id, mode: "outreach" });
}
