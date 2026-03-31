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
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";

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
      ? { status: "approved", is_verified: true, reviewed_at: new Date().toISOString(), rejection_reason: null }
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
      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#0a0a0a;padding:20px 24px;border-radius:8px 8px 0 0">
            <span style="color:white;font-size:22px;font-weight:700">OFFO</span>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <h2 style="margin:0 0 8px;font-size:20px;color:#111">Your dealership is approved ✓</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#374151">
              <strong>${dealer.name}</strong> has been verified on OFFO. Your listing is now live in the dealer directory and your workspace is ready.
            </p>
            <a href="${SITE_URL}/dealer"
               style="display:inline-block;padding:12px 24px;background:#16a34a;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:20px">
              Open Dealer Workspace →
            </a>
            <p style="font-size:13px;color:#6b7280">
              Your public profile: <a href="${SITE_URL}/dealers/${dealer.slug}" style="color:#2563eb">${SITE_URL}/dealers/${dealer.slug}</a>
            </p>
          </div>
        </div>`;
      await sendChecklistEmail(dealerEmail, `[OFFO] ${dealer.name} — dealership approved`, html).catch(() => {});
    } else {
      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#0a0a0a;padding:20px 24px;border-radius:8px 8px 0 0">
            <span style="color:white;font-size:22px;font-weight:700">OFFO</span>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <h2 style="margin:0 0 8px;font-size:20px;color:#111">Dealer application update</h2>
            <p style="margin:0 0 12px;font-size:15px;color:#374151">
              We weren't able to approve <strong>${dealer.name}</strong> at this time.
            </p>
            ${reason ? `<p style="margin:0 0 16px;font-size:14px;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:6px">${reason}</p>` : ""}
            <p style="font-size:13px;color:#6b7280">
              Questions? Reply to this email or contact <a href="mailto:support@offolab.com" style="color:#2563eb">support@offolab.com</a>.
            </p>
          </div>
        </div>`;
      await sendChecklistEmail(dealerEmail, `[OFFO] Update on your dealer application — ${dealer.name}`, html).catch(() => {});
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
