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
import { sendChecklistEmail } from "@/lib/resend";

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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#16a34a,#059669);padding:32px 32px 24px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">OFFO</p>
            <p style="margin:6px 0 0;font-size:13px;color:#bbf7d0;">Dealer Network</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">
              Confirm your dealer account
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Hi ${contactName.split(" ")[0]}, you&rsquo;re one click away from listing
              <strong>${dealership_name ? dealership_name.trim() : "your dealership"}</strong>
              on OFFO and reaching high-intent EV buyers.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#16a34a;border-radius:8px;">
                  <a href="${magicLink}"
                     style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Confirm &amp; Finish Setup →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
              Button not working? Copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 24px;font-size:11px;color:#9ca3af;word-break:break-all;">
              ${magicLink}
            </p>

            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
              This link expires in 1 hour and can only be used once.
              If you didn&rsquo;t request this, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              OFFO Lab &bull; EV Intelligence Platform &bull;
              <a href="${siteUrl}" style="color:#6b7280;text-decoration:none;">offolab.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
