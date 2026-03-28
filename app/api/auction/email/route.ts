/**
 * POST /api/auction/email
 *
 * Send an auction report summary link to the user's email.
 * Looks up the analysis from auction_analyses, builds a clean
 * HTML email with the key numbers, and sends via Resend.
 *
 * Body: { email: string; result_id: string; anon_id?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";
import { getClientIP } from "@/lib/rate-limiter";
import { createHash } from "crypto";
import type { NormalizedAuctionLot } from "@/lib/auction/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limit: 5/hr per IP
const ipLimiter = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = ipLimiter.get(ip);
  if (entry && now > entry.resetAt) ipLimiter.delete(ip);
  const cur = ipLimiter.get(ip) ?? { count: 0, resetAt: now + 3_600_000 };
  if (cur.count >= 5) return false;
  cur.count++;
  ipLimiter.set(ip, cur);
  return true;
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function gradeColor(grade: string | null) {
  if (grade === "green") return "#16a34a";
  if (grade === "yellow") return "#d97706";
  return "#dc2626";
}

function gradeLabel(grade: string | null) {
  if (grade === "green") return "Low Risk";
  if (grade === "yellow") return "Moderate Risk";
  return "High Risk";
}

function buildAuctionEmailHtml(
  lot: NormalizedAuctionLot,
  report: Record<string, unknown>,
  resultUrl: string
): string {
  const vehicleName = [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || "Salvage Vehicle";
  const salvageRisk = report.salvage_risk as Record<string, unknown> | null;
  const arbitrage = report.arbitrage as Record<string, unknown> | null;
  const verdict = report.verdict as Record<string, unknown> | null;

  const grade = (salvageRisk?.grade as string) ?? null;
  const score = (salvageRisk?.score as number) ?? null;
  const color = gradeColor(grade);
  const label = gradeLabel(grade);

  const arv = arbitrage?.arv as number | null;
  const repairLow = arbitrage?.repair_cost_low as number | null;
  const repairHigh = arbitrage?.repair_cost_high as number | null;
  const maxSafeBid = arbitrage?.max_safe_bid as number | null;

  const headline = (verdict?.headline as string) ?? null;
  const summary = (verdict?.summary as string) ?? null;
  const topRisks = (verdict?.top_risks as string[]) ?? [];

  const topRisksHtml = topRisks.slice(0, 3)
    .map(r => `<li style="margin-bottom:6px;color:#374151;">${r}</li>`)
    .join("");

  const statsRows = [
    lot.primary_damage ? `<tr><td style="color:#6b7280;padding:4px 0;">Damage</td><td style="text-align:right;font-weight:600;color:#374151;">${lot.primary_damage}</td></tr>` : "",
    lot.title_status ? `<tr><td style="color:#6b7280;padding:4px 0;">Title</td><td style="text-align:right;font-weight:600;color:#374151;">${lot.title_status}</td></tr>` : "",
    lot.odometer ? `<tr><td style="color:#6b7280;padding:4px 0;">Mileage</td><td style="text-align:right;font-weight:600;color:#374151;">${lot.odometer.toLocaleString()} mi</td></tr>` : "",
    lot.current_bid ? `<tr><td style="color:#6b7280;padding:4px 0;">Current bid</td><td style="text-align:right;font-weight:600;color:#374151;">${fmt(lot.current_bid)}</td></tr>` : "",
    arv ? `<tr><td style="color:#6b7280;padding:4px 0;">Est. market value (ARV)</td><td style="text-align:right;font-weight:600;color:#374151;">${fmt(arv)}</td></tr>` : "",
    (repairLow && repairHigh) ? `<tr><td style="color:#6b7280;padding:4px 0;">Repair cost est.</td><td style="text-align:right;font-weight:600;color:#374151;">${fmt(repairLow)} – ${fmt(repairHigh)}</td></tr>` : "",
    maxSafeBid ? `<tr><td style="color:#6b7280;padding:4px 0;">Max safe bid</td><td style="text-align:right;font-weight:600;color:#16a34a;">${fmt(maxSafeBid)}</td></tr>` : "",
  ].filter(Boolean).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:20px;color:#1e293b;margin:0 0 4px;">Your Auction Risk Report</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">${vehicleName} · Lot ${lot.lot_number}</p>
    </div>

    <!-- Risk grade badge -->
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:2px solid ${color};text-align:center;">
      <span style="display:inline-block;padding:6px 20px;border-radius:20px;font-size:15px;font-weight:700;color:white;background:${color};">
        ${label}${score !== null ? ` — ${score}/100` : ""}
      </span>
      ${headline ? `<p style="font-size:14px;color:#374151;margin:12px 0 0;font-weight:600;">${headline}</p>` : ""}
      ${summary ? `<p style="font-size:13px;color:#6b7280;margin:8px 0 0;">${summary}</p>` : ""}
    </div>

    <!-- Key numbers -->
    ${statsRows ? `
    <div style="background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;border:1px solid #e5e7eb;">
      <h2 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;">Key Numbers</h2>
      <table style="width:100%;font-size:13px;" cellpadding="0" cellspacing="0">
        ${statsRows}
      </table>
    </div>` : ""}

    <!-- Top risks -->
    ${topRisksHtml ? `
    <div style="background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;border:1px solid #fde68a;">
      <h2 style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 10px;">Top Risks</h2>
      <ul style="margin:0;padding-left:18px;font-size:13px;">${topRisksHtml}</ul>
    </div>` : ""}

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${resultUrl}" style="display:inline-block;padding:12px 32px;background:#f97316;color:white;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">
        View Full Report →
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:12px 0 0;">Report valid for 24 hours from analysis time.</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">Sent by <a href="https://offolab.com" style="color:#6b7280;">OFFO</a> — free auction intelligence</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkRate(ip)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email as string)?.trim();
  const resultId = (body.result_id as string)?.trim();
  const anonId = (body.anon_id as string) ?? null;

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
  }
  if (!resultId?.startsWith("auc_")) {
    return NextResponse.json({ success: false, error: "Valid result_id required" }, { status: 400 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ success: false, error: "Email service not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Service unavailable" }, { status: 503 });
  }

  const { data: row } = await supabase
    .from("auction_analyses")
    .select("raw_data, final_report, auction_source")
    .eq("result_id", resultId)
    .maybeSingle();

  if (!row?.raw_data || !row?.final_report) {
    return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
  }

  const lot = row.raw_data as NormalizedAuctionLot;
  const report = row.final_report as Record<string, unknown>;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";
  const resultUrl = `${appUrl}/auction/${resultId}`;

  const vehicleName = [lot.year, lot.make, lot.model].filter(Boolean).join(" ") || "Salvage Vehicle";
  const subject = `Your OFFO Auction Report — ${vehicleName}`;
  const html = buildAuctionEmailHtml(lot, report, resultUrl);

  const result = await sendChecklistEmail(email, subject, html);

  // Log delivery
  try {
    const emailHash = createHash("sha256").update(email.toLowerCase()).digest("hex");
    await supabase.from("email_checklist_deliveries").insert({
      scenario_type: "copart",
      scenario_id: resultId,
      email_hash: emailHash,
      delivery_status: result.success ? "sent" : "failed",
      provider_message_id: result.messageId ?? null,
    });
  } catch { /* non-critical */ }

  // Track event
  try {
    await supabase.from("user_events").insert({
      event_name: result.success ? "auction_report_email_sent" : "auction_report_email_failed",
      event_data: { result_id: resultId },
      anon_id: anonId,
      ip_address: ip,
      page_path: "/api/auction/email",
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-critical */ }

  if (!result.success) {
    return NextResponse.json({ success: false, error: "Failed to send email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
