/**
 * POST /api/admin/dealer-outreach/blast
 *
 * Sends the intro outreach email to all prospect dealers who haven't been
 * contacted yet (status='prospect', outreach_step IS NULL).
 *
 * Protected by ADMIN_API_KEY.
 *
 * Body (optional): { dry_run?: boolean, limit?: number }
 * dry_run=true returns the list of dealers who would be emailed without sending.
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/api-auth";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const FROM = "Frank at OFFO <frank@offolab.com>";
const REPLY_TO = "frank@offolab.com";

function buildOutreachEmail(dealerName: string, vehicleLabel: string): string {
  const name = dealerName || "team";
  const vehicle = vehicleLabel || "your EV inventory";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.7;font-size:15px">
      <p>Hi ${name},</p>

      <p>Buyers researching used EVs are already finding your inventory on <strong>OFFO</strong> — our EV buyer intelligence platform that analyzes listings for battery health, accident history, and market value so buyers feel confident enough to show up and buy.</p>

      <p>Your <strong>${vehicle}</strong> is one of the vehicles currently appearing on our platform.</p>

      <p>We're opening up our <strong>Dealer Alerts</strong> program to a small group of dealers — free for 30 days — so you can:</p>

      <ul style="padding-left:20px;margin:12px 0">
        <li style="margin-bottom:6px">Get notified the moment a buyer researches your specific VIN</li>
        <li style="margin-bottom:6px">See what they looked at and which questions they asked</li>
        <li style="margin-bottom:6px">Respond before they move on to the next dealer</li>
      </ul>

      <p>Right now OFFO buyers are submitting inquiries cold — by the time they contact you, half have already moved on. Dealer Alerts puts you one step ahead.</p>

      <p>Pricing starts at $149/mo after the trial — cancel anytime, no long-term contract.</p>

      <p>Reply to this email and I'll set you up today, or visit <a href="https://offolab.com/for-dealers" style="color:#00a86b">offolab.com/for-dealers</a> to see the full program.</p>

      <p>— Frank<br/>Founder, OFFO<br/><a href="mailto:dealers@offolab.com" style="color:#00a86b">dealers@offolab.com</a></p>

      <hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>
      <p style="font-size:12px;color:#aaa;margin:0">
        You're receiving this because your dealership's EV inventory appears on OFFO.
        <br/><a href="https://offolab.com" style="color:#aaa">offolab.com</a>
      </p>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { dry_run?: boolean; limit?: number; debug?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const dryRun = body.dry_run === true;
  const debug = body.debug === true;
  const limit = Math.min(body.limit ?? 50, 100);

  // debug mode: return ALL dealers regardless of status/step so we can diagnose
  if (debug) {
    const { data: all } = await supabase
      .from("dealerships")
      .select("id, name, slug, contact_email, status, outreach_step, city, state")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ debug: true, total: all?.length, dealers: all });
  }

  // Fetch all un-contacted prospects
  const { data: prospects, error: fetchErr } = await supabase
    .from("dealerships")
    .select("id, name, contact_email, city, state, slug")
    .eq("status", "prospect")
    .is("outreach_step", null)
    .not("contact_email", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!prospects?.length) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, message: "No uncontacted prospects found" });
  }

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      would_send: prospects.length,
      dealers: prospects.map(d => ({ id: d.id, name: d.name, email: d.contact_email, location: [d.city, d.state].filter(Boolean).join(", ") })),
    });
  }

  const resend = new Resend(resendKey);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const dealer of prospects) {
    if (!dealer.contact_email) continue;

    // Build vehicle label from dealer name if no specific vehicle info
    const vehicleLabel = `${dealer.name}'s EV inventory`;
    const subject = `${dealer.name}: OFFO buyers are searching for your EVs — free 30-day trial`;

    try {
      const { error: sendErr } = await resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: dealer.contact_email,
        subject,
        html: buildOutreachEmail(dealer.name, vehicleLabel),
      });

      if (sendErr) {
        failed++;
        errors.push(`${dealer.contact_email}: ${sendErr.message}`);
        continue;
      }

      // Mark outreach step on the dealership row
      await supabase
        .from("dealerships")
        .update({
          outreach_step: "intro",
          outreach_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealer.id);

      // Log to dealer_outreach table
      await supabase.from("dealer_outreach").insert({
        dealership_id: dealer.id,
        step: "intro",
        idempotency_key: `dealer-intro:${dealer.id}:jul17-2026`,
        metadata: { subject, email: dealer.contact_email },
      }).then(() => {});

      sent++;

      // Brief pause between sends to avoid Resend rate limits (100/s)
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      failed++;
      errors.push(`${dealer.contact_email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    failed,
    total: prospects.length,
    ...(errors.length > 0 && { errors }),
  });
}
