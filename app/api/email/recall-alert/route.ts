/**
 * POST /api/email/recall-alert
 *
 * Sends a recall notification email when the daily recall scanner detects
 * new active recalls on a user's saved garage vehicle.
 *
 * Protected by ADMIN_API_KEY (same as nudge/send).
 * Called by tools/recall-scanner/recall_scanner.py after upsert.
 *
 * Body: { vehicle_id: string, user_id: string, new_recall_ids: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";

const SITE_URL = "https://offolab.com";

function buildRecallAlertHtml(
  vehicleLabel: string,
  recalls: Array<{ component: string; ai_summary: string; routine_impact_score: number; is_safety_critical: boolean }>,
  userEmail: string
): string {
  const recallItems = recalls
    .map(
      (r) => `
    <div style="border-left:3px solid ${r.is_safety_critical ? "#dc2626" : "#f59e0b"};padding:10px 14px;margin-bottom:10px;background:#fff;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111827;">${r.component}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#374151;">${r.ai_summary}</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">Routine impact: ${r.routine_impact_score}/10${r.is_safety_critical ? " &mdash; <strong style='color:#dc2626;'>Safety critical</strong>" : ""}</p>
    </div>`
    )
    .join("");

  const unsubToken = Buffer.from(userEmail).toString("base64");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#1e293b;margin:0 0 6px;">Recall Alert</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">${vehicleLabel}</p>
    </div>

    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">
        ${recalls.length === 1 ? "A new recall was detected" : `${recalls.length} new recalls were detected`} for your saved vehicle:
      </p>
      ${recallItems}
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${SITE_URL}/workspace/garage" style="display:inline-block;padding:12px 28px;background:#dc2626;color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">View recall details in My Garage →</a>
    </div>

    <div style="text-align:center;padding-top:20px;border-top:1px solid #e5e7eb;margin-top:24px;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        Sent by <a href="${SITE_URL}" style="color:#6b7280;">OFFO Lab</a> &mdash;
        <a href="${SITE_URL}/api/email/nudge/unsubscribe?token=${encodeURIComponent(unsubToken)}" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  // Auth guard
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!isResendConfigured()) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as {
    vehicle_id?: string;
    user_id?: string;
    new_recall_ids?: string[];
  };

  const { vehicle_id, user_id, new_recall_ids } = body;
  if (!vehicle_id || !user_id || !new_recall_ids?.length) {
    return NextResponse.json({ error: "vehicle_id, user_id, and new_recall_ids are required" }, { status: 400 });
  }

  // Fetch vehicle details
  const { data: vehicle } = await supabase
    .from("garage_vehicles")
    .select("make, model, year, nickname")
    .eq("id", vehicle_id)
    .single();

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const vehicleLabel = vehicle.nickname
    || `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim();

  // Fetch recall details
  const { data: recalls } = await supabase
    .from("vehicle_recalls")
    .select("recall_id, component, ai_summary, routine_impact_score, is_safety_critical")
    .eq("vehicle_id", vehicle_id)
    .in("recall_id", new_recall_ids)
    .eq("status", "active");

  if (!recalls?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no matching recalls" });
  }

  // Fetch user email via admin auth API
  const { data: { user } } = await supabase.auth.admin.getUserById(user_id);
  const userEmail = user?.email;

  if (!userEmail) {
    return NextResponse.json({ ok: true, sent: 0, reason: "user has no email" });
  }

  const subject = `Recall Alert: ${vehicleLabel}`;
  const html = buildRecallAlertHtml(vehicleLabel, recalls, userEmail);
  const result = await sendChecklistEmail(userEmail, subject, html);

  if (result.success) {
    // Mark these recalls as notified
    await supabase
      .from("vehicle_recalls")
      .update({ notified_at: new Date().toISOString() })
      .eq("vehicle_id", vehicle_id)
      .in("recall_id", new_recall_ids);
  } else {
    console.error("[recall-alert] Email send failed:", result.error);
  }

  return NextResponse.json({ ok: result.success, sent: result.success ? recalls.length : 0 });
}
