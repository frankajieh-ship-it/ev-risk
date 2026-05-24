/**
 * POST /api/dealer/send-magic-link
 *
 * Generates a Supabase magic link server-side and delivers it via Resend
 * using a dealer-branded email template. Avoids Supabase's shared mail
 * infrastructure which has poor deliverability and lands in spam.
 *
 * Body: { email, dealership_name }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getClientIP } from "@/lib/rate-limiter";
import { sendChecklistEmail, buildDealerEmailShell } from "@/lib/resend";

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Auth not configured" }, { status: 503 });
  }

  let body: { email?: string; dealership_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { email, dealership_name } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.headers.get("origin") ||
    "https://offolab.com";

  // Generate the magic link — returns the actual hashed URL
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: email.trim(),
    options: {
      redirectTo: `${siteUrl}/dealers/join/confirm`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error("[dealer/send-magic-link] generateLink error:", error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Failed to generate link" },
      { status: 500 }
    );
  }

  const magicLink = data.properties.action_link;
  const contactName = dealership_name?.trim() || "there";
  const ip = getClientIP(req);

  const firstName = contactName.split(" ")[0];
  const dealershipLabel = dealership_name ? dealership_name.trim() : "your dealership";

  const emailBody = `
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0d1117;letter-spacing:-0.3px;">
      Confirm your dealer account
    </h1>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.65;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.65;">
      You&rsquo;re one click away from listing <strong>${dealershipLabel}</strong> on OFFO
      and getting matched to high-intent EV buyers in your market.
    </p>

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
      <tr>
        <td style="background:#00d97e;border-radius:10px;">
          <a href="${magicLink}"
             style="display:inline-block;padding:15px 32px;font-size:15px;font-weight:700;color:#0d1117;text-decoration:none;border-radius:10px;letter-spacing:-0.1px;">
            Confirm &amp; Finish Setup &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- What happens next -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 20px 16px;margin-bottom:28px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
        What happens next
      </p>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${[
          ["1", "Your account is created and your application is submitted"],
          ["2", "Our team reviews within 1 business day"],
          ["3", "Once approved, your dashboard and buyer intelligence goes live"],
        ].map(([n, t]) => `
        <tr>
          <td style="width:28px;vertical-align:top;padding-bottom:10px;">
            <div style="width:22px;height:22px;background:#00d97e;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:800;color:#0d1117;">${n}</div>
          </td>
          <td style="font-size:13px;color:#374151;line-height:1.5;padding-bottom:10px;padding-left:10px;">${t}</td>
        </tr>`).join("")}
      </table>
    </div>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;">

    <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.5;">
      Button not working? Paste this link into your browser:
    </p>
    <p style="margin:0 0 20px;font-size:11px;color:#d1d5db;word-break:break-all;line-height:1.4;">
      ${magicLink}
    </p>
    <p style="margin:0;font-size:12px;color:#d1d5db;line-height:1.5;">
      This link expires in 1 hour and can only be used once.
      If you didn&rsquo;t apply for dealer access, you can safely ignore this email.
    </p>`;

  const html = buildDealerEmailShell(siteUrl, emailBody);

  const result = await sendChecklistEmail(
    email.trim(),
    `Confirm your OFFO dealer account${dealership_name ? ` — ${dealership_name.trim()}` : ""}`,
    html
  );

  if (!result.success) {
    console.error("[dealer/send-magic-link] Resend error:", result.error);
    // Log IP for debugging but don't expose internal error
    console.error("[dealer/send-magic-link] IP:", ip);
    return NextResponse.json(
      { success: false, error: "Failed to send email. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Confirmation email sent." });
}
