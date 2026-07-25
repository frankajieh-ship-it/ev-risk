/**
 * POST /api/email/recall-alert
 *
 * Sends a recall notification email when the daily recall scanner detects
 * new active recalls on a user's saved garage vehicle.
 *
 * Protected by ADMIN_API_KEY.
 * Called by tools/recall-scanner/recall_scanner.py after upsert.
 *
 * Body: { vehicle_id: string, user_id: string, new_recall_ids: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

function buildRecallAlertHtml(
  vehicleLabel: string,
  recalls: Array<{ component: string; ai_summary: string; routine_impact_score: number; is_safety_critical: boolean }>,
  userEmail: string
): string {
  const hasCritical = recalls.some((r) => r.is_safety_critical);

  const recallItems = recalls
    .map(
      (r) => `
    <div style="border-left:3px solid ${r.is_safety_critical ? "#dc2626" : "#f59e0b"};padding:10px 14px;margin-bottom:10px;background:#161b22;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#e6edf3;">${r.component}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#8b949e;">${r.ai_summary}</p>
      <p style="margin:0;font-size:12px;color:#00d97e;font-weight:600;">&#10003; Dealers are required to fix this for free — confirm it&apos;s been completed before you sign.</p>
    </div>`
    )
    .join("");

  const unsubToken = Buffer.from(userEmail).toString("base64");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
      <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
    </div>

    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${hasCritical ? "rgba(220,38,38,0.12)" : "rgba(245,158,11,0.12)"};border:1px solid ${hasCritical ? "rgba(220,38,38,0.3)" : "rgba(245,158,11,0.3)"};border-radius:20px;padding:4px 16px;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:700;color:${hasCritical ? "#ef4444" : "#f59e0b"};">${hasCritical ? "Safety Recall" : "Recall Alert"}</span>
      </div>
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 6px;">${recalls.length === 1 ? "1 open recall" : `${recalls.length} open recalls`} on your saved listing</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicleLabel}</p>
    </div>

    <div style="background:#1a2332;border:1px solid #00d97e33;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <p style="font-size:14px;color:#c9d1d9;margin:0;line-height:1.6;">
        <strong style="color:#00d97e;">Good news:</strong> open recalls are fixed by dealers at no cost to you.
        Before you purchase, ask the dealer to confirm each recall below has been completed — or check the VIN yourself at
        <a href="https://www.nhtsa.gov/vehicle/recalls" style="color:#00d97e;text-decoration:none;">nhtsa.gov</a>.
        A remedied recall is a green flag, not a red one.
      </p>
    </div>

    <div style="background:#0d1117;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #30363d;">
      ${recallItems}
    </div>

    <div style="background:#161b22;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #30363d;">
      <p style="font-size:13px;color:#8b949e;margin:0;line-height:1.6;">
        <strong style="color:#e6edf3;">What to ask the dealer:</strong> &ldquo;Has recall [campaign number] been completed on this VIN?&rdquo; — get it in writing on the buyers order.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:20px;">
      <a href="${SITE_URL}/workspace/garage" style="display:inline-block;background:#00d97e;color:#0d1117;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;">
        View full recall details →
      </a>
    </div>

    <div style="text-align:center;padding-top:20px;border-top:1px solid #21262d;margin-top:24px;">
      <p style="font-size:12px;color:#8b949e;margin:0;line-height:1.6;">
        Sent by <a href="${SITE_URL}" style="color:#00d97e;text-decoration:none;">OFFO Lab</a>
        &nbsp;&middot;&nbsp;
        <a href="${SITE_URL}/api/email/crm/unsubscribe?token=${encodeURIComponent(unsubToken)}&seq=recall" style="color:#8b949e;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
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

  const { data: recalls } = await supabase
    .from("vehicle_recalls")
    .select("recall_id, component, ai_summary, routine_impact_score, is_safety_critical")
    .eq("vehicle_id", vehicle_id)
    .in("recall_id", new_recall_ids)
    .eq("status", "active");

  if (!recalls?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no matching recalls" });
  }

  const { data: { user } } = await supabase.auth.admin.getUserById(user_id);
  const userEmail = user?.email;

  if (!userEmail) {
    return NextResponse.json({ ok: true, sent: 0, reason: "user has no email" });
  }

  const hasCritical = recalls.some((r) => r.is_safety_critical);
  const recallCount = recalls.length;
  const subject = `${recallCount === 1 ? "1 open recall" : `${recallCount} open recalls`} on your ${vehicleLabel} — confirm before you buy`;

  const html = buildRecallAlertHtml(vehicleLabel, recalls, userEmail);

  // Use first recall_id as part of idempotency key; if multiple, key on the batch
  const recallKey = new_recall_ids.slice().sort().join(",");
  const result = await safeSend({
    email: userEmail,
    userId: user_id,
    sequenceType: "recall",
    sequenceStep: "new_recall",
    subject,
    html,
    idempotencyKey: `recall:${vehicle_id}:${recallKey}`,
    metadata: { vehicle_id, recall_ids: new_recall_ids },
  });

  if (result.sent) {
    await supabase
      .from("vehicle_recalls")
      .update({ notified_at: new Date().toISOString() })
      .eq("vehicle_id", vehicle_id)
      .in("recall_id", new_recall_ids);
  } else if (result.error) {
    console.error("[recall-alert] Email send failed:", result.error);
  }

  return NextResponse.json({ ok: result.sent, sent: result.sent ? recalls.length : 0, skipped: result.skipped });
}
