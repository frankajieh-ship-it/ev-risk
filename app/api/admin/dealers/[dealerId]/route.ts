/**
 * Admin: Approve or Reject a Dealer
 *
 * POST /api/admin/dealers/[dealerId]
 * Body: { action: "approve" | "reject", reason?: string }
 * Protected by ADMIN_API_KEY header.
 *
 * On approve: sets status=approved, is_verified=true, sends welcome email to dealer
 * On reject:  sets status=rejected, sends rejection email with optional reason
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { sendChecklistEmail, isResendConfigured, buildDealerEmailShell } from "@/lib/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dealerId: string }> }
) {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { dealerId } = await params;

  let body: { action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { action, reason } = body;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ success: false, error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  // Fetch dealer + contact email (via dealer_members)
  const { data: dealer, error: fetchErr } = await supabase
    .from("dealerships")
    .select("id, name, slug, contact_email, status")
    .eq("id", dealerId)
    .single();

  if (fetchErr || !dealer) {
    return NextResponse.json({ success: false, error: "Dealer not found" }, { status: 404 });
  }

  if (dealer.status !== "pending") {
    return NextResponse.json({ success: false, error: `Dealer is already ${dealer.status}` }, { status: 409 });
  }

  // Get the dealer_admin user's email from dealer_members → auth.users
  let dealerEmail = dealer.contact_email;
  if (!dealerEmail) {
    const { data: member } = await supabase
      .from("dealer_members")
      .select("user_id")
      .eq("dealership_id", dealerId)
      .eq("role", "admin")
      .maybeSingle();

    if (member?.user_id) {
      const { data: { user } } = await supabase.auth.admin.getUserById(member.user_id);
      dealerEmail = user?.email ?? null;
    }
  }

  // Update dealership status
  const updates =
    action === "approve"
      ? { status: "approved", is_verified: true, reviewed_at: new Date().toISOString(), rejection_reason: null, subscription_status: "pending_payment" }
      : { status: "rejected", is_verified: false, reviewed_at: new Date().toISOString(), rejection_reason: reason || null };

  const { error: updateErr } = await supabase
    .from("dealerships")
    .update(updates)
    .eq("id", dealerId);

  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
  }

  // Send email notification to dealer
  if (dealerEmail && isResendConfigured()) {
    if (action === "approve") {
      const approveBody = `
        <div style="margin-bottom:6px;">
          <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.04em;text-transform:uppercase;">
            Approved
          </span>
        </div>
        <h1 style="margin:16px 0 10px;font-size:22px;font-weight:700;color:#0d1117;letter-spacing:-0.3px;">
          Your dealership is live on OFFO
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65;">
          <strong>${dealer.name}</strong> has been verified and your dealer workspace is ready.
          Buyers researching EVs in your market can now find and contact you directly through OFFO.
        </p>

        <!-- CTA -->
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
          <tr>
            <td style="background:#00d97e;border-radius:10px;">
              <a href="${SITE_URL}/dealer"
                 style="display:inline-block;padding:15px 32px;font-size:15px;font-weight:700;color:#0d1117;text-decoration:none;border-radius:10px;">
                Open Dealer Workspace &rarr;
              </a>
            </td>
          </tr>
        </table>

        <!-- What's ready -->
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">What&rsquo;s ready for you</p>
          ${[
            "Buyer intelligence dashboard — see who&rsquo;s researching your inventory",
            "Live pricing intelligence on every vehicle you upload",
            "OFFO-verified badge you can embed on your website",
            "Buyer inquiry inbox — leads come directly to you",
          ].map(item => `
          <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
            <span style="color:#00d97e;font-size:14px;font-weight:700;margin-right:10px;flex-shrink:0;">✓</span>
            <span style="font-size:13px;color:#374151;line-height:1.5;">${item}</span>
          </div>`).join("")}
        </div>

        <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;">
        <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
          Your public profile:
          <a href="${SITE_URL}/dealers/${dealer.slug}" style="color:#374151;text-decoration:underline;">${SITE_URL}/dealers/${dealer.slug}</a>
        </p>`;

      const html = buildDealerEmailShell(SITE_URL, approveBody);
      await sendChecklistEmail(dealerEmail, `${dealer.name} is approved on OFFO`, html).catch(() => {});

    } else {
      const rejectBody = `
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0d1117;letter-spacing:-0.3px;">
          Update on your dealer application
        </h1>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.65;">
          Thank you for applying to the OFFO dealer network. After review, we weren&rsquo;t
          able to approve <strong>${dealer.name}</strong> at this time.
        </p>
        ${reason ? `
        <div style="background:#fef9f0;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">${reason}</p>
        </div>` : ""}
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65;">
          If you believe this was in error or your situation has changed,
          please reach out and we&rsquo;ll take another look.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
          <tr>
            <td style="border:1.5px solid #e5e7eb;border-radius:10px;">
              <a href="mailto:support@offolab.com"
                 style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#374151;text-decoration:none;border-radius:9px;">
                Contact support &rarr;
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
          Questions? Reply to this email or write to
          <a href="mailto:support@offolab.com" style="color:#6b7280;text-decoration:underline;">support@offolab.com</a>.
        </p>`;

      const html = buildDealerEmailShell(SITE_URL, rejectBody);
      await sendChecklistEmail(dealerEmail, `Update on your OFFO dealer application — ${dealer.name}`, html).catch(() => {});
    }
  }

  // Notify admin (fire-and-forget)
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  if (adminEmail && isResendConfigured()) {
    sendChecklistEmail(
      adminEmail,
      `[OFFO Admin] Dealer ${action}d: ${dealer.name}`,
      `<p>Dealer <strong>${dealer.name}</strong> (${dealerId}) was <strong>${action}d</strong>.${reason ? ` Reason: ${reason}` : ""}</p>`
    ).catch(() => {});
  }

  return NextResponse.json({ success: true, action, dealer_id: dealerId });
}
